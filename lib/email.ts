import nodemailer from "nodemailer";

const DEFAULT_PERSONAL_EMAIL = "shangweiwu1013@gmail.com";
const PASSWORD_RESET_REPLY_TO = process.env.EMAIL_REPLY_TO ?? DEFAULT_PERSONAL_EMAIL;
const DEFAULT_EMAIL_FROM = `Svida Job Tracker <${DEFAULT_PERSONAL_EMAIL}>`;
const EMAIL_INK = "#3d332a";
const EMAIL_MUTED = "#746557";
const EMAIL_BUTTON = "#b87954";
const EMAIL_BUTTON_TEXT = "#fffdf8";

type SendPasswordResetEmailResult =
  | { mode: "sent" }
  | { mode: "development"; resetUrl: string };

type SendUserRegistrationInviteEmailResult =
  | { mode: "sent" }
  | { mode: "development"; inviteUrl: string };

function getEmailFrom() {
  return process.env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;
}

function getSmtpTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass
    }
  });
}

function getAppName() {
  return process.env.APP_NAME ?? "Svida Job Tracker";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const transport = getSmtpTransport();

  if (!transport) {
    return false;
  }

  await transport.sendMail({
    from: getEmailFrom(),
    to,
    replyTo: PASSWORD_RESET_REPLY_TO,
    subject,
    text,
    html
  });

  return true;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<SendPasswordResetEmailResult> {
  const appName = getAppName();
  const safeAppName = escapeHtml(appName);
  const safeResetUrl = escapeHtml(resetUrl);
  const sent = await sendEmail({
    to: email,
    subject: `Reset your ${appName} password`,
    text: [
      `We received a request to reset your ${appName} password.`,
      "",
      "Open this link to choose a new password:",
      resetUrl,
      "",
      "This link expires in 30 minutes. If you did not request this, you can ignore this email."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: ${EMAIL_INK};">
        <h1 style="font-size: 22px;">Reset your ${safeAppName} password</h1>
        <p>We received a request to reset your ${safeAppName} password.</p>
        <p>
          <a href="${safeResetUrl}" style="display: inline-block; background: ${EMAIL_BUTTON}; color: ${EMAIL_BUTTON_TEXT}; padding: 12px 18px; text-decoration: none; font-weight: 700;">
            Choose a new password
          </a>
        </p>
        <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
        <p style="font-size: 14px; color: ${EMAIL_MUTED};">If the button does not work, copy and paste this link into your browser:<br>${safeResetUrl}</p>
      </div>
    `
  });

  if (!sent) {
    return { mode: "development", resetUrl };
  }

  return { mode: "sent" };
}

export async function sendUserRegistrationInviteEmail(
  email: string,
  inviteUrl: string
): Promise<SendUserRegistrationInviteEmailResult> {
  const appName = getAppName();
  const safeAppName = escapeHtml(appName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const sent = await sendEmail({
    to: email,
    subject: `Complete your ${appName} account`,
    text: [
      `You have been invited to join ${appName}.`,
      "",
      "Open this link to finish registration:",
      inviteUrl,
      "",
      "This link expires in 30 minutes."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: ${EMAIL_INK};">
        <h1 style="font-size: 22px;">Complete your ${safeAppName} account</h1>
        <p>You have been invited to join ${safeAppName}.</p>
        <p>
          <a href="${safeInviteUrl}" style="display: inline-block; background: ${EMAIL_BUTTON}; color: ${EMAIL_BUTTON_TEXT}; padding: 12px 18px; text-decoration: none; font-weight: 700;">
            Finish registration
          </a>
        </p>
        <p>This link expires in 30 minutes.</p>
        <p style="font-size: 14px; color: ${EMAIL_MUTED};">If the button does not work, copy and paste this link into your browser:<br>${safeInviteUrl}</p>
      </div>
    `
  });

  if (!sent) {
    return { mode: "development", inviteUrl };
  }

  return { mode: "sent" };
}
