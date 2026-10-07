/**
 * Envío de correo con la API HTTP de Resend.
 *
 * Usamos `fetch` en vez del SDK oficial a propósito: es una sola llamada, no
 * añade dependencias al proyecto y no arrastra código al bundle.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Remitente. Con un dominio verificado en Resend puedes usar lo que quieras;
 * sin él, `onboarding@resend.dev` solo entrega al correo dueño de la cuenta.
 */
function sender(): string {
  return process.env.DIGEST_FROM ?? 'Media Maratón 1:50 <onboarding@resend.dev>';
}

/**
 * Dirección de respuesta y de baja.
 *
 * Se toma del primer destinatario de la lista blanca: en esta app el correo
 * llega a su dueño, así que responder o pedir la baja le llega a él y no a una
 * dirección muerta de Resend.
 */
function replyAddress(): string | null {
  const list = process.env.DIGEST_RECIPIENTS?.trim();
  if (!list) return null;
  return list.split(',')[0]?.trim() || null;
}

/**
 * Cabeceras que Gmail valora en el correo recurrente.
 *
 * `List-Unsubscribe` es la forma estándar de decir "esto es un envío periódico
 * que pediste y puedes dejar". Sin él, un correo diario parece sospechoso
 * porque no ofrece ninguna salida. Va solo con `mailto:` a propósito: la
 * variante de un clic exige un endpoint HTTPS que reciba un POST, y prometer
 * algo que no existe es peor que no ofrecerlo.
 */
function extraHeaders(): Record<string, string> | undefined {
  const reply = replyAddress();
  if (!reply) return undefined;

  const subject = encodeURIComponent('Baja del correo diario');
  return {
    'List-Unsubscribe': `<mailto:${reply}?subject=${subject}>`,
  };
}

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'Falta RESEND_API_KEY.' };

  try {
    const reply = replyAddress();
    const headers = extraHeaders();

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender(),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(reply ? { reply_to: reply } : {}),
        ...(headers ? { headers } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 300)}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? 'sin-id' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error de red.' };
  }
}
