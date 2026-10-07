import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

/**
 * Cliente con la service role key. SALTA Row Level Security por completo.
 *
 * Reglas de uso, sin excepciones:
 *   1. Este módulo solo se importa desde el servidor (Route Handlers, cron,
 *      tareas administrativas). Nunca desde un componente de cliente.
 *   2. El cron no tiene sesión de usuario, así que no hay forma de leer los
 *      perfiles de todos los atletas pasando por RLS. Aquí sí hace falta.
 *   3. Toda escritura hecha con este cliente debe acotarse explícitamente por
 *      `user_id`: RLS no nos protege, así que la precisión la ponemos nosotros.
 *
 * Los genéricos van escritos a mano a propósito. El proyecto no usa tipos
 * generados de la base de datos, y con el `Database = any` por defecto de
 * supabase-js el genérico interno `Schema` colapsa a `never`: `.from()` deja de
 * tiparse y cualquier consulta da error de compilación.
 */
type AdminClient = SupabaseClient<any, 'public', any>;

let cached: AdminClient | null = null;

export function createAdminClient(): AdminClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
        'Sin ellas no se puede enviar el correo diario.',
    );
  }

  cached = createSupabaseClient<any, 'public', any>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
