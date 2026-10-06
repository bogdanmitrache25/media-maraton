import { z } from 'zod';

/**
 * Variables de entorno públicas (las únicas que pueden llegar al navegador).
 *
 * Se validan en tiempo de ejecución, no al importar el módulo: así el build
 * no explota si aún no has creado `.env.local`.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida (https://xxx.supabase.co)'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(40, 'NEXT_PUBLIC_SUPABASE_ANON_KEY parece incompleta'),
});

export type PublicEnv = {
  url: string;
  anonKey: string;
  /** Host de Supabase, para construir la CSP. */
  host: string;
};

let cached: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  · ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `\n\nConfiguración de entorno incompleta.\n` +
        `Copia .env.example a .env.local y rellena los valores de Supabase.\n\n${detail}\n`,
    );
  }

  cached = {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''),
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    host: new URL(parsed.data.NEXT_PUBLIC_SUPABASE_URL).host,
  };
  return cached;
}

/** URL pública de la app. Se usa para el redirect de OAuth y la validación de origen. */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return raw.replace(/\/$/, '');
}
