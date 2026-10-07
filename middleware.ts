import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getPublicEnv } from '@/lib/env';

/**
 * Rutas accesibles sin sesión. Todo lo demás exige login.
 *
 * El cron entra aquí a propósito: no tiene sesión de usuario, pero se protege
 * por su cuenta con `CRON_SECRET` dentro de la propia ruta. Si no se abriera,
 * el middleware lo redirigiría a /login y no se enviaría ningún correo.
 */
const isPublic = (pathname: string) =>
  pathname === '/' ||
  pathname === '/login' ||
  pathname.startsWith('/auth/') ||
  pathname.startsWith('/api/cron/');

/**
 * Cabeceras de seguridad. La CSP se construye con un nonce por petición, así
 * no hace falta `unsafe-inline` en script-src.
 */
function cspFor(nonce: string, supabaseHost: string, isDev: boolean) {
  return [
    `default-src 'self'`,
    // nonce + strict-dynamic: solo se ejecuta lo que lleva el nonce (o lo que
    // ello mismo cargue). Las listas blancas de dominios se ignoran, que es
    // justo lo que queremos.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''}`,
    // Next.js inyecta estilos en línea; no hay forma limpia de evitarlo.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.googleusercontent.com https://*.supabase.co`,
    `font-src 'self' data:`,
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ].join('; ');
}

const STATIC_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
};

/**
 * Evita open redirects: solo aceptamos rutas internas.
 * `//evil.com`, `https://evil.com` y `/\evil.com` se rechazan.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/plan';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/plan';
  return raw;
}

function redirectWith(url: URL, csp: string) {
  const res = NextResponse.redirect(url);
  res.headers.set('Content-Security-Policy', csp);
  for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  let supabaseHost = 'localhost';
  try {
    supabaseHost = getPublicEnv().host;
  } catch {
    // Sin entorno configurado no bloqueamos el arranque.
  }

  const csp = cspFor(nonce, supabaseHost, isDev);

  // La CSP y el nonce tienen que viajar en las cabeceras de PETICIÓN para que
  // Next.js aplique el nonce a sus propios <script>. Si solo se pusieran en la
  // respuesta, la app fallaría en producción por violación de CSP.
  request.headers.set('Content-Security-Policy', csp);
  request.headers.set('x-nonce', nonce);

  const { response, user } = await updateSession(request);

  const { pathname, search } = request.nextUrl;

  // 1. Guardia de autenticación.
  if (!isPublic(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', pathname + search);
    return redirectWith(loginUrl, csp);
  }

  // 2. Un usuario autenticado no tiene nada que hacer en /login.
  if (pathname === '/login' && user) {
    const planUrl = request.nextUrl.clone();
    planUrl.pathname = safeNext(request.nextUrl.searchParams.get('next'));
    planUrl.search = '';
    return redirectWith(planUrl, csp);
  }

  // 3. Cabeceras de seguridad en la respuesta normal.
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto _next/static, _next/image y archivos estáticos.
     */
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|txt|xml|json|webmanifest)$).*)',
  ],
};
