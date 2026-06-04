"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearTwoFactorChallenge,
  clearTwoFactorTrust,
  createSession,
  createTwoFactorChallenge,
  createTwoFactorTrust,
  destroySession,
  getTwoFactorChallengeUser,
  hasValidTwoFactorTrust,
  requireAdmin,
  requireUser
} from "./auth";
import { hashToken, randomToken } from "./crypto";
import { query } from "./db";
import { sendPasswordResetEmail, sendUserRegistrationInviteEmail } from "./email";
import {
  consumeBackupCode,
  createSetupQrCode,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  looksLikeBackupCode,
  replaceBackupCodes,
  verifyTotp
} from "./two-factor";

export type AuthActionState = {
  error?: string;
  message?: string;
  resetUrl?: string;
  inviteUrl?: string;
  qrCodeDataUrl?: string;
  manualKey?: string;
  backupCodes?: string[];
};

const PASSWORD_RESET_REQUEST_MESSAGE = "If this email exists, we will send a password reset link.";

function asString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string) {
  return password.length >= 8;
}

function normalizeProjectStatus(status: string) {
  return status === "done" ? "done" : "active";
}

function normalizeCategory(category: string) {
  return ["IT", "Sales", "Support", "Business"].includes(category) ? category : "Business";
}

function normalizeTaskPriority(priority: string) {
  return ["low", "medium", "high"].includes(priority) ? priority : "medium";
}

function normalizeTaskStatus(status: string) {
  return ["todo", "in_progress", "done"].includes(status) ? status : "todo";
}

export async function registerAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const name = asString(formData, "name");
  const email = asString(formData, "email").toLowerCase();
  const password = asString(formData, "password");

  if (!name) {
    return { error: "Please enter your name." };
  }

  if (!validateEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (!validatePassword(password)) {
    return { error: "Password must be at least 8 characters." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await query<{ id: string }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id",
      [name, email, passwordHash]
    );

    await createSession(result.rows[0].id);
  } catch (error) {
    return { error: "This email is already registered." };
  }

  redirect("/main-page");
}

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = asString(formData, "email").toLowerCase();
  const password = asString(formData, "password");

  const result = await query<{ id: string; password_hash: string; two_factor_enabled: boolean }>(
    "SELECT id, password_hash, two_factor_enabled FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Email or password is incorrect." };
  }

  if (user.two_factor_enabled && !(await hasValidTwoFactorTrust(user.id))) {
    await createTwoFactorChallenge(user.id);
    redirect("/two-factor");
  }

  await createSession(user.id);
  redirect("/main-page");
}

export async function verifyLoginTwoFactorAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const code = asString(formData, "code");
  const challengeUser = await getTwoFactorChallengeUser();

  if (!challengeUser) {
    return { error: "Two-factor sign-in has expired. Please log in again." };
  }

  const result = await query<{ two_factor_secret: string | null }>(
    "SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true LIMIT 1",
    [challengeUser.id]
  );
  const user = result.rows[0];

  if (!user?.two_factor_secret) {
    await clearTwoFactorChallenge();
    return { error: "Two-factor authentication is not available for this account." };
  }

  const isBackupCode = looksLikeBackupCode(code);
  const isValid = isBackupCode
    ? await consumeBackupCode(challengeUser.id, code)
    : verifyTotp(decryptSecret(user.two_factor_secret), code);

  if (!isValid) {
    return { error: "Authenticator code is incorrect." };
  }

  await clearTwoFactorChallenge();
  await createTwoFactorTrust(challengeUser.id);
  await createSession(challengeUser.id);
  redirect("/main-page");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function createProjectAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireAdmin();
  const name = asString(formData, "name");
  const description = asString(formData, "description");
  const startDate = asString(formData, "startDate");
  const ddl = asString(formData, "ddl");
  const ownerId = asString(formData, "ownerId") || user.id;
  const status = normalizeProjectStatus(asString(formData, "status"));

  if (!name) {
    return { error: "Please enter a project name." };
  }

  if (!startDate || !ddl) {
    return { error: "Please choose a start date and DDL." };
  }

  if (ddl < startDate) {
    return { error: "DDL cannot be earlier than the start date." };
  }

  const ownerResult = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [ownerId]);

  if (!ownerResult.rows[0]) {
    return { error: "Project creator is invalid." };
  }

  await query(
    `INSERT INTO projects (name, description, start_date, ddl, owner_id, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [name, description || null, startDate, ddl, ownerId, status]
  );

  revalidatePath("/projects");
  return { message: "Project has been created." };
}

export async function updateProjectAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireAdmin();
  const projectId = asString(formData, "projectId");
  const name = asString(formData, "name");
  const description = asString(formData, "description");
  const startDate = asString(formData, "startDate");
  const ddl = asString(formData, "ddl");
  const ownerId = asString(formData, "ownerId") || user.id;
  const status = normalizeProjectStatus(asString(formData, "status"));

  if (!projectId) {
    return { error: "Project is missing." };
  }

  if (!name) {
    return { error: "Please enter a project name." };
  }

  if (!startDate || !ddl) {
    return { error: "Please choose a start date and DDL." };
  }

  if (ddl < startDate) {
    return { error: "DDL cannot be earlier than the start date." };
  }

  const ownerResult = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [ownerId]);

  if (!ownerResult.rows[0]) {
    return { error: "Project creator is invalid." };
  }

  const result = await query<{ id: string }>(
    `UPDATE projects
     SET name = $1,
         description = $2,
         start_date = $3,
         ddl = $4,
         owner_id = $5,
         status = $6,
         updated_at = now()
     WHERE id = $7
     RETURNING id`,
    [name, description || null, startDate, ddl, ownerId, status, projectId]
  );

  if (!result.rows[0]) {
    return { error: "Project was not found." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Project has been updated." };
}

export async function deleteProjectAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();
  const projectId = asString(formData, "projectId");

  if (!projectId) {
    return { error: "Project is missing." };
  }

  await query("DELETE FROM projects WHERE id = $1", [projectId]);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createTaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();
  const projectId = asString(formData, "projectId");
  const title = asString(formData, "title");
  const assignedToId = asString(formData, "assignedToId");
  const priority = normalizeTaskPriority(asString(formData, "priority"));
  const status = normalizeTaskStatus(asString(formData, "status"));

  if (!projectId) {
    return { error: "Please choose a project." };
  }

  if (!title) {
    return { error: "Please enter a task title." };
  }

  if (!assignedToId) {
    return { error: "Please choose who this task is assigned to." };
  }

  const projectResult = await query<{ id: string }>("SELECT id FROM projects WHERE id = $1 LIMIT 1", [projectId]);

  if (!projectResult.rows[0]) {
    return { error: "Project is invalid." };
  }

  const assigneeResult = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [assignedToId]);

  if (!assigneeResult.rows[0]) {
    return { error: "Assigned user is invalid." };
  }

  await query(
    `INSERT INTO tasks (project_id, title, assigned_to_id, priority, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [projectId, title, assignedToId, priority, status]
  );

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Task has been created." };
}

export async function updateTaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();
  const taskId = asString(formData, "taskId");
  const projectId = asString(formData, "projectId");
  const title = asString(formData, "title");
  const assignedToId = asString(formData, "assignedToId");
  const priority = normalizeTaskPriority(asString(formData, "priority"));
  const status = normalizeTaskStatus(asString(formData, "status"));

  if (!taskId || !projectId) {
    return { error: "Task is missing." };
  }

  if (!title) {
    return { error: "Please enter a task title." };
  }

  if (!assignedToId) {
    return { error: "Please choose who this task is assigned to." };
  }

  const assigneeResult = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [assignedToId]);

  if (!assigneeResult.rows[0]) {
    return { error: "Assigned user is invalid." };
  }

  const result = await query<{ id: string }>(
    `UPDATE tasks
     SET title = $1,
         assigned_to_id = $2,
         priority = $3,
         status = $4,
         updated_at = now()
     WHERE id = $5 AND project_id = $6
     RETURNING id`,
    [title, assignedToId, priority, status, taskId, projectId]
  );

  if (!result.rows[0]) {
    return { error: "Task was not found." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Task has been updated." };
}

export async function deleteTaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();
  const taskId = asString(formData, "taskId");
  const projectId = asString(formData, "projectId");

  if (!taskId || !projectId) {
    return { error: "Task is missing." };
  }

  await query("DELETE FROM tasks WHERE id = $1 AND project_id = $2", [taskId, projectId]);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Task has been deleted." };
}

