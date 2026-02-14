import nodemailer from "nodemailer";

export function getTransporter() {
  const host = process.env.local.SMTP_HOST;
  const port = Number(process.env.local.SMTP_PORT || 587);
  const user = process.env.local.SMTP_USER;
  const pass = process.env.local.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // 587 => STARTTLS
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, html, text }) {
  const from = process.env.local.MAIL_FROM || process.env.local.SMTP_USER;

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  return info;
}