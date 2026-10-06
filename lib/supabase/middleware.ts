import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicEnv } from '@/lib/env';

/**
 * Refresca la sesión en cada petición y devuelve el usuario autenticado.
 *
 * Se ejecuta desde el middleware. Es el único sitio donde se pueden escribir
 * las cookies de sesión de forma fiable.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getPublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE: no metas código entre createServerClient y getUser().
  // getUser() es lo que refresca el token y reescribe las cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
