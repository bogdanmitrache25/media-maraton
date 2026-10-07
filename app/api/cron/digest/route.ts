import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildDigest } from '@/lib/email/digest';
import { sendEmail } from '@/lib/email/resend';
import {
  PHASES,
  dayIndexIn,
  isCountable,
  weekOfDate,
  weekTotal,
} from '@/lib/plan-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Correo diario con el plan del día.
 *
 * Horario: 5:30 en Europe/Madrid. Vercel programa los cron en UTC y **no
 * entiende de horario de verano**, así que hay dos disparos diarios —ver
 * `vercel.json`— y aquí se decide cuál es el bueno. El pestillo
 * `digest_sent_on` garantiza que solo salga un correo por día aunque los dos
 * disparos lleguen dentro de la ventana.
 */
const TARGET_HOUR = 5;
const WINDOW_FROM_MINUTE = 25;
const WINDOW_TO_MINUTE = 59;

const TIME_ZONE = 'Europe/Madrid';

type MadridNow = { dateISO: string; hour: number; minute: number };

/** Hora local de Madrid, calculada con la base de datos de zonas horarias. */
function madridNow(): MadridNow {
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

export async function GET(request: Request) {
  /* ---------------------------------------------------------------- */
  /* 1. Autorización. Sin secreto configurado NO se envía nada.        */
  /* ---------------------------------------------------------------- */
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';

  if (!secret) {
    // Fallar cerrado: si nadie ha puesto el secreto, cualquiera podría llamar
    // a esta ruta y usar la cuenta de Resend como altavoz.
    console.error('[cron/digest] CRON_SECRET no está configurado. No se envía nada.');
    return NextResponse.json({ ok: false, error: 'Cron no configurado.' }, { status: 500 });
  }

  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  /* ---------------------------------------------------------------- */
  /* 2. ¿Es la hora?                                                    */
  /* ---------------------------------------------------------------- */
  const now = madridNow();
  const inWindow =
    now.hour === TARGET_HOUR &&
    now.minute >= WINDOW_FROM_MINUTE &&
    now.minute <= WINDOW_TO_MINUTE;

  if (!inWindow && !force) {
    return NextResponse.json({
      ok: true,
      skipped: `fuera de ventana (Madrid ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')})`,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 3. ¿Qué toca hoy?                                                  */
  /* ---------------------------------------------------------------- */
  const week = weekOfDate(now.dateISO);
  if (!week) {
    return NextResponse.json({ ok: true, skipped: 'hoy no cae dentro del plan' });
  }

  const dayIndex = dayIndexIn(week, now.dateISO);
  if (dayIndex < 0) {
    return NextResponse.json({ ok: true, skipped: 'día fuera de rango' });
  }

  const baseDay = week.days[dayIndex];
  if (!baseDay) {
    return NextResponse.json({ ok: true, skipped: 'sesión inexistente' });
  }

  const phase = PHASES[week.phase];
  const total = weekTotal(week);

  const admin = createAdminClient();

  /* ---------------------------------------------------------------- */
  /* 4. Destinatarios: solo quien lo ha activado y no lo ha recibido    */
  /* ---------------------------------------------------------------- */
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, display_name, digest_sent_on')
    .eq('digest_enabled', true);

  if (profilesError) {
    console.error('[cron/digest] profiles:', profilesError.message);
    return NextResponse.json({ ok: false, error: 'No se pudieron leer los perfiles.' }, { status: 500 });
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
    console.error('[cron/digest] listUsers:', usersError.message);
    return NextResponse.json({ ok: false, error: 'No se pudieron leer los usuarios.' }, { status: 500 });
  }

  const emailById = new Map<string, string>();
  for (const u of userList.users) {
    if (u.email) emailById.set(u.id, u.email);
  }

  /* ---------------------------------------------------------------- */
  /* 5. Sustituciones y progreso de esta semana, dos consultas          */
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
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://media-maraton-tawny.vercel.app';
  const results: Array<{ to: string; ok: boolean; detail: string }> = [];

  for (const profile of pending) {
    const to = emailById.get(profile.id);
    if (!to) {
      results.push({ to: profile.id, ok: false, detail: 'sin email' });
      continue;
    }

    const over = overrideByUser.get(profile.id);
    const session = over
      ? {
          type: baseDay.type,
          title: over.title,
          desc: over.note ?? '',
          overridden: baseDay.title,
        }
      : { type: baseDay.type, title: baseDay.title, desc: baseDay.desc, overridden: null };

    const digest = buildDigest({
      name: profile.display_name || to.split('@')[0] || 'atleta',
      dateISO: now.dateISO,
      week: week.n,
      dayIndex,
      phaseName: phase.name,
      focus: week.focus,
      km: week.km === 'carrera' ? '' : week.km,
      session,
      isRest: !isCountable(baseDay.type),
      weekDone: weekProgress(profile.id),
      weekTotal: total,
      appUrl,
    });

    const sent = await sendEmail({ to, ...digest });

    if (sent.ok) {
      // El pestillo se marca DESPUÉS de enviar: si el envío falla, el siguiente
      // disparo del día lo reintenta.
      const { error: markError } = await admin
        .from('profiles')
        .update({ digest_sent_on: now.dateISO })
        .eq('id', profile.id);

      if (markError) console.error('[cron/digest] marca:', markError.message);
    } else {
      console.error('[cron/digest] envío:', to, sent.error);
    }

    results.push({ to, ok: sent.ok, detail: sent.ok ? 'enviado' : sent.error });
  }

  const sentCount = results.filter((r) => r.ok).length;
  console.log(`[cron/digest] ${now.dateISO} · ${sentCount}/${results.length} enviados`);

  return NextResponse.json({ ok: true, date: now.dateISO, sent: sentCount, results });
}
