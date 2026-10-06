import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Cierre de sesión.
 *
 * Es POST a propósito: un GET permitiría cerrar la sesión del usuario con solo
 * hacerle cargar una imagen (`<img src="/auth/signout">`), que es un CSRF
 * clásico. Además comprobamos el origen de la petición.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return new NextResponse('Origen no permitido', { status: 403 });
      }
    } catch {
      return new NextResponse('Origen no válido', { status: 403 });
    }
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
