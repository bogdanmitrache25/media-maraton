'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

/**
 * Cliente de Supabase para el navegador.
 *
 * Solo se usa para iniciar el flujo de OAuth y cerrar sesión. La lectura y
 * escritura de datos va por Server Actions, con validación en servidor.
 */
export function createClient() {
  const { url, anonKey } = getPublicEnv();
  return createBrowserClient(url, anonKey);
}
