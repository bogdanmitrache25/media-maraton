import type { Metadata } from 'next';
import { LoginButton, LoginError } from './LoginButton';
import { safeNext } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrar · Media Maratón 1:50',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <div className="screen">
      <div className="screen-inner">
        <div className="brand">🏃</div>
        <h1>Media Maratón 1:50</h1>
        <p>
          Plan de 23 semanas y prevención de periostitis tibial. Entra con tu cuenta de Google para
          acceder a tu plan y guardar tu progreso.
        </p>

        {params.error && <LoginError code={params.error} />}

        <LoginButton next={next} />

        <p className="fineprint">
          Solo usamos tu cuenta de Google para identificarte. No publicamos nada, no accedemos a
          Gmail ni a Drive, y no compartimos tus datos con nadie. Cada atleta ve únicamente su
          propio progreso.
        </p>
      </div>
    </div>
  );
}
