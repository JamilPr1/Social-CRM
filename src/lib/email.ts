import "server-only";

import nodemailer from "nodemailer";
import { getAdminEmail, getAppName } from "./admin-config";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_PASS?.trim());
}

function createTransport() {
  const user = process.env.SMTP_USER?.trim() || getAdminEmail();
  const pass = process.env.SMTP_PASS?.trim();
  if (!pass) {
    throw new Error("SMTP_PASS is not configured");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const from = getAdminEmail();
  const appName = getAppName();

  const transport = createTransport();
  await transport.sendMail({
    from: `"${appName}" <${from}>`,
    replyTo: from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  return { sent: true, from };
}

export async function sendInviteEmail(options: {
  to: string;
  inviteeName?: string | null;
  joinUrl: string;
  invitedByName: string;
  expiresAt: Date;
}) {
  const appName = getAppName();
  const from = getAdminEmail();
  const greeting = options.inviteeName ? `Hi ${options.inviteeName},` : "Hi,";
  const expires = options.expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `You're invited to ${appName}`;
  const text = `${greeting}

${options.invitedByName} invited you to join ${appName}.

Click the link below to set your password and sign in:
${options.joinUrl}

This invite expires on ${expires}.

If you did not expect this email, you can ignore it.

— ${appName}
${from}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <p>${greeting}</p>
      <p><strong>${options.invitedByName}</strong> invited you to join <strong>${appName}</strong>.</p>
      <p style="margin:24px 0">
        <a href="${options.joinUrl}" style="background:#1877f2;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
          Accept invite &amp; set password
        </a>
      </p>
      <p style="font-size:14px;color:#555">Or copy this link:<br><a href="${options.joinUrl}">${options.joinUrl}</a></p>
      <p style="font-size:13px;color:#777">Expires ${expires}.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:12px;color:#999">Sent from ${from}</p>
    </div>
  `;

  return sendEmail({ to: options.to, subject, text, html });
}
