/**
 * Envía por correo el plan de los próximos días.
 *
 * Es una herramienta de un solo uso: carga `.env.local`, arma el mensaje con
 * `buildPlanAhead` y lo manda con Resend. No forma parte del build de Next.
 *
 *   npx --yes tsx scripts/send-plan-ahead.ts 2026-10-09 2026-10-11
 *
 * Los dos argumentos son la fecha inicial y la final, en ISO. Sin argumentos
 * usa mañana y el domingo de esa misma semana.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Entorno                                                                    */
/* -------------------------------------------------------------------------- */

// Se cargan las variables antes de importar los módulos que las leen.
const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (!match) continue;
  const key = match[1]!;
  let value = (match[2] ?? '').trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

const { dateOf, dayIndexIn, weekOfDate } = await import('../lib/plan-data');
const { buildPlanAhead, shortDate } = await import('../lib/email/plan-ahead');
const { sendEmail } = await import('../lib/email/resend');
import type { PlanAheadDay } from '../lib/email/plan-ahead';

/* -------------------------------------------------------------------------- */
/*  Ajustes manuales sobre el plan                                             */
/* -------------------------------------------------------------------------- */

const TO_ADDRESS = process.env.DIGEST_RECIPIENTS?.split(',')[0]?.trim() ?? '';
const NAME = 'Bogdan';
const APP_URL = 'https://media-maraton-tawny.vercel.app/plan';

/** Lo que el atleta ha cambiado o lo que conviene recordarle ese día. */
const CUSTOM: Record<string, { title?: string; desc?: string; extra?: string; highlight?: boolean }> = {
  '2026-10-09': {
    title: 'Gym — tirones',
    desc: 'Cadena posterior y tracción: remo, jalón, face pull. Termina con el protocolo tibial.',
    extra:
      'Compuestos a RPE 7-8, no a 9: ya llevas ocho series al fallo esta semana. ' +
      'Añade isquios (peso muerto rumano o curl femoral) — dos días de cuádriceps y cero de cadena posterior. ' +
      'Sóleo completo: ejercicios 1, 2, 3, 5 y 6. Aquí sí tienes banda.',
  },
  '2026-10-10': {
    extra:
      'Tarea del día: cuenta tu cadencia. Camina o trota un minuto, cuenta los pasos del pie derecho ' +
      'en 30 s y multiplícalo por 4. Ese número me hace falta para las semanas 3 y 9.',
  },
  '2026-10-11': {
    highlight: true,
    extra:
      'La sesión clave de la semana. Si tienes que elegir entre acabarla entera y suave o acortarla ' +
      'por ir fuerte: entera y suave. Y no recuperes los 3 km del miércoles — los 5 km son 5 km.',
  },
};

/* -------------------------------------------------------------------------- */
/*  Montaje                                                                    */
/* -------------------------------------------------------------------------- */

const argFrom = process.argv[2];
const argTo = process.argv[3];

const today = new Date();
const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
  today.getDate(),
).padStart(2, '0')}`;

const week = weekOfDate(argFrom ?? todayISO);
if (!week) throw new Error(`No hay semana de plan para ${argFrom ?? todayISO}`);

const FROM = argFrom ?? dateOf(week.n, dayIndexIn(week, todayISO) + 1);
const TO = argTo ?? dateOf(week.n, 6);

const days: PlanAheadDay[] = [];
for (let i = 0; i < 7; i++) {
  const iso = dateOf(week.n, i);
  if (iso < FROM || iso > TO) continue;

  const base = week.days[i];
  if (!base) continue;

  const custom = CUSTOM[iso] ?? {};
  const kmMatch = /(\d+(?:[.,]\d+)?)\s*km/.exec(base.title);

  days.push({
    dateISO: iso,
    dayIndex: i,
    type: base.type,
    title: custom.title ?? base.title,
    desc: custom.desc ?? base.desc,
    km: kmMatch ? `${kmMatch[1]} km` : '',
    ...(custom.extra ? { extra: custom.extra } : {}),
    ...(custom.highlight ? { highlight: true } : {}),
  });
}

if (days.length === 0) throw new Error(`No hay días entre ${FROM} y ${TO}`);

const email = buildPlanAhead({
  name: NAME,
  weekLabel: `S${String(week.n).padStart(2, '0')}`,
  rangeLabel: `${shortDate(FROM).split(' ').slice(1).join(' ')} – ${shortDate(TO).split(' ').slice(1).join(' ')}`,
  phaseName: String(week.phase),
  focus: week.focus,
  weekKm: week.km,
  days,
  appUrl: APP_URL,
});

const result = await sendEmail({ to: TO_ADDRESS, ...email });

console.log('--- ASUNTO ---');
console.log(email.subject);
console.log('\n--- TEXTO ---');
console.log(email.text);
console.log('\n--- RESULTADO ---');
console.log(result);

if (!result.ok) process.exit(1);
