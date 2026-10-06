'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { THEME_COOKIE, type ThemeChoice } from '@/lib/theme';

/**
 * Guarda la preferencia de tema en una cookie.
 *
 * Va por cookie y no por localStorage a propósito: así el servidor puede
 * pintar `data-theme` en el `<html>` desde el primer byte y no hay parpadeo
 * al cargar. Un script inline no serviría: nuestra CSP es estricta con nonce.
 */
export async function setTheme(choice: ThemeChoice): Promise<void> {
  const store = await cookies();

  if (choice === 'system') {
    store.delete(THEME_COOKIE);
  } else {
    store.set(THEME_COOKIE, choice, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      // No es un secreto: que lo pueda leer el cliente nos deja calcular el
      // siguiente estado del conmutador sin ida y vuelta al servidor.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  revalidatePath('/', 'layout');
}
