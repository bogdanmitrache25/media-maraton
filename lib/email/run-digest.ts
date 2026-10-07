/**
 * Lógica del correo diario, compartida por las dos rutas de cron.
 *
 * Vive aquí y no en una ruta porque Vercel **solo admite un cron por ruta**:
 * declarar dos veces la misma ruta con horarios distintos hace que registre una
 * y descarte la otra. Así que hay dos rutas —una por cada horario— y las dos
 * llaman a esto.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildDigest } from '@/lib/email/digest';
import { sendEmail } from '@/lib/email/resend';
import { PHASES, dayIndexIn, isCountable, weekOfDate, weekTotal } from '@/lib/plan-data';

/**
 * Horario objetivo: 5:30 en Europe/Madrid.
 *
 * Vercel programa los cron en UTC y no entiende de cambios de hora. Un único
 * disparo daría las 5:30 en verano y las 4:30 en invierno, así que hay dos:
 *
 *   - `/api/cron/digest-summer` a las 3:30 UTC → 5:30 en verano (UTC+2)
 *   - `/api/cron/digest-winter` a las 4:30 UTC → 5:30 en invierno (UTC+1)
 *
 * El que no toca cae fuera de la ventana y no hace nada.
 */
const TARGET_HOUR = 5;
const WINDOW_FROM_MINUTE = 25;
const WINDOW_TO_MINUTE = 59;

const TIME_ZONE = 'Europe/Madrid';

/**
 * Lista blanca de destinatarios, opcional.
 *
 * Sin un dominio verificado en Resend solo se puede entregar al correo del
 * titular de la cuenta. Mientras siga así, esta variable evita el peor
 * escenario: que un amigo active el interruptor, el correo salga, Resend lo
 * rechace y él se quede esperando algo que nunca va a llegar sin saber por qué.
 *
 * Si está vacía, manda la lógica por usuario de siempre.
 */
