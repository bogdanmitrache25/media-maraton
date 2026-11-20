'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Traduce los errores de Supabase Auth. Nunca mostramos el mensaje crudo. */
function translate(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Todavía no has confirmado tu email.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera un minuto.';
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Ese email no parece válido.';
  }

  return 'No se pudo entrar. Inténtalo de nuevo.';
}

export function AuthForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /*
   * Hasta que React no hidrata, el formulario no tiene manejadores y el
   * navegador lo enviaría de forma nativa. Como el método por defecto es GET,
   * la contraseña acabaría escrita en la barra de direcciones, en el historial
   * y en los registros del servidor. Dos defensas: `method="post"` para que los
   * datos viajen en el cuerpo y nunca en la URL, y el botón deshabilitado hasta
   * que la página esté viva.
   */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  function validate(): string | null {
    const mail = email.trim();
    if (!mail) return 'Escribe tu email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return 'Ese email no parece válido.';
    if (!password) return 'Escribe tu contraseña.';
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const problem = validate();
    if (problem) return setError(problem);

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const mail = email.trim().toLowerCase();

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: mail,
        password,
      });

      if (authError) {
        setError(translate(authError.message));
        setLoading(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError('Sin conexión. Comprueba tu red e inténtalo de nuevo.');
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} method="post" noValidate style={{ marginTop: 22 }}>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <div className="pw">
            <input
              id="password"
              name="password"
              className="input"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {visible ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </div>

        <button className="btn btn-solid" type="submit" disabled={loading || !hydrated}>
          {loading ? 'Un momento…' : 'Entrar'}
        </button>
      </form>

      <p className="fineprint">Acceso privado. Solo el titular de la cuenta puede entrar.</p>
    </>
  );
}
