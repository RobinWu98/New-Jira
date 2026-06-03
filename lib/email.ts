import { Resend } from "resend";

const PASSWORD_RESET_REPLY_TO = "shangweiwu1013@gmail.com";
const ADMIN_INVITE_VERIFICATION_EMAIL = "shangweiwu1013@gmail.com";
const DEFAULT_EMAIL_FROM = "Svida Job Tracker <onboarding@resend.dev>";
const EMAIL_INK = "#3d332a";
const EMAIL_MUTED = "#746557";
const EMAIL_BUTTON = "#b87954";
const EMAIL_BUTTON_TEXT = "#fffdf8";

type SendPasswordResetEmailResult =
  | { mode: "sent" }
  | { mode: "development"; resetUrl: string };

type SendAdminInviteVerificationEmailResult =
  | { mode: "sent" }
  | { mode: "development"; code: string };

type SendUserRegistrationInviteEmailResult =
  | { mode: "sent" }
  | { mode: "development"; inviteUrl: string };

function getEmailFrom() {
  return process.env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;
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

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<SendPasswordResetEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { mode: "development", resetUrl };
  }

  const appName = getAppName();
  const safeAppName = escapeHtml(appName);
  const safeResetUrl = escapeHtml(resetUrl);
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: email,
    replyTo: PASSWORD_RESET_REPLY_TO,
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

  if (error) {
    throw new Error(error.message);
  }

  return { mode: "sent" };
}

export async function sendAdminInviteVerificationEmail(
  inviteeEmail: string,
  code: string
): Promise<SendAdminInviteVerificationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { mode: "development", code };
  }

  const appName = getAppName();
  const safeAppName = escapeHtml(appName);
  const safeInviteeEmail = escapeHtml(inviteeEmail);
  const safeCode = escapeHtml(code);
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: ADMIN_INVITE_VERIFICATION_EMAIL,
    replyTo: PASSWORD_RESET_REPLY_TO,
    subject: `Verify ${appName} user invitation`,
    text: [
      `Use this verification code to approve the ${appName} invitation for ${inviteeEmail}:`,
      "",
      code,
      "",
      "This code expires in 30 minutes."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: ${EMAIL_INK};">
        <h1 style="font-size: 22px;">Verify ${safeAppName} user invitation</h1>
        <p>Use this code to approve the invitation for <strong>${safeInviteeEmail}</strong>.</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${safeCode}</p>
        <p>This code expires in 30 minutes.</p>
      </div>
    `
  });

  if (error) {
    throw new Error(error.message);
  }

  return { mode: "sent" };
}

export async function sendUserRegistrationInviteEmail(
  email: string,
  inviteUrl: string
): Promise<SendUserRegistrationInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { mode: "development", inviteUrl };
  }

  const appName = getAppName();
  const safeAppName = escapeHtml(appName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: email,
    replyTo: PASSWORD_RESET_REPLY_TO,
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

  if (error) {
    throw new Error(error.message);
  }

  return { mode: "sent" };
}
