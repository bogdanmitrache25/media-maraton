import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/lib/env';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Usa la **anon key** (pública) y opera con la sesión del usuario, por lo que
 * todas las consultas pasan por Row Level Security. Nunca usamos la service
 * role key aquí: si lo hiciéramos, saltaríamos RLS y el aislamiento entre
 * usuarios dependería solo de nuestro código.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. El middleware se
          // encarga de refrescar la sesión, así que aquí no pasa nada.
        }
      },
    },
  });
}

/**
 * Igual que `createClient`, pero además exige que haya usuario.
 * Devuelve `null` si no hay sesión válida.
 */
export async function createClientWithUser() {
  const supabase = await createClient();
  // getUser() valida el token contra el servidor de auth. getSession() NO lo
  // hace y no debe usarse para autorizar en el servidor.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
