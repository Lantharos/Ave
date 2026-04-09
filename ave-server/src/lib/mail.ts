type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

function getFromAddress(): string {
  const fromEmail = process.env.UNOSEND_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("UNOSEND_FROM_EMAIL is not configured");
  }

  const fromName = process.env.UNOSEND_FROM_NAME?.trim();
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}

export async function sendMail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.UNOSEND_API_KEY;
  if (!apiKey) {
    throw new Error("UNOSEND_API_KEY is not configured");
  }

  const response = await fetch("https://www.unosend.co/api/v1/emails", {
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
  throw new Error(`UnoSend request failed (${response.status}): ${payload}`);
}