function allowedRecipients(): Set<string> | null {
  const raw = process.env.DIGEST_RECIPIENTS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Hora local de Madrid, resuelta con la base de datos de zonas horarias. */
function madridNow(): { dateISO: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';

  return {
    dateISO: `${get('year')}-${get('month')}-${get('day')}`,
    // Algunos motores devuelven "24" a medianoche aunque se pida h23.
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

export async function runDigest(request: Request): Promise<NextResponse> {
  /* ---------------------------------------------------------------- */
  /* 1. Autorización. Sin secreto configurado NO se envía nada.         */
  /* ---------------------------------------------------------------- */
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';

  if (!secret) {
    // Fallar cerrado: si nadie puso el secreto, cualquiera podría llamar a esta
    // ruta y usar la cuenta de Resend como altavoz.
    console.error('[digest] CRON_SECRET no está configurado. No se envía nada.');
    return NextResponse.json({ ok: false, error: 'Cron no configurado.' }, { status: 500 });
  }

  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const force = params.get('force') === '1';

  /*
   * Modo vista previa: `?preview=YYYY-MM-DD` devuelve lo que se enviaría ese
   * día, sin enviar nada ni tocar el pestillo. Sirve para comprobar el
   * contenido y, sobre todo, para verificar que los días de descanso también
   * generan correo.
   */
  const previewRaw = params.get('preview');
  const previewDate = previewRaw && /^\d{4}-\d{2}-\d{2}$/.test(previewRaw) ? previewRaw : null;

  /* ---------------------------------------------------------------- */
  /* 2. ¿Es la hora?                                                    */
  /* ---------------------------------------------------------------- */
  const now = madridNow();
  const inWindow =
    now.hour === TARGET_HOUR &&
    now.minute >= WINDOW_FROM_MINUTE &&
    now.minute <= WINDOW_TO_MINUTE;

  // La vista previa no envía nada, así que no está sujeta a la ventana horaria:
  // es justo la herramienta con la que se comprueba qué pasaría a las 5:30.
  if (!inWindow && !force && !previewDate) {
    const hh = String(now.hour).padStart(2, '0');
    const mm = String(now.minute).padStart(2, '0');
    return NextResponse.json({ ok: true, skipped: `fuera de ventana (Madrid ${hh}:${mm})` });
  }

  const dateISO = previewDate ?? now.dateISO;

  /* ---------------------------------------------------------------- */
  /* 3. ¿Qué toca ese día?                                              */
  /* ---------------------------------------------------------------- */
  const week = weekOfDate(dateISO);
  if (!week) return NextResponse.json({ ok: true, skipped: 'ese día no cae dentro del plan' });

  const dayIndex = dayIndexIn(week, dateISO);
  if (dayIndex < 0) return NextResponse.json({ ok: true, skipped: 'día fuera de rango' });

  const baseDay = week.days[dayIndex];
  if (!baseDay) return NextResponse.json({ ok: true, skipped: 'sesión inexistente' });

  const phase = PHASES[week.phase];
  const total = weekTotal(week);
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://media-maraton-tawny.vercel.app';

  /** Arma el correo de este día para un atleta. Mismo camino en envío y vista previa. */
  const compose = (
    name: string,
    over?: { title: string; note: string | null },
    weekDone = 0,
  ) =>
    buildDigest({
      name,
      dateISO,
      week: week.n,
      dayIndex,
      phaseName: phase.name,
      focus: week.focus,
      km: week.km === 'carrera' ? '' : week.km,
      session: over
        ? {
            type: baseDay.type,
            title: over.title,
            desc: over.note ?? '',
            overridden: baseDay.title,
          }
        : { type: baseDay.type, title: baseDay.title, desc: baseDay.desc, overridden: null },
      isRest: !isCountable(baseDay.type),
      weekDone,
      weekTotal: total,
      appUrl,
    });

  if (previewDate) {
    const sample = compose('Atleta');
    return NextResponse.json({
      ok: true,
      preview: true,
      date: dateISO,
      week: week.n,
      dayIndex,
      esDescanso: !isCountable(baseDay.type),
      subject: sample.subject,
      text: sample.text,
    });
  }

  const admin = createAdminClient();

  /* ---------------------------------------------------------------- */
  /* 4. Destinatarios: quien lo activó y no lo ha recibido hoy          */
  /* ---------------------------------------------------------------- */
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, display_name, digest_sent_on')
    .eq('digest_enabled', true);

  if (profilesError) {
    console.error('[digest] profiles:', profilesError.message);
    return NextResponse.json(
      { ok: false, error: 'No se pudieron leer los perfiles.' },
      { status: 500 },
    );
  }

  const pending = (profiles ?? []).filter((p) => p.digest_sent_on !== now.dateISO);
  if (!pending.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'nadie pendiente' });
  }

  // El correo vive en auth.users, no en profiles: hace falta el cliente admin.
  const { data: userList, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (usersError) {
    console.error('[digest] listUsers:', usersError.message);
    return NextResponse.json(
      { ok: false, error: 'No se pudieron leer los usuarios.' },
      { status: 500 },
    );
  }

  const emailById = new Map<string, string>();
  for (const u of userList.users) {
    if (u.email) emailById.set(u.id, u.email);
  }

  /* ---------------------------------------------------------------- */
  /* 5. Sustituciones y progreso de hoy, dos consultas                  */
  /* ---------------------------------------------------------------- */
  const { data: overrides } = await admin
    .from('session_overrides')
    .select('user_id, week, day, title, note')
    .eq('week', week.n)
    .eq('day', dayIndex);

  const overrideByUser = new Map<string, { title: string; note: string | null }>();
  for (const o of overrides ?? []) {
    overrideByUser.set(o.user_id, { title: o.title, note: o.note });
  }

  const { data: completions } = await admin
    .from('session_completions')
    .select('user_id, day')
    .eq('week', week.n);

  const doneByUser = new Map<string, Set<number>>();
  for (const c of completions ?? []) {
    const set = doneByUser.get(c.user_id) ?? new Set<number>();
    set.add(c.day);
    doneByUser.set(c.user_id, set);
  }

  /** Sesiones realmente hechas esta semana, contando solo las que se marcan. */
  const weekProgress = (userId: string) => {
    const days = doneByUser.get(userId) ?? new Set<number>();
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const day = week.days[i];
      if (day && isCountable(day.type) && days.has(i)) done++;
    }
    return done;
  };

  /* ---------------------------------------------------------------- */
  /* 6. Enviar                                                          */
  /* ---------------------------------------------------------------- */
  const results: Array<{ to: string; ok: boolean; detail: string }> = [];
  const allowed = allowedRecipients();

  for (const profile of pending) {
    const to = emailById.get(profile.id);
    if (!to) {
      results.push({ to: profile.id, ok: false, detail: 'sin email' });
      continue;
    }

    if (allowed && !allowed.has(to.toLowerCase())) {
      results.push({ to, ok: false, detail: 'fuera de la lista blanca' });
      continue;
    }

    const over = overrideByUser.get(profile.id);
    const digest = compose(
      profile.display_name || to.split('@')[0] || 'atleta',
      over,
      weekProgress(profile.id),
    );

    const sent = await sendEmail({ to, ...digest });

    if (sent.ok) {
      // El pestillo se marca DESPUÉS de enviar: si el envío falla, el otro
      // disparo del día lo reintenta.
      const { error: markError } = await admin
        .from('profiles')
        .update({ digest_sent_on: dateISO })
        .eq('id', profile.id);

      if (markError) console.error('[digest] marca:', markError.message);
    } else {
      console.error('[digest] envío:', to, sent.error);
    }

    results.push({ to, ok: sent.ok, detail: sent.ok ? 'enviado' : sent.error });
  }

  const sentCount = results.filter((r) => r.ok).length;
  console.log(`[digest] ${now.dateISO} · ${sentCount}/${results.length} enviados`);

  return NextResponse.json({ ok: true, date: now.dateISO, sent: sentCount, results });
}
