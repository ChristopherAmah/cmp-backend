import nodemailer from "nodemailer";

export const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP config missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

export const sendMail = async ({ to, cc, subject, html, attachments }) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const transporter = createTransporter();

  return transporter.sendMail({
    from,
    to,
    cc,
    subject,
    html,
    attachments,
  });
};
