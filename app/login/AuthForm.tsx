'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

const MIN_PASSWORD = 8;

/**
 * Traduce los errores de Supabase Auth a mensajes claros en español.
 * Nunca mostramos el mensaje crudo: puede contener detalles internos.
 */
function translateError(message: string, mode: Mode): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Todavía no has confirmado tu email.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Ese email ya tiene una cuenta. Cambia a «Entrar».';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Ese email no parece válido.';
  }
  if (m.includes('weak password') || (m.includes('password') && m.includes('8'))) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'El registro está cerrado en este momento.';
  }

  return mode === 'signin'
    ? 'No se pudo iniciar sesión. Inténtalo de nuevo.'
    : 'No se pudo crear la cuenta. Inténtalo de nuevo.';
}

export function AuthForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setConfirm('');
  }

  function validate(): string | null {
    const mail = email.trim();
    if (!mail) return 'Escribe tu email.';
    // Comprobación básica en cliente. El servidor de Supabase valida de verdad.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return 'Ese email no parece válido.';
    if (!password) return 'Escribe tu contraseña.';
    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD) {
        return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
      }
      if (password !== confirm) return 'Las dos contraseñas no coinciden.';
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const mail = email.trim().toLowerCase();

      const { error: authError } =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email: mail, password })
          : await supabase.auth.signUp({
              email: mail,
              password,
              options: {
                // El trigger handle_new_user() usará este nombre para el perfil.
                data: { full_name: mail.split('@')[0] },
              },
            });

      if (authError) {
        setError(translateError(authError.message, mode));
        setLoading(false);
        return;
      }

      // Sesión creada: refrescamos para que el servidor vea las cookies nuevas.
      router.replace(next);
      router.refresh();
    } catch {
      setError('Error de conexión. Comprueba tu red e inténtalo de nuevo.');
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <>
      <div className="segmented" role="tablist" aria-label="Entrar o crear cuenta">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          className={!isSignup ? 'on' : ''}
          onClick={() => switchMode('signin')}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          className={isSignup ? 'on' : ''}
          onClick={() => switchMode('signup')}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <div className="fld" style={{ textAlign: 'left' }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
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

        <div className="fld" style={{ textAlign: 'left' }}>
          <label htmlFor="password">Contraseña</label>
          <div className="pw-wrap">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? `Mínimo ${MIN_PASSWORD} caracteres` : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {isSignup && (
          <div className="fld" style={{ textAlign: 'left' }}>
            <label htmlFor="confirm">Repite la contraseña</label>
            <input
              id="confirm"
              name="confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Un momento…' : isSignup ? 'Crear mi cuenta' : 'Entrar'}
        </button>
      </form>

      <p className="fineprint">
        {isSignup
          ? 'Tu progreso queda ligado a esta cuenta: entra desde cualquier dispositivo y lo tendrás ahí.'
          : 'Cada atleta ve únicamente su propio progreso. Nadie más puede acceder a tus datos.'}
      </p>
    </>
  );
}
