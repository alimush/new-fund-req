import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      requireTLS: port === 587,
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `Workflow System <${user}>`,
      to: user,
      subject: "SMTP TEST",
      text: "Test message",
    });

    return NextResponse.json({ ok: true, messageId: info.messageId, response: info.response });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err?.message,
        code: err?.code,
        command: err?.command,
        response: err?.response,
        responseCode: err?.responseCode,
      },
      { status: 500 }
    );
  }
}