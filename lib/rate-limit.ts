import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';

/**
 * Limitador de peticiones (ventana fija).
 *
 * Modo preferente: Postgres, vía la función `rate_limit_hit` del esquema. Es
 * consistente entre instancias serverless, que es lo que hace falta en Vercel.
 * Requiere `SUPABASE_SERVICE_ROLE_KEY`, que solo existe en el servidor.
 *
 * Modo de reserva: memoria del proceso. Sirve para desarrollo y para que la app
 * no se caiga si falta la clave, pero en serverless cada instancia lleva su
 * propia cuenta, así que es una protección parcial. No es un fallo silencioso:
 * queda registrado en consola.
 */

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();
let warnedAboutFallback = false;

const MEMORY_MAX_BUCKETS = 5_000;

function memoryHit(bucket: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = memory.get(bucket);

  if (!existing || existing.resetAt < now) {
    if (memory.size > MEMORY_MAX_BUCKETS) {
      for (const [key, value] of memory) {
        if (value.resetAt < now) memory.delete(key);
      }
    }
    memory.set(bucket, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  existing.count += 1;
  return existing.count <= limit;
}

/**
 * Devuelve `true` si la petición está permitida.
 *
 * @param bucket   Identificador del cubo, p. ej. `sync:<userId>`.
 * @param limit    Peticiones permitidas por ventana.
 * @param windowSeconds  Duración de la ventana.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) {
    try {
      const { url } = getPublicEnv();
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'X-Client-Info': 'media-maraton-ratelimit' } },
      });

      const { data, error } = await admin.rpc('rate_limit_hit', {
        p_bucket: bucket,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });

      if (!error && typeof data === 'boolean') return data;
      if (error) console.warn('[rate-limit] fallo de RPC, usando memoria:', error.message);
    } catch (err) {
      console.warn('[rate-limit] excepción, usando memoria:', err);
    }
  } else if (!warnedAboutFallback && process.env.NODE_ENV === 'production') {
    warnedAboutFallback = true;
    console.warn(
      '[rate-limit] SUPABASE_SERVICE_ROLE_KEY ausente: el limitador cae a memoria ' +
        'y no es consistente entre instancias serverless.',
    );
  }

  return memoryHit(bucket, limit, windowSeconds);
}
