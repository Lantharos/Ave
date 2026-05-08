type EmailVerificationTemplateInput = {
  code: string;
  expiresInMinutes: number;
};

const textColor = "#FFFFFF";
const headingColor = "#D3D3D3";
const bodyColor = "#878787";
const mutedColor = "#696969";
const surfaceColor = "#171717";
const pageColor = "#090909";
const fontStack = "Poppins, Arial, Helvetica, sans-serif";
const codeFontStack = "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

export function renderEmailVerificationEmail(input: EmailVerificationTemplateInput) {
  const expiry = `${input.expiresInMinutes} minutes`;

  return {
    subject: "Verify your Ave email",
    text: [
      "Verify your Ave email.",
      "",
      `Your verification code is ${input.code}.`,
      `It expires in ${expiry}.`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: renderEmailShell(`
      <tr>
        <td style="padding:0 0 28px 0;">
          <div style="font-size:28px;line-height:1.1;font-weight:800;color:${textColor};">Ave</div>
        </td>
      </tr>
      <tr>
        <td style="font-size:30px;line-height:1.2;font-weight:700;color:${headingColor};">
          Verify your email.
        </td>
      </tr>
      <tr>
        <td style="padding-top:14px;font-size:16px;line-height:1.6;font-weight:400;color:${bodyColor};">
          Use this code to finish adding your email to your Ave identity.
        </td>
      </tr>
      <tr>
        <td style="padding:32px 0;">
          <div style="background:${surfaceColor};border-radius:999px;padding:22px 26px;text-align:center;">
            <span style="display:inline-block;font-family:${codeFontStack};font-size:36px;line-height:1;font-weight:800;letter-spacing:8px;color:${textColor};">${input.code}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="font-size:15px;line-height:1.6;font-weight:500;color:#B9BBBE;">
          This code expires in ${expiry}.
        </td>
      </tr>
      <tr>
        <td style="padding-top:42px;font-size:13px;line-height:1.6;font-weight:400;color:${mutedColor};">
          If you did not request this, you can ignore this email.
        </td>
      </tr>
    `),
  };
}

function renderEmailShell(content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verify your Ave email</title>
  </head>
  <body style="margin:0;padding:0;background:${pageColor};color:${textColor};font-family:${fontStack};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${pageColor};border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:48px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;border-collapse:collapse;">
            ${content}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
