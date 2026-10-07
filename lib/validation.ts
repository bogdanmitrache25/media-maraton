import { z } from 'zod';

/**
 * Esquemas de validación de entrada.
 *
 * Toda escritura que llega del navegador pasa por aquí ANTES de tocar la base
 * de datos. Nunca confiamos en lo que envía el cliente, ni siquiera cuando el
 * propio formulario ya lo ha validado en el navegador.
 *
 * Esto es defensa en profundidad: Row Level Security impide ver datos ajenos,
 * y Zod impide escribir basura en los propios.
 */

const WEEK = z.number().int().min(1).max(23);
const DAY = z.number().int().min(0).max(6);

export const toggleSessionSchema = z.object({
  week: WEEK,
  day: DAY,
  done: z.boolean(),
});

export type ToggleSessionInput = z.infer<typeof toggleSessionSchema>;

export const weeklyLogSchema = z.object({
  week: WEEK,
  km: z.number().min(0).max(400).nullable(),
  pain: z.number().int().min(0).max(10).nullable(),
  cadence: z.number().int().min(100).max(260).nullable(),
  sleep: z.number().min(0).max(14).nullable(),
  palpD: z.number().min(0).max(40).nullable(),
  palpI: z.number().min(0).max(40).nullable(),
  acwr: z.number().min(0).max(10).nullable(),
  notes: z.string().trim().max(500).nullable(),
});

export type WeeklyLogInput = z.infer<typeof weeklyLogSchema>;

/**
 * Sustituir una sesión del plan por lo que el atleta haga realmente.
 *
 * El título es obligatorio: una sustitución sin título no dice nada. La nota
 * es opcional y la cadena vacía se normaliza a `null` para no guardar ruido.
 */
export const sessionOverrideSchema = z.object({
  week: WEEK,
  day: DAY,
  title: z.string().trim().min(1, 'Escribe qué vas a hacer').max(80),
  note: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .transform((v) => (v === null || v === '' ? null : v)),
});

export type SessionOverrideInput = z.infer<typeof sessionOverrideSchema>;

/** Quitar una sustitución y volver a la sesión original del plan. */
export const clearOverrideSchema = z.object({
  week: WEEK,
  day: DAY,
});

/** Preferencia del correo diario con el plan del día. */
export const digestPrefSchema = z.object({
  enabled: z.boolean(),
});

/**
 * Nombre del atleta. Es lo que aparece en el saludo del correo diario, así que
 * se guarda tal cual lo escriba, sin inventar nada.
 */
export const displayNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre')
    // La columna admite hasta 80; 40 deja margen de sobra para un nombre real.
    .max(40, 'Como máximo 40 caracteres'),
});

/**
 * Convierte un valor de `FormData` en número o `null`.
 * Cadena vacía, ausente o no numérica → `null` (no cero).
 */
export function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim().replace(',', '.');
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Las claves de semana/día que envía el cliente son "12:3".
 * Las parseamos de forma estricta; cualquier cosa rara devuelve `null`.
 */
export function parseSessionKey(key: string): { week: number; day: number } | null {
  const parts = key.split(':');
  if (parts.length !== 2) return null;
  const week = Number(parts[0]);
  const day = Number(parts[1]);
  if (!Number.isInteger(week) || !Number.isInteger(day)) return null;
  if (week < 1 || week > 23 || day < 0 || day > 6) return null;
  return { week, day };
}
