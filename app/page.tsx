import { redirect } from 'next/navigation';
import { createClientWithUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * La raíz no muestra nada: manda al plan si hay sesión y al login si no.
 * La guardia real vive en el middleware; esto es solo el enrutado de entrada.
 */
export default async function Home() {
  const { user } = await createClientWithUser();
  redirect(user ? '/plan' : '/login');
}
