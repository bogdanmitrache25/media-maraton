/**
 * Informe de entrenamiento en Markdown.
 *
 * El objetivo es que el atleta pueda pegar esto en su propia IA y obtener un
 * análisis útil sin tener que explicar nada más. Por eso el documento es
 * autocontenido: incluye el plan, lo que realmente ha hecho, sus registros y
 * las reglas del protocolo, que son las que permiten juzgar si algo va mal.
 *
 * Es un módulo puro: no depende de React ni de Supabase.
 */

import {
  DAY_NAMES,
  PHASES,
  WEEKS,
  dateOf,
  formatRange,
  isCountable,
  sessionKey,
  weekOfDate,
  weekTotal,
  type Week,
} from '@/lib/plan-data';

export interface ExportLog {
  week: number;
  km: number | null;
  pain: number | null;
  cadence: number | null;
  sleep: number | null;
  palpD: number | null;
  palpI: number | null;
  acwr: number | null;
  notes: string | null;
}

export interface ExportOverride {
  title: string;
  note: string | null;
}

export interface ExportInput {
  name: string;
  today: string;
  done: Set<string>;
  overrides: Record<string, ExportOverride>;
  logs: Record<number, ExportLog>;
}

const DASH = '—';

const n = (v: number | null, suffix = '') => (v === null ? DASH : `${v}${suffix}`);

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace(/\./g, '');
}

/** El plan arranca el 5 de octubre de 2026 y la carrera es el 14 de marzo de 2027. */
const RACE_DATE = '2027-03-14';
const RACE_KM = '21,097 km';
const RACE_PACE = '5:13 /km';

