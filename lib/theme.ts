/**
 * Constantes y tipos del tema.
 *
 * Viven fuera de `theme-actions.ts` a propósito: un módulo `'use server'` solo
 * puede exportar funciones asíncronas, así que la constante de la cookie no
 * puede estar ahí.
 */

export const THEME_COOKIE = 'mm-theme';

export type ThemeChoice = 'light' | 'dark' | 'system';

/** Normaliza lo que llega en la cookie a un valor utilizable. */
export function normalizeTheme(value: string | undefined): 'light' | 'dark' | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}