export async function createUserAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();

  const name = asString(formData, "name");
  const email = asString(formData, "email").toLowerCase();
  const category = normalizeCategory(asString(formData, "category"));

  if (!name) {
    return { error: "Please enter a name." };
  }

  if (!validateEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  const token = randomToken();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/complete-registration?token=${token}`;
  let createdUserId: string | null = null;

  try {
    const userResult = await query<{ id: string }>(
      "INSERT INTO users (name, email, password_hash, role, category) VALUES ($1, $2, $3, 'user', $4) RETURNING id",
      [name, email, await bcrypt.hash(randomToken(), 12), category]
    );
    createdUserId = userResult.rows[0].id;

    await query(
      `INSERT INTO user_registration_invites (
         user_id,
         admin_code_hash,
         invite_token_hash,
         admin_verified_at,
         invite_sent_at,
         expires_at
       )
       VALUES ($1, $2, $3, now(), now(), now() + interval '7 days')
       RETURNING id`,
      [createdUserId, hashToken(token), hashToken(token)]
    );

    const emailResult = await sendUserRegistrationInviteEmail(email, inviteUrl);

    if (emailResult.mode === "development") {
      await query("DELETE FROM users WHERE id = $1", [createdUserId]);
      return { error: "SMTP is not configured, so the registration email was not sent." };
    }

    revalidatePath("/admin/users");
    return {
      message: "Registration email has been sent to the user."
    };
  } catch (error) {
    if (createdUserId) {
      await query("DELETE FROM users WHERE id = $1", [createdUserId]);
    }

    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return { error: "This email is already registered." };
    }

    return { error: error instanceof Error ? error.message : "Registration email could not be sent." };
  }
}

export async function completeInvitedRegistrationAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const token = asString(formData, "token");
  const password = asString(formData, "password");

  if (!validatePassword(password)) {
    return { error: "Password must be at least 8 characters." };
  }

  const inviteResult = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id
     FROM user_registration_invites
     WHERE invite_token_hash = $1
       AND admin_verified_at IS NOT NULL
       AND completed_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [hashToken(token)]
  );
  const invite = inviteResult.rows[0];

  if (!invite) {
    return { error: "Registration link is invalid or expired." };
  }

  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    await bcrypt.hash(password, 12),
    invite.user_id
  ]);
  await query("UPDATE user_registration_invites SET completed_at = now() WHERE id = $1", [invite.id]);

  await createSession(invite.user_id);
  redirect("/main-page");
}

export async function forgotPasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = asString(formData, "email").toLowerCase();

  if (!validateEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  const userResult = await query<{ id: string }>("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
  const user = userResult.rows[0];

  if (!user) {
    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }

  const token = randomToken();
  await query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')",
    [user.id, hashToken(token)]
  );

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const emailResult = await sendPasswordResetEmail(email, resetUrl);

  if (emailResult.mode === "development") {
    return {
      message: "Development mode: reset email is not configured, so use this reset link.",
      resetUrl: emailResult.resetUrl
    };
  }

  return { message: PASSWORD_RESET_REQUEST_MESSAGE };
}

export async function resetPasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const token = asString(formData, "token");
  const password = asString(formData, "password");

  if (!validatePassword(password)) {
    return { error: "New password must be at least 8 characters." };
  }

  const tokenResult = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [hashToken(token)]
  );
  const reset = tokenResult.rows[0];

  if (!reset) {
    return { error: "Reset link is invalid or expired." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    reset.user_id
  ]);
  await query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [reset.id]);
  await query("DELETE FROM sessions WHERE user_id = $1", [reset.user_id]);
  await query("DELETE FROM two_factor_trusted_sessions WHERE user_id = $1", [reset.user_id]);

  redirect("/login?reset=success");
}

export async function changePasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const currentPassword = asString(formData, "currentPassword");
  const newPassword = asString(formData, "newPassword");

  if (!validatePassword(newPassword)) {
    return { error: "New password must be at least 8 characters." };
  }

  const result = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  const storedUser = result.rows[0];

  if (!storedUser || !(await bcrypt.compare(currentPassword, storedUser.password_hash))) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    user.id
  ]);
  await query("DELETE FROM sessions WHERE user_id = $1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)", [
    user.id
  ]);

  return { message: "Password has been updated." };
}

export async function beginTwoFactorSetupAction(_: AuthActionState): Promise<AuthActionState> {
  const user = await requireUser();
  const secret = generateSecret();

  try {
    await query("UPDATE users SET two_factor_pending_secret = $1, updated_at = now() WHERE id = $2", [
      encryptSecret(secret),
      user.id
    ]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start two-factor setup." };
  }

  return {
    message: "Scan the QR code, then enter the 6-digit code from your authenticator app.",
    qrCodeDataUrl: await createSetupQrCode(user.email, secret),
    manualKey: secret
  };
}

export async function confirmTwoFactorSetupAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await requireUser();
  const code = asString(formData, "code");

  const result = await query<{ two_factor_pending_secret: string | null }>(
    "SELECT two_factor_pending_secret FROM users WHERE id = $1 LIMIT 1",
    [user.id]
  );
  const pendingSecret = result.rows[0]?.two_factor_pending_secret;

  if (!pendingSecret) {
    return { error: "Start two-factor setup before confirming a code." };
  }

  const encryptedSecret = pendingSecret;
  const secret = decryptSecret(encryptedSecret);

  if (!verifyTotp(secret, code)) {
    return { error: "Authenticator code is incorrect." };
  }

  const backupCodes = generateBackupCodes();
  await replaceBackupCodes(user.id, backupCodes);
  await query(
    `UPDATE users
     SET two_factor_enabled = true,
         two_factor_secret = $1,
         two_factor_pending_secret = NULL,
         two_factor_confirmed_at = now(),
         updated_at = now()
     WHERE id = $2`,
    [encryptedSecret, user.id]
  );
  await createTwoFactorTrust(user.id);

  return {
    message: "Two-factor authentication is now enabled. Save these recovery codes.",
    backupCodes
  };
}

export async function disableTwoFactorAction(
  _: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await requireUser();
  const password = asString(formData, "password");
  const code = asString(formData, "code");

  const result = await query<{ password_hash: string; two_factor_secret: string | null }>(
    "SELECT password_hash, two_factor_secret FROM users WHERE id = $1 LIMIT 1",
    [user.id]
  );
  const storedUser = result.rows[0];

  if (!storedUser || !(await bcrypt.compare(password, storedUser.password_hash))) {
    return { error: "Current password is incorrect." };
  }

  if (!storedUser.two_factor_secret) {
    return { error: "Two-factor authentication is not enabled." };
  }

  const isValid = verifyTotp(decryptSecret(storedUser.two_factor_secret), code);

  if (!isValid) {
    return { error: "Authenticator code is incorrect." };
  }

  await query(
    `UPDATE users
     SET two_factor_enabled = false,
         two_factor_secret = NULL,
         two_factor_pending_secret = NULL,
         two_factor_confirmed_at = NULL,
         updated_at = now()
     WHERE id = $1`,
    [user.id]
  );
  await query("DELETE FROM two_factor_backup_codes WHERE user_id = $1", [user.id]);
  await query("DELETE FROM two_factor_challenges WHERE user_id = $1", [user.id]);
  await query("DELETE FROM two_factor_trusted_sessions WHERE user_id = $1", [user.id]);
  await clearTwoFactorTrust();

  return { message: "Two-factor authentication has been disabled." };
}
