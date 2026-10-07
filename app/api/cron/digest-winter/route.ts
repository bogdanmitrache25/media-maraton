import { runDigest } from '@/lib/email/run-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Disparo de las 4:30 UTC.
 *
 * En horario de invierno (UTC+1) son las **5:30 en Madrid**: este es el que
 * envía el correo de octubre a marzo. En verano cae a las 6:30 y no hace nada.
 */
export async function GET(request: Request) {
  return runDigest(request);
}
