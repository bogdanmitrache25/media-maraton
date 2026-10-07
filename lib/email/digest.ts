/**
 * El correo de las 5:30: el plan del día.
 *
 * Módulo puro. Construye asunto, HTML y texto plano a partir de la sesión que
 * toca. El HTML va con estilos en línea y sin hojas externas porque los clientes
 * de correo son hostiles: Gmail borra parte del <style> y Outlook ignora la
 * mitad del CSS moderno.
 */

import {
  DAY_NAMES,
  SESSION_CODE,
  type SessionType,
} from '@/lib/plan-data';

export interface DigestSession {
  type: SessionType;
  title: string;
  desc: string;
  /** Título original del plan cuando el atleta ha sustituido la sesión. */
  overridden: string | null;
}

export interface DigestInput {
  name: string;
  /** Fecha local (Europe/Madrid) en formato YYYY-MM-DD. */
  dateISO: string;
  week: number;
  dayIndex: number;
  phaseName: string;
  focus: string;
  km: string;
  session: DigestSession;
  isRest: boolean;
  weekDone: number;
  weekTotal: number;
  appUrl: string;
}

const PAPER = '#efebe3';
const INK = '#17140f';
const INK_MID = '#5c534a';
const RULE = '#d3cabb';
const SIGNAL = '#b0350f';
const DONE = '#3f5b3a';

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

const pad = (n: number) => String(n).padStart(2, '0');

export function buildDigest(input: DigestInput): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    name,
    dateISO,
    week,
    dayIndex,
    phaseName,
    focus,
    km,
    session,
    isRest,
    weekDone,
    weekTotal,
    appUrl,
  } = input;

  const day = DAY_NAMES[dayIndex] ?? '';
  const code = SESSION_CODE[session.type];
  const weekLabel = `S${pad(week)}`;
  const dateLabel = longDate(dateISO);

  const subject = isRest
    ? `${weekLabel} · LIBRE — Descanso total`
    : `${weekLabel} · ${code} — ${session.title}`;

  /* ------------------------------------------------------------------ */
  /* Texto plano: el que leen los relojes, los asistentes y los filtros  */
  /* ------------------------------------------------------------------ */

  const text = [
    `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)}`,
    '',
    isRest ? 'HOY: DESCANSO' : `HOY: ${code} · ${session.title}`,
    `Fase ${phaseName} · Semana ${pad(week)} · ${focus}`,
    `Volumen de la semana: ${km} · ${weekDone}/${weekTotal} sesiones hechas`,
    '',
    session.overridden ? `Sustituye a «${session.overridden}»` : '',
    session.desc,
    '',
    isRest
      ? 'Día de descanso. Rutina tibial y de sóleo, 8-10 min.'
      : 'Marca la sesión cuando termines:',
    appUrl,
    '',
    `— ${name}, esto te lo manda tu propio plan.`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  /* ------------------------------------------------------------------ */
  /* HTML                                                                */
  /* ------------------------------------------------------------------ */

  const eyebrow = (label: string, color = INK_MID) =>
    `<p style="margin:0 0 10px;font-family:${MONO};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${color};">${label}</p>`;

  const metaCell = (label: string) =>
    `<span style="display:inline-block;margin:0 14px 0 0;font-family:${MONO};font-size:11px;letter-spacing:0.04em;color:${INK_MID};">${label}</span>`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;font-size:1px;color:${PAPER};">${subject}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:26px 16px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

      <tr><td style="padding-bottom:20px;">
        <p style="margin:0;font-family:${SANS};font-size:19px;font-weight:800;letter-spacing:-0.02em;color:${INK};">
          MM <span style="color:${SIGNAL};">1:50</span>
        </p>
        <p style="margin:4px 0 0;font-family:${MONO};font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:${INK_MID};">
          ${dateLabel} · ${name}
        </p>
      </td></tr>

      <tr><td style="border-top:1px solid ${RULE};padding-top:20px;">
        ${eyebrow(`Fase ${phaseName} · ${weekLabel}`)}
        <h1 style="margin:0;font-family:${SANS};font-size:27px;font-weight:800;line-height:1.08;letter-spacing:-0.03em;color:${INK};">
          ${isRest ? 'Descanso total' : session.title}
        </h1>

        <p style="margin:16px 0 0;padding-top:14px;border-top:1px solid ${RULE};">
          ${metaCell(day.toUpperCase())}
          ${isRest ? metaCell('LIBRE') : metaCell(code)}
          ${km ? metaCell(km.toUpperCase()) : ''}
        </p>

        ${
          session.overridden
            ? `<p style="margin:16px 0 0;font-family:${MONO};font-size:11px;color:${SIGNAL};">
                 Sustituye a «${session.overridden}»
               </p>`
            : ''
        }

        ${
          session.desc
            ? `<p style="margin:16px 0 0;font-family:${MONO};font-size:12.5px;line-height:1.55;color:${INK_MID};">
                 ${session.desc}
               </p>`
            : ''
        }

        ${
          isRest
            ? `<p style="margin:16px 0 0;font-family:${MONO};font-size:12.5px;line-height:1.55;color:${INK_MID};">
                 Rutina tibial y de sóleo, 8-10 min. Es el día que sostiene la semana.
               </p>`
            : `<p style="margin:16px 0 0;font-family:${MONO};font-size:12.5px;line-height:1.55;color:${INK_MID};">
                 Marca el dolor de tibia en una escala de 0 a 10 al terminar. Si pasa de 2, recorta.
               </p>`
        }
      </td></tr>

      <tr><td style="padding-top:22px;">
        <a href="${appUrl}" style="display:inline-block;background:${INK};color:${PAPER};font-family:${MONO};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;padding:13px 20px;border-radius:2px;">
          Abrir el plan
        </a>
      </td></tr>

      <tr><td style="border-top:1px solid ${RULE};margin-top:24px;padding-top:16px;">
        <p style="margin:0;font-family:${MONO};font-size:10.5px;letter-spacing:0.06em;color:${INK_MID};">
          ${focus} · ${weekDone}/${weekTotal} sesiones de esta semana · <span style="color:${DONE};">${weekLabel}</span>
        </p>
        <p style="margin:10px 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.06em;color:${INK_MID};">
          Recibes esto porque lo activaste en la app. Puedes desactivarlo cuando quieras desde Registro.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
