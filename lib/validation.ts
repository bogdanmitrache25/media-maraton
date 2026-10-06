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
