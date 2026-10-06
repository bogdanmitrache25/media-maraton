'use client';

import { useEffect, useState, useTransition } from 'react';
import { setTheme } from '@/app/theme-actions';
import type { ThemeChoice } from '@/lib/theme';

type Resolved = 'light' | 'dark';

function fromSystem(): Resolved {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Conmutador papel / tinta.
 *
 * La clave es no tocar `document` durante el render: este componente también se
 * ejecuta en el servidor, donde no existe. Si la cookie fija un tema explícito,
 * el servidor ya lo sabe y lo pinta directamente —sin parpadeo y sin desajuste
 * de hidratación—. Solo cuando la preferencia es «sistema», algo que el
 * servidor no puede resolver, se consulta al montar.
 */
export function ThemeToggle({ initial }: { initial?: ThemeChoice }) {
  const [pending, startTransition] = useTransition();
  const [theme, setLocal] = useState<Resolved | null>(
    initial === 'light' || initial === 'dark' ? initial : null,
  );

  useEffect(() => {
    if (theme === null) setLocal(fromSystem());
  }, [theme]);

  function flip() {
    const next: Resolved = (theme ?? fromSystem()) === 'dark' ? 'light' : 'dark';
    setLocal(next);
    document.documentElement.setAttribute('data-theme', next);
    startTransition(() => {
      void setTheme(next);
    });
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      disabled={pending}
      aria-label="Cambiar entre papel y tinta"
    >
      {theme === null ? '···' : theme === 'dark' ? 'TINTA' : 'PAPEL'}
    </button>
  );
}
