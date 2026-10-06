/**
 * Evita open redirects: solo aceptamos rutas internas.
 *
 * Rechaza `//evil.com`, `https://evil.com`, `/\evil.com` y cualquier cosa que
 * no empiece por `/`. Es la única forma segura de usar un `?next=` que viene
 * del navegador.
 */
export function safeNext(raw: string | null | undefined, fallback = '/plan'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  if (raw.includes('\n') || raw.includes('\r')) return fallback;
  return raw;
}
