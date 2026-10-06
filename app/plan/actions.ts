'use server';

import { revalidatePath } from 'next/cache';
import { createClientWithUser } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { toNumberOrNull, clearOverrideSchema, sessionOverrideSchema, toggleSessionSchema, weeklyLogSchema } from '@/lib/validation';
import { isCountable, WEEKS } from '@/lib/plan-data';

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = 'No se pudo guardar. Inténtalo de nuevo.';
const RATE_LIMIT_ERROR = 'Demasiadas peticiones seguidas. Espera unos segundos.';

/* -------------------------------------------------------------------------- */
/*  Marcar / desmarcar una sesión                                             */
/* -------------------------------------------------------------------------- */

export async function toggleSession(input: unknown): Promise<ActionResult> {
  // 1. Identidad: siempre del servidor, nunca de lo que manda el cliente.
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  // 2. Validación de forma.
  const parsed = toggleSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos no válidos.' };
  const { week, day, done } = parsed.data;

  // 3. Coherencia de negocio: la sesión tiene que existir de verdad y ser
  //    marcable. Sin esto, alguien podría inventarse semanas o marcar descansos.
  const check = checkSession(week, day, 'marcan');
  if (!check.ok) return { ok: false, error: check.error };

  // 4. Límite de peticiones por usuario.
  if (!(await rateLimit(`sync:${user.id}`, 240, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  // 5. Escritura. El `user_id` lo pone el servidor y Row Level Security
  //    revalida en el motor que coincide con auth.uid().
  if (done) {
    const { error } = await supabase
      .from('session_completions')
      .upsert(
        { user_id: user.id, week, day },
        { onConflict: 'user_id,week,day', ignoreDuplicates: true },
      );
    if (error) {
      console.error('[toggleSession] insert:', error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
  } else {
    const { error } = await supabase
      .from('session_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('week', week)
      .eq('day', day);
    if (error) {
      console.error('[toggleSession] delete:', error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  revalidatePath('/plan');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Guardar el cierre de semana                                               */
/* -------------------------------------------------------------------------- */

export async function saveWeeklyLog(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const notesRaw = String(formData.get('notes') ?? '').trim();

  const parsed = weeklyLogSchema.safeParse({
    week: Number(formData.get('week')),
    km: toNumberOrNull(formData.get('km')),
    pain: toNumberOrNull(formData.get('pain')),
    cadence: toNumberOrNull(formData.get('cadence')),
    sleep: toNumberOrNull(formData.get('sleep')),
    palpD: toNumberOrNull(formData.get('palpD')),
    palpI: toNumberOrNull(formData.get('palpI')),
    acwr: toNumberOrNull(formData.get('acwr')),
    notes: notesRaw === '' ? null : notesRaw,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? `Revisa el campo: ${first.message}` : 'Datos no válidos.' };
  }

  const { week, km, pain, cadence, sleep, palpD, palpI, acwr, notes } = parsed.data;

  if (!(await rateLimit(`log:${user.id}`, 60, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const { error } = await supabase.from('weekly_logs').upsert(
    {
      user_id: user.id,
      week,
      km,
      pain,
      cadence,
      sleep,
      palp_d: palpD,
      palp_i: palpI,
      acwr,
      notes,
    },
    { onConflict: 'user_id,week' },
  );

  if (error) {
    console.error('[saveWeeklyLog]', error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/plan');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Sustituir una sesión por lo que el atleta haga realmente                  */
/* -------------------------------------------------------------------------- */

/**
 * Comprueba que la sesión exista y que sea accionable.
 *
 * Una semana o un día inventados por un cliente manipulado no deben llegar a
 * la base de datos, y los descansos no son ni marcables ni sustituibles. El
 * verbo entra como parámetro para que el mensaje diga lo que toca.
 */
type SessionCheck = { ok: true } | { ok: false; error: string };

function checkSession(week: number, day: number, verb: string): SessionCheck {
  const targetWeek = WEEKS.find((w) => w.n === week);
  const targetDay = targetWeek?.days[day];
  if (!targetWeek || !targetDay) return { ok: false, error: 'Esa sesión no existe.' };
  if (!isCountable(targetDay.type)) {
    return { ok: false, error: `Los días de descanso no se ${verb}.` };
  }
  return { ok: true };
}

export async function saveSessionOverride(input: unknown): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const parsed = sessionOverrideSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : 'Datos no válidos.' };
  }
  const { week, day, title, note } = parsed.data;

  const check = checkSession(week, day, 'sustituyen');
  if (!check.ok) return { ok: false, error: check.error };

  if (!(await rateLimit(`override:${user.id}`, 120, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const { error } = await supabase
    .from('session_overrides')
    .upsert(
      { user_id: user.id, week, day, title, note },
      { onConflict: 'user_id,week,day' },
    );

  if (error) {
    console.error('[saveSessionOverride]', error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/plan');
  return { ok: true };
}

export async function clearSessionOverride(input: unknown): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const parsed = clearOverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos no válidos.' };
  const { week, day } = parsed.data;

  if (!(await rateLimit(`override:${user.id}`, 120, 60))) {
    return { ok: false, error: RATE_LIMIT_ERROR };
  }

  const { error } = await supabase
    .from('session_overrides')
    .delete()
    .eq('user_id', user.id)
    .eq('week', week)
    .eq('day', day);

  if (error) {
    console.error('[clearSessionOverride]', error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/plan');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Borrar el progreso del usuario                                            */
/* -------------------------------------------------------------------------- */

export async function resetMyProgress(): Promise<ActionResult> {
  const { supabase, user } = await createClientWithUser();
  if (!user) return { ok: false, error: 'Tu sesión ha caducado. Vuelve a entrar.' };

  if (!(await rateLimit(`reset:${user.id}`, 5, 3600))) {
    return { ok: false, error: 'Has borrado el progreso demasiadas veces. Prueba más tarde.' };
  }

  // Borramos por `user_id` explícito. Aunque RLS ya lo impediría, así el
  // borrado masivo es auditable y no depende de una condición implícita.
  const [sessions, logs, overrides] = await Promise.all([
    supabase.from('session_completions').delete().eq('user_id', user.id),
    supabase.from('weekly_logs').delete().eq('user_id', user.id),
    supabase.from('session_overrides').delete().eq('user_id', user.id),
  ]);

  if (sessions.error || logs.error || overrides.error) {
    console.error(
      '[resetMyProgress]',
      sessions.error?.message,
      logs.error?.message,
      overrides.error?.message,
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath('/plan');
  return { ok: true };
}
