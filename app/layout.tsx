import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import { normalizeTheme, THEME_COOKIE } from '@/lib/theme';
import './globals.css';

/**
 * Dirección tipográfica: una grotesca industrial para la voz editorial y una
 * monoespaciada para todo lo que es dato. Se autoalojan en el build, así que
 * la CSP (`font-src 'self'`) sigue siendo estricta y no dependemos de Google
 * en tiempo de ejecución.
 */
const display = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: false,
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Media Maratón 1:50',
  description:
    'Plan de 23 semanas para media maratón en 1:50 y prevención de periostitis tibial. Uso privado.',
  applicationName: 'MM 1:50',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    // 'default' deja que iOS pinte la barra de estado según el tema del
    // sistema, que es justo lo que sigue nuestra paleta.
    statusBarStyle: 'default',
    title: 'MM 1:50',
  },
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFEBE3' },
    { media: '(prefers-color-scheme: dark)', color: '#12100D' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El tema se resuelve en el servidor para que `data-theme` viaje ya en el
  // primer HTML: sin parpadeo y sin scripts inline (la CSP es estricta).
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const dataTheme = normalizeTheme(stored);

  return (
    <html lang="es" data-theme={dataTheme} className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
