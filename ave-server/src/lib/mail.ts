type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

let emailBinding: SendEmail | null = null;

export function initMail(email: SendEmail | null | undefined): void {
  emailBinding = email ?? null;
}

function getEmailBinding(): SendEmail {
  if (!emailBinding) {
    throw new Error("EMAIL binding is not configured");
  }

  return emailBinding;
}

function getFromAddress(): string | { email: string; name: string } {
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  if (!fromEmail) {
    throw new Error("EMAIL_FROM_ADDRESS is not configured");
  }

  const fromName = process.env.EMAIL_FROM_NAME?.trim();
  return fromName ? { email: fromEmail, name: fromName } : fromEmail;
}

export async function sendMail(input: SendEmailInput): Promise<void> {
  try {
    await getEmailBinding().send({
      from: getFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (error) {
    const details = error as { code?: string; message?: string };
    const code = details.code ? ` (${details.code})` : "";
    throw new Error(`Cloudflare Email send failed${code}: ${details.message || String(error)}`);
  }
}
