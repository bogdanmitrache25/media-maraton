import { runDigest } from '@/lib/email/run-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Disparo de las 3:30 UTC.
 *
 * En horario de verano (UTC+2) son las **5:30 en Madrid**: este es el que envía
 * el correo de marzo a octubre. En invierno cae a las 4:30 y no hace nada.
 */
export async function GET(request: Request) {
  return runDigest(request);
}
