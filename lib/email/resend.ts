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

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'Falta RESEND_API_KEY.' };

  try {
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
