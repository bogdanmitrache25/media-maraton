/**
 * El correo "lo que queda de semana".
 *
 * Varios días en un solo mensaje, con el mismo lenguaje visual que el diario de
 * las 5:30. Se usa cuando el atleta pide el plan de los próximos días en vez de
 * una sola sesión.
 *
 * Módulo puro: construye asunto, HTML y texto plano. No envía nada.
 */

import {
  DAY_NAMES,
  SESSION_CODE,
  type SessionType,
} from '@/lib/plan-data';
import { INK, INK_MID, MONO, PAPER, RULE, SANS, SIGNAL } from '@/lib/email/digest';

export interface PlanAheadDay {
  /** Fecha local en formato YYYY-MM-DD. */
  dateISO: string;
  /** Índice dentro de la semana: 0 = lunes. */
  dayIndex: number;
  type: SessionType;
  title: string;
  desc: string;
  /** Kilómetros del día. Cadena vacía si no corre. */
  km: string;
  /** Nota añadida por el entrenador: el ajuste del día, no el plan. */
  extra?: string;
  /** Marca la sesión importante de la tanda. */
  highlight?: boolean;
}

export interface PlanAheadInput {
  name: string;
  /** Etiqueta de la semana: "S01". */
  weekLabel: string;
  /** Rango legible: "9 – 11 oct". */
  rangeLabel: string;
  phaseName: string;
  focus: string;
  /** Volumen de la semana completa: "8 km". */
  weekKm: string;
  days: PlanAheadDay[];
  appUrl: string;
}

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** "Vie 9 oct" a partir de una fecha ISO. Se calcula en UTC para no desviarse. */
export function shortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  const day = DAY_NAMES[(date.getUTCDay() + 6) % 7] ?? '';
  return `${day} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ''}`;
}

export function buildPlanAhead(input: PlanAheadInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { name, weekLabel, rangeLabel, phaseName, focus, weekKm, days, appUrl } = input;

  const subject = `${weekLabel} · ${days.length} días por delante (${rangeLabel})`;

  /* ------------------------------------------------------------------ */
  /* Texto plano                                                        */
  /* ------------------------------------------------------------------ */

  const text = [
    `${weekLabel} · ${rangeLabel}`,
    `Fase ${phaseName} · ${focus} · Volumen de la semana: ${weekKm}`,
    '',
    ...days.flatMap((day) => {
      const code = SESSION_CODE[day.type];
      const lines = [`${shortDate(day.dateISO).toUpperCase()} — ${code} · ${day.title}`];
      if (day.km) lines.push(`  ${day.km}`);
      if (day.desc) lines.push(`  ${day.desc}`);
      if (day.extra) lines.push(`  → ${day.extra}`);
      lines.push('');
      return lines;
    }),
    'Marca cada sesión cuando termines:',
    appUrl,
    '',
    `— ${name}, esto te lo manda tu propio plan.`,
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /* HTML                                                               */
  /* ------------------------------------------------------------------ */

  const eyebrow = (label: string, color = INK_MID) =>
    `<p style="margin:0 0 8px;font-family:${MONO};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${color};">${label}</p>`;

  const metaCell = (label: string) =>
    `<span style="display:inline-block;margin:0 14px 0 0;font-family:${MONO};font-size:11px;letter-spacing:0.04em;color:${INK_MID};">${label}</span>`;

  const block = (day: PlanAheadDay, last: boolean) => {
    const code = SESSION_CODE[day.type];
    const isRest = day.type === 'R';
    const titleColor = day.highlight ? SIGNAL : INK;

    return `
      <tr><td style="border-top:1px solid ${RULE};padding:20px 0 ${last ? '20px' : '24px'};">
        ${eyebrow(shortDate(day.dateISO))}
        <h2 style="margin:0;font-family:${SANS};font-size:22px;font-weight:800;line-height:1.1;letter-spacing:-0.03em;color:${titleColor};">
          ${isRest ? 'Descanso total' : day.title}
        </h2>
        <p style="margin:12px 0 0;">
          ${metaCell(code)}
          ${day.km ? metaCell(day.km.toUpperCase()) : ''}
        </p>
        ${
          day.desc
            ? `<p style="margin:12px 0 0;font-family:${MONO};font-size:12.5px;line-height:1.55;color:${INK_MID};">${day.desc}</p>`
            : ''
        }
        ${
          day.extra
            ? `<p style="margin:12px 0 0;padding:10px 12px;background:#e6e0d5;border-left:2px solid ${SIGNAL};font-family:${MONO};font-size:12px;line-height:1.55;color:${INK};">${day.extra}</p>`
            : ''
        }
      </td></tr>`;
  };

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
          ${rangeLabel} · ${name}
        </p>
      </td></tr>

      <tr><td style="border-top:1px solid ${RULE};padding-top:20px;">
        ${eyebrow(`Fase ${phaseName} · ${weekLabel}`)}
        <h1 style="margin:0;font-family:${SANS};font-size:27px;font-weight:800;line-height:1.08;letter-spacing:-0.03em;color:${INK};">
          Lo que queda de semana
        </h1>
        <p style="margin:14px 0 0;font-family:${MONO};font-size:12px;line-height:1.5;color:${INK_MID};">
          ${focus}. Volumen de la semana: ${weekKm}.
        </p>
      </td></tr>

      ${days.map((day, i) => block(day, i === days.length - 1)).join('')}

      <tr><td style="padding-top:22px;">
        <a href="${appUrl}" style="display:inline-block;background:${INK};color:${PAPER};font-family:${MONO};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;padding:13px 20px;border-radius:2px;">
          Abrir el plan
        </a>
      </td></tr>

      <tr><td style="border-top:1px solid ${RULE};padding-top:16px;">
        <p style="margin:0;font-family:${MONO};font-size:10.5px;letter-spacing:0.06em;color:${INK_MID};">
          Recibes esto porque lo pediste. El diario de las 5:30 sigue igual.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
