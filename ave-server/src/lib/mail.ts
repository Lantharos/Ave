type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

function getFromAddress(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  const fromName = process.env.RESEND_FROM_NAME?.trim();
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}

export async function sendMail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch(RESEND_EMAILS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (response.ok) {
    return;
  }

  const payload = await response.text();
  throw new Error(`Resend request failed (${response.status}): ${payload}`);
}
