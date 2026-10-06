import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/url';

export const dynamic = 'force-dynamic';

/**
 * Callback de OAuth.
 *
 * Google nos devuelve aquí con un `code` de un solo uso. Lo canjeamos por una
 * sesión: Supabase escribe las cookies httpOnly y nosotros redirigimos.
 *
 * Cualquier fallo se traduce en un mensaje genérico — nunca devolvemos el error
 * crudo al navegador, porque puede revelar detalles de configuración.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const next = safeNext(searchParams.get('next'));

  // El usuario canceló o Google rechazó la petición.
  if (providerError) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login?error=exchange', origin));
  }

  // Detrás del proxy de Vercel, `origin` puede no ser el dominio público.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';

  if (isLocal || !forwardedHost) {
    return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(`https://${forwardedHost}${next}`);
}
