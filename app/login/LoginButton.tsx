'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ERROR_LABELS: Record<string, string> = {
  oauth: 'Google canceló o rechazó el acceso. Inténtalo de nuevo.',
  missing_code: 'La respuesta de Google llegó incompleta. Inténtalo de nuevo.',
  exchange: 'No se pudo completar el inicio de sesión. Inténtalo de nuevo.',
  session: 'Tu sesión ha caducado. Vuelve a entrar.',
};

export function LoginButton({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // Solo pedimos lo mínimo: identificarnos y conocer el correo.
          scopes: 'openid email profile',
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        setError('No se pudo iniciar el flujo de acceso con Google.');
        setLoading(false);
      }
      // Si va bien, el navegador sale de la página: no reseteamos el estado.
    } catch {
      setError('Error de conexión. Comprueba tu red e inténtalo de nuevo.');
      setLoading(false);
    }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <button className="google-btn" onClick={signIn} disabled={loading} type="button">
        <GoogleMark />
        {loading ? 'Conectando…' : 'Continuar con Google'}
      </button>
    </>
  );
}

export function LoginError({ code }: { code: string }) {
  const label = ERROR_LABELS[code];
  if (!label) return null;
  return <div className="error">{label}</div>;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.95a9 9 0 0 0 0 8.1l3.02-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