export function buildTrainingReport(input: ExportInput): string {
  const { name, today, done, overrides, logs } = input;

  const currentWeek = weekOfDate(today);
  const currentN = currentWeek?.n ?? 0;

  let totalPlanned = 0;
  let totalDone = 0;
  for (const w of WEEKS) {
    const planned = weekTotal(w);
    totalPlanned += planned;
    for (let i = 0; i < 7; i++) {
      if (done.has(sessionKey(w.n, i))) totalDone++;
    }
  }
  const pct = totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : 0;

  const overrideList = Object.entries(overrides);
  const fullWeeks = WEEKS.filter((w) => {
    const planned = weekTotal(w);
    if (planned === 0) return false;
    let complete = 0;
    for (let i = 0; i < 7; i++) if (done.has(sessionKey(w.n, i))) complete++;
    return complete === planned;
  });

  const logRows = Object.values(logs).sort((a, b) => a.week - b.week);

  const out: string[] = [];

  // Las secciones van numeradas por orden de aparición, porque algunas son
  // condicionales (sustituciones, semanas por delante) y numerarlas a mano
  // acaba descuadrando el documento.
  let section = 0;
  const head = (title: string) => `## ${++section}. ${title}`;

  /* ---------------------------------------------------------------- */
  /* Cabecera                                                          */
  /* ---------------------------------------------------------------- */

  out.push('# Hoja de tiempos — Media Maratón 1:50');
  out.push('');
  out.push(`- **Atleta:** ${name}`);
  out.push(`- **Informe generado:** ${longDate(today)}`);
  out.push(`- **Objetivo:** ${RACE_KM} en 1:50 (${RACE_PACE})`);
  out.push(`- **Carrera:** ${longDate(RACE_DATE)}`);
  out.push('- **Plan:** 23 semanas · del 5 de octubre de 2026 al 14 de marzo de 2027');
  out.push('');

  /* ---------------------------------------------------------------- */
  /* Resumen                                                           */
  /* ---------------------------------------------------------------- */

  out.push(head('Resumen de adherencia'));
  out.push('');
  out.push(`- Sesiones completadas: **${totalDone} de ${totalPlanned}** (${pct} %)`);
  out.push(`- Semanas cerradas al 100 %: **${fullWeeks.length} de 23**`);
  if (currentN) {
    const w = WEEKS.find((x) => x.n === currentN);
    if (w) {
      let c = 0;
      for (let i = 0; i < 7; i++) if (done.has(sessionKey(w.n, i))) c++;
      out.push(`- Semana en curso: **S${String(currentN).padStart(2, '0')}**, ${c} de ${weekTotal(w)} sesiones`);
    }
  }
  out.push(`- Sesiones sustituidas por otras actividades: **${overrideList.length}**`);
  out.push(`- Semanas con cierre registrado: **${logRows.length}**`);
  out.push('');

  /* ---------------------------------------------------------------- */
  /* Registro semanal                                                  */
  /* ---------------------------------------------------------------- */

  out.push(head('Registro semanal del atleta'));
  out.push('');
  if (!logRows.length) {
    out.push('_Todavía no hay ningún cierre de semana registrado._');
  } else {
    out.push('| Semana | Fechas | Km | Dolor 0-10 | Cadencia ppm | Sueño h | Tibia D cm | Tibia I cm | ACWR | Notas |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const l of logRows) {
      const w = WEEKS.find((x) => x.n === l.week);
      out.push(
        `| S${String(l.week).padStart(2, '0')} | ${w ? formatRange(w.start) : DASH} | ${n(l.km)} | ${n(l.pain)} | ${n(l.cadence)} | ${n(l.sleep)} | ${n(l.palpD)} | ${n(l.palpI)} | ${n(l.acwr)} | ${l.notes ?? DASH} |`,
      );
    }
  }
  out.push('');

  /* ---------------------------------------------------------------- */
  /* Detalle de las semanas relevantes                                 */
  /* ---------------------------------------------------------------- */

  // Solo las semanas que ya han empezado o que tienen actividad: el resto del
  // plan no aporta nada al análisis y multiplicaría el tamaño del informe.
  const relevant = WEEKS.filter((w) => {
    if (currentN && w.n <= currentN) return true;
    for (let i = 0; i < 7; i++) if (done.has(sessionKey(w.n, i))) return true;
    return Object.keys(overrides).some((k) => k.startsWith(`${w.n}:`));
  });

  out.push(head('Detalle día a día'));
  out.push('');
  for (const w of relevant) {
    out.push(`### S${String(w.n).padStart(2, '0')} · ${w.focus}`);
    out.push('');
    const phase = PHASES[w.phase];
    out.push(
      `*${phase.name} · ${formatRange(w.start)} · ${w.km} · ${weekTotal(w)} sesiones programadas*`,
    );
    out.push('');
    out.push('| Día | Fecha | Hecha | Sesión | Detalle |');
    out.push('|---|---|---|---|---|');
    for (let i = 0; i < 7; i++) {
      const day = w.days[i];
      if (!day) continue;
      const key = sessionKey(w.n, i);
      const over = overrides[key];
      const isDone = done.has(key);
      if (!isCountable(day.type)) {
        out.push(`| ${DAY_NAMES[i]} | ${shortDate(dateOf(w.n, i))} | ${DASH} | Descanso | |`);
        continue;
      }
      const label = over ? `**${over.title}** _(en lugar de «${day.title}»)_` : day.title;
      const detail = over ? (over.note ?? DASH) : day.desc || DASH;
      out.push(
        `| ${DAY_NAMES[i]} | ${shortDate(dateOf(w.n, i))} | ${isDone ? '✔' : DASH} | ${label} | ${detail} |`,
      );
    }
    out.push('');
  }

  /* ---------------------------------------------------------------- */
  /* Sustituciones                                                     */
  /* ---------------------------------------------------------------- */

  if (overrideList.length) {
    out.push(head('Sesiones sustituidas'));
    out.push('');
    out.push('El atleta cambió estas sesiones del plan por otras actividades:');
    out.push('');
    for (const [key, over] of overrideList) {
      const [wRaw, dRaw] = key.split(':');
      const wk = Number(wRaw);
      const dy = Number(dRaw);
      const w = WEEKS.find((x) => x.n === wk);
      const original = w?.days[dy];
      const isDone = done.has(key);
      out.push(
        `- **S${String(wk).padStart(2, '0')} · ${DAY_NAMES[dy]} ${shortDate(dateOf(wk, dy))}**${isDone ? ' (realizada)' : ''}: «${original?.title ?? DASH}» → «${over.title}»${over.note ? `. Nota: ${over.note}` : ''}`,
      );
    }
    out.push('');
  }

  /* ---------------------------------------------------------------- */
  /* Plan por delante                                                  */
  /* ---------------------------------------------------------------- */

  const ahead = WEEKS.filter((w) => w.n > currentN);
  if (ahead.length) {
    out.push(head('Lo que queda por delante'));
    out.push('');
    for (const w of ahead) {
      out.push(
        `- **S${String(w.n).padStart(2, '0')}** · ${formatRange(w.start)} · ${w.km} · ${w.focus}`,
      );
    }
    out.push('');
  }

  /* ---------------------------------------------------------------- */
  /* Protocolo                                                         */
  /* ---------------------------------------------------------------- */

  out.push(head('Protocolo de referencia'));
  out.push('');
  out.push('### Reglas de carga (ACWR)');
  out.push('');
  out.push('ACWR = kilómetros de la semana ÷ media de las cuatro semanas anteriores.');
  out.push('');
  out.push('- Menos de 0,80 → infraentrenamiento. Se puede subir.');
  out.push('- 0,80 a 1,30 → zona segura.');
  out.push('- 1,30 a 1,50 → riesgo elevado. No subir volumen esta semana.');
  out.push('- Más de 1,50 → zona de lesión. Repetir la semana anterior o bajar.');
  out.push('');
  out.push('El plan además progresa en bloques de tres semanas crecientes más una de descarga.');
  out.push('');
  out.push('### Semáforo de dolor tibial');
  out.push('');
  out.push('| Nivel | Puntuación | Qué significa | Qué hacer |');
  out.push('|---|---|---|---|');
  out.push('| 00 verde | 0-2 | Molestia difusa que se va al calentar y no deja secuela | Entrenar con normalidad |');
  out.push('| 01 ámbar | 3-4 | Aparece a media sesión y no persiste al día siguiente | Volumen −30 %, sin intervalos, revisar en 48 h |');
  out.push('| 02 naranja | 5-6 | Dolor difuso de más de 5 cm que sigue al día siguiente o al caminar | Parar la carrera, pasar a bici, mínimo 5-7 días |');
  out.push('| 03 rojo | Más de 6, o focal | Dolor puntual de menos de 2 cm, nocturno, al levantarse o con cojera | Parar y consultar a un médico del deporte |');
  out.push('');
  out.push('Cuatro señales que separan la molestia de la lesión: dolor **focal** (lo señalas con un dedo), **nocturno**, **que aparece al levantarte** o **cojera**.');
  out.push('');

  /* ---------------------------------------------------------------- */
  /* Encargo                                                           */
  /* ---------------------------------------------------------------- */

  out.push(head('Qué quiero que analices'));
  out.push('');
  out.push('1. ¿La progresión de volumen es coherente con mi punto de partida o hay saltos de riesgo?');
  out.push('2. ¿Mis registros de dolor y de palpación tibial anticipan algún problema?');
  out.push('3. ¿Hay relación entre cadencia, sueño y los días que he fallado o ido mal?');
  out.push('4. ¿Qué debería ajustar en las próximas dos semanas, y qué señales me obligarían a parar?');
  out.push('5. ¿Voy en camino de bajar de 1:50, o el objetivo necesita revisarse?');
  out.push('');
  out.push('Responde en español, con referencias concretas a los datos de este informe.');
  out.push('');

  return out.join('\n');
}
