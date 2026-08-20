export const sendMail = async ({ to, cc, subject, html, attachments }) => {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Email config missing: set RESEND_API_KEY and MAIL_FROM");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      cc,
      subject,
      html,
      attachments: attachments?.map(({ filename, content, contentType }) => ({
        filename,
        content: Buffer.isBuffer(content)
          ? content.toString("base64")
          : content,
        content_type: contentType,
      })),
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "Resend rejected the email request");
  }

  return result;
};
