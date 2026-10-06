import type { Metadata } from 'next';
import { AuthForm } from './AuthForm';
import { safeNext } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrar · Media Maratón 1:50',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <div className="screen">
      <div className="screen-inner">
        <div className="brand">🏃</div>
        <h1>Media Maratón 1:50</h1>
        <p>
          Plan de 23 semanas y prevención de periostitis tibial. Crea tu cuenta o entra para
          acceder a tu plan y guardar tu progreso.
        </p>

        <AuthForm next={next} />
      </div>
    </div>
  );
}
