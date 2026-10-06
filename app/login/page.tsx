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
        <p className="eyebrow" style={{ marginBottom: 18 }}>
          21,097 km · 5:13 /km · 23 semanas
        </p>

        <h1 className="mark">
          Media maratón
          <br />
          <em>1:50</em>
        </h1>

        <p className="lede">
          El plan completo, semana a semana, y el protocolo de prevención de periostitis tibial.
          Crea tu cuenta y lleva tu progreso desde cualquier dispositivo.
        </p>

        <AuthForm next={next} />
      </div>
    </div>
  );
}
