"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearTwoFactorChallenge,
  clearTwoFactorTrust,
  createSession,
  createTwoFactorTrust,
  destroySession,
  getTwoFactorChallengeUser,
  requireAdmin,
  requireCreateProject,
  requireCreateTask,
  requireManageProject,
  requireManageTask,
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

function normalizeRole(role: string) {
  return ["manager", "staff"].includes(role) ? role : "staff";
}

function normalizeLogValue(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "empty";
}

function normalizeDateLogValue(value: Date | string | null | undefined) {
  if (!value) {
    return "empty";
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function getWorkItemChangeLogs({
  assignedTo,
  current,
  dueDate,
  priority,
  startDate,
  status,
  title
}: {
  assignedTo: { email: string; id: string; name: string | null };
  current: {
    assigned_to_email: string;
    assigned_to_id: string;
    assigned_to_name: string | null;
    due_date: Date | string | null;
    priority: string;
    start_date: Date | string | null;
    status: string;
    title: string;
  };
  dueDate: string;
  priority: string;
  startDate: string;
  status: string;
  title: string;
}) {
  const logs: string[] = [];
  const currentAssignee = current.assigned_to_name || current.assigned_to_email;
  const nextAssignee = assignedTo.name || assignedTo.email;

  if (current.title !== title) {
    logs.push(`Title changed from "${current.title}" to "${title}".`);
  }

  if (current.assigned_to_id !== assignedTo.id) {
    logs.push(`Assignee changed from ${currentAssignee} to ${nextAssignee}.`);
  }

  if (normalizeDateLogValue(current.start_date) !== normalizeDateLogValue(startDate || null)) {
    logs.push(`Start date changed from ${normalizeDateLogValue(current.start_date)} to ${normalizeDateLogValue(startDate || null)}.`);
  }

  if (normalizeDateLogValue(current.due_date) !== normalizeDateLogValue(dueDate || null)) {
    logs.push(`Due date changed from ${normalizeDateLogValue(current.due_date)} to ${normalizeDateLogValue(dueDate || null)}.`);
  }

  if (current.priority !== priority) {
    logs.push(`Priority changed from ${normalizeLogValue(current.priority)} to ${normalizeLogValue(priority)}.`);
  }

  if (current.status !== status) {
    logs.push(`Status changed from ${normalizeLogValue(current.status)} to ${normalizeLogValue(status)}.`);
  }

  return logs;
}

function normalizeTaskPriority(priority: string) {
  return ["low", "medium", "high"].includes(priority) ? priority : "medium";
}

function normalizeTaskStatus(status: string) {
  return ["todo", "in_progress", "overdue", "done"].includes(status) ? status : "todo";
}

function excerpt(value: string, maxLength = 140) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

async function getMentionedUserIds(body: string) {
  const normalizedBody = body.toLowerCase();
  const result = await query<{ id: string; name: string | null; email: string }>(
    "SELECT id, name, email::text AS email FROM users WHERE archived_at IS NULL"
  );

  return result.rows
    .filter((user) => {
      const emailMention = `@${user.email.toLowerCase()}`;
      const nameMention = user.name ? `@${user.name.toLowerCase()}` : "";

      return normalizedBody.includes(emailMention) || Boolean(nameMention && normalizedBody.includes(nameMention));
    })
    .map((user) => user.id);
}

async function createNotifications({
  actorId,
  body,
  projectId,
  recipients,
  subtaskCommentId,
  subtaskId,
  taskCommentId,
  taskId,
  title,
  type
}: {
  actorId: string;
  body: string;
  projectId: string;
  recipients: string[];
  subtaskCommentId?: string;
  subtaskId?: string;
  taskCommentId?: string;
  taskId?: string;
  title: string;
  type: string;
}) {
  const uniqueRecipients = [...new Set(recipients)].filter((recipientId) => recipientId !== actorId);

  if (!uniqueRecipients.length) {
    return;
  }

  await query(
    `INSERT INTO notifications (
       user_id,
       actor_id,
       type,
       title,
       body,
       project_id,
       task_id,
       subtask_id,
       task_comment_id,
       subtask_comment_id
     )
     SELECT
       recipient_id,
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9
     FROM unnest($10::uuid[]) AS recipient_id`,
    [
      actorId,
      type,
      title,
      excerpt(body),
      projectId,
      taskId ?? null,
      subtaskId ?? null,
      taskCommentId ?? null,
      subtaskCommentId ?? null,
      uniqueRecipients
    ]
  );
}

async function createWorkItemLog({
  action,
  actorId,
  body,
  subtaskId,
  taskId
}: {
  action: string;
  actorId: string;
  body: string;
  subtaskId?: string;
  taskId: string;
}) {
  await query(
    `INSERT INTO work_item_logs (task_id, subtask_id, actor_id, action, body)
     VALUES ($1, $2, $3, $4, $5)`,
    [taskId, subtaskId ?? null, actorId, action, body]
  );
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
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'staff') RETURNING id",
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

  const result = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1 AND archived_at IS NULL LIMIT 1",
    [email]
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Email or password is incorrect." };
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
  const user = await requireCreateProject();
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
    return { error: "Please choose a start date and due date." };
  }

  if (ddl < startDate) {
    return { error: "Due date cannot be earlier than the start date." };
  }

  const ownerResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [ownerId]
  );

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
  const user = await requireManageProject();
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
    return { error: "Please choose a start date and due date." };
  }

  if (ddl < startDate) {
    return { error: "Due date cannot be earlier than the start date." };
  }

  const ownerResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [ownerId]
  );

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
       AND archived_at IS NULL
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

export async function archiveProjectAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireManageProject();
  const projectId = asString(formData, "projectId");

  if (!projectId) {
    return { error: "Project is missing." };
  }

  await query("UPDATE projects SET archived_at = now(), updated_at = now() WHERE id = $1 AND archived_at IS NULL", [
    projectId
  ]);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createTaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireCreateTask();
  const projectId = asString(formData, "projectId");
  const title = asString(formData, "title");
  const assignedToId = asString(formData, "assignedToId");
  const startDate = asString(formData, "startDate");
  const dueDate = asString(formData, "dueDate");
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

  if (startDate && dueDate && dueDate < startDate) {
    return { error: "Task due date cannot be earlier than the start date." };
  }

  const projectResult = await query<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [projectId]
  );

  if (!projectResult.rows[0]) {
    return { error: "Project is invalid." };
  }

  const assigneeResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [assignedToId]
  );

  if (!assigneeResult.rows[0]) {
    return { error: "Assigned user is invalid." };
  }

  const result = await query<{ id: string }>(
    `INSERT INTO tasks (project_id, title, assigned_to_id, start_date, due_date, priority, status)
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       CASE
         WHEN $7::text <> 'done' AND $5::date IS NOT NULL AND $5::date < current_date THEN 'overdue'
         WHEN $7::text = 'overdue' THEN 'todo'
         ELSE $7::text
       END
     )
     RETURNING id`,
    [projectId, title, assignedToId, startDate || null, dueDate || null, priority, status]
  );
  await createWorkItemLog({
    action: "created",
    actorId: user.id,
    body: `Task "${title}" was created.`,
    taskId: result.rows[0].id
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Task has been created." };
}

export async function updateTaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireManageTask();
  const taskId = asString(formData, "taskId");
  const projectId = asString(formData, "projectId");
  const title = asString(formData, "title");
  const assignedToId = asString(formData, "assignedToId");
  const startDate = asString(formData, "startDate");
  const dueDate = asString(formData, "dueDate");
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

  if (startDate && dueDate && dueDate < startDate) {
    return { error: "Task due date cannot be earlier than the start date." };
  }

  const assigneeResult = await query<{ email: string; id: string; name: string | null }>(
    "SELECT id, name, email::text AS email FROM users WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [assignedToId]
  );
  const assignee = assigneeResult.rows[0];

  if (!assignee) {
    return { error: "Assigned user is invalid." };
  }

  const currentResult = await query<{
    assigned_to_email: string;
    assigned_to_id: string;
    assigned_to_name: string | null;
    due_date: Date | string | null;
    priority: string;
    start_date: Date | string | null;
    status: string;
    title: string;
  }>(
    `SELECT
       tasks.title,
       tasks.assigned_to_id,
       users.name AS assigned_to_name,
       users.email::text AS assigned_to_email,
       tasks.start_date,
       tasks.due_date,
       tasks.priority,
       tasks.status
     FROM tasks
     JOIN users ON users.id = tasks.assigned_to_id
     WHERE tasks.id = $1
       AND tasks.project_id = $2
       AND tasks.archived_at IS NULL
     LIMIT 1`,
    [taskId, projectId]
  );
  const current = currentResult.rows[0];

  if (!current) {
    return { error: "Task was not found." };
  }

  const result = await query<{ id: string; status: string }>(
    `UPDATE tasks
     SET title = $1,
         assigned_to_id = $2,
         start_date = $3,
         due_date = $4,
         priority = $5,
         status = CASE
           WHEN $6::text <> 'done' AND $4::date IS NOT NULL AND $4::date < current_date THEN 'overdue'
           WHEN $6::text = 'overdue' THEN 'todo'
           ELSE $6::text
         END,
         updated_at = now()
     WHERE id = $7 AND project_id = $8 AND archived_at IS NULL
     RETURNING id, status`,
    [title, assignedToId, startDate || null, dueDate || null, priority, status, taskId, projectId]
  );

  if (!result.rows[0]) {
    return { error: "Task was not found." };
  }

  const logs = getWorkItemChangeLogs({
    assignedTo: assignee,
    current,
    dueDate,
    priority,
    startDate,
    status: result.rows[0].status,
    title
  });

  for (const body of logs) {
    await createWorkItemLog({ action: "updated", actorId: user.id, body, taskId });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Task has been updated." };
}

export async function createSubtaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const projectId = asString(formData, "projectId");
  const taskId = asString(formData, "taskId");
  const title = asString(formData, "title");
  const assignedToId = asString(formData, "assignedToId");
  const startDate = asString(formData, "startDate");
  const dueDate = asString(formData, "dueDate");
  const priority = normalizeTaskPriority(asString(formData, "priority"));
  const status = normalizeTaskStatus(asString(formData, "status"));

  if (!projectId || !taskId) {
    return { error: "Parent task is missing." };
  }

  if (!title) {
    return { error: "Please enter a sub-task title." };
  }

  if (!assignedToId) {
    return { error: "Please choose who this sub-task is assigned to." };
  }

  if (startDate && dueDate && dueDate < startDate) {
    return { error: "Sub-task due date cannot be earlier than the start date." };
  }

  const taskResult = await query<{ id: string }>(
    "SELECT id FROM tasks WHERE id = $1 AND project_id = $2 AND archived_at IS NULL LIMIT 1",
    [taskId, projectId]
  );

  if (!taskResult.rows[0]) {
    return { error: "Parent task is invalid." };
  }

  const assigneeResult = await query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [assignedToId]
  );

  if (!assigneeResult.rows[0]) {
    return { error: "Assigned user is invalid." };
  }

  const result = await query<{ id: string }>(
    `INSERT INTO subtasks (task_id, title, assigned_to_id, start_date, due_date, priority, status)
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       CASE
         WHEN $7::text <> 'done' AND $5::date IS NOT NULL AND $5::date < current_date THEN 'overdue'
         WHEN $7::text = 'overdue' THEN 'todo'
         ELSE $7::text
       END
     )
     RETURNING id`,
    [taskId, title, assignedToId, startDate || null, dueDate || null, priority, status]
  );
  await createWorkItemLog({
    action: "created",
    actorId: user.id,
    body: `Sub-task "${title}" was created.`,
    subtaskId: result.rows[0].id,
    taskId
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Sub-task has been created." };
}

export async function updateSubtaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireManageTask();
  const projectId = asString(formData, "projectId");
  const taskId = asString(formData, "taskId");
  const subtaskId = asString(formData, "subtaskId");
  const title = asString(formData, "title");
  const assignedToId = asString(formData, "assignedToId");
  const startDate = asString(formData, "startDate");
  const dueDate = asString(formData, "dueDate");
  const priority = normalizeTaskPriority(asString(formData, "priority"));
  const status = normalizeTaskStatus(asString(formData, "status"));

  if (!projectId || !taskId || !subtaskId) {
    return { error: "Sub-task is missing." };
  }

  if (!title) {
    return { error: "Please enter a sub-task title." };
  }

  if (!assignedToId) {
    return { error: "Please choose who this sub-task is assigned to." };
  }

  if (startDate && dueDate && dueDate < startDate) {
    return { error: "Sub-task due date cannot be earlier than the start date." };
  }

  const assigneeResult = await query<{ email: string; id: string; name: string | null }>(
    "SELECT id, name, email::text AS email FROM users WHERE id = $1 AND archived_at IS NULL LIMIT 1",
    [assignedToId]
  );
  const assignee = assigneeResult.rows[0];

  if (!assignee) {
    return { error: "Assigned user is invalid." };
  }

  const currentResult = await query<{
    assigned_to_email: string;
    assigned_to_id: string;
    assigned_to_name: string | null;
    due_date: Date | string | null;
    priority: string;
    start_date: Date | string | null;
    status: string;
    title: string;
  }>(
    `SELECT
       subtasks.title,
       subtasks.assigned_to_id,
       users.name AS assigned_to_name,
       users.email::text AS assigned_to_email,
       subtasks.start_date,
       subtasks.due_date,
       subtasks.priority,
       subtasks.status
     FROM subtasks
     JOIN tasks ON tasks.id = subtasks.task_id
     JOIN users ON users.id = subtasks.assigned_to_id
     WHERE subtasks.id = $1
       AND subtasks.task_id = $2
       AND tasks.project_id = $3
       AND subtasks.archived_at IS NULL
       AND tasks.archived_at IS NULL
     LIMIT 1`,
    [subtaskId, taskId, projectId]
  );
  const current = currentResult.rows[0];

  if (!current) {
    return { error: "Sub-task was not found." };
  }

  const result = await query<{ id: string; status: string }>(
    `UPDATE subtasks
     SET title = $1,
         assigned_to_id = $2,
         start_date = $3,
         due_date = $4,
         priority = $5,
         status = CASE
           WHEN $6::text <> 'done' AND $4::date IS NOT NULL AND $4::date < current_date THEN 'overdue'
           WHEN $6::text = 'overdue' THEN 'todo'
           ELSE $6::text
         END,
         updated_at = now()
     FROM tasks
     WHERE subtasks.id = $7
       AND subtasks.task_id = $8
       AND tasks.id = subtasks.task_id
       AND tasks.project_id = $9
       AND subtasks.archived_at IS NULL
       AND tasks.archived_at IS NULL
     RETURNING subtasks.id, subtasks.status`,
    [title, assignedToId, startDate || null, dueDate || null, priority, status, subtaskId, taskId, projectId]
  );

  if (!result.rows[0]) {
    return { error: "Sub-task was not found." };
  }

  const logs = getWorkItemChangeLogs({
    assignedTo: assignee,
    current,
    dueDate,
    priority,
    startDate,
    status: result.rows[0].status,
    title
  });

  for (const body of logs) {
    await createWorkItemLog({ action: "updated", actorId: user.id, body, subtaskId, taskId });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Sub-task has been updated." };
}

export async function archiveSubtaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireManageTask();
  const projectId = asString(formData, "projectId");
  const taskId = asString(formData, "taskId");
  const subtaskId = asString(formData, "subtaskId");

  if (!projectId || !taskId || !subtaskId) {
    return { error: "Sub-task is missing." };
  }

  const result = await query<{ title: string }>(
    `UPDATE subtasks
     SET archived_at = now(),
         updated_at = now()
     FROM tasks
     WHERE subtasks.id = $1
       AND subtasks.task_id = $2
       AND tasks.id = subtasks.task_id
      AND tasks.project_id = $3
      AND subtasks.archived_at IS NULL
     RETURNING subtasks.title`,
    [subtaskId, taskId, projectId]
  );
  const subtask = result.rows[0];

  if (subtask) {
    await createWorkItemLog({
      action: "archived",
      actorId: user.id,
      body: `Sub-task "${subtask.title}" was archived.`,
      subtaskId,
      taskId
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Sub-task has been archived." };
}

export async function archiveTaskAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireManageTask();
  const taskId = asString(formData, "taskId");
  const projectId = asString(formData, "projectId");

  if (!taskId || !projectId) {
    return { error: "Task is missing." };
  }

  const result = await query<{ title: string }>(
    `UPDATE tasks
     SET archived_at = now(), updated_at = now()
     WHERE id = $1 AND project_id = $2 AND archived_at IS NULL
     RETURNING title`,
    [taskId, projectId]
  );
  const task = result.rows[0];

  if (task) {
    await createWorkItemLog({
      action: "archived",
      actorId: user.id,
      body: `Task "${task.title}" was archived.`,
      taskId
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Task has been archived." };
}

export async function updateTaskStatusAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const taskId = asString(formData, "taskId");
  const projectId = asString(formData, "projectId");
  const status = normalizeTaskStatus(asString(formData, "status"));

  if (!taskId || !projectId) {
    return { error: "Task is missing." };
  }

  const currentResult = await query<{ status: string }>(
    "SELECT status FROM tasks WHERE id = $1 AND project_id = $2 AND archived_at IS NULL LIMIT 1",
    [taskId, projectId]
  );
  const current = currentResult.rows[0];

  const result = await query<{
    id: string;
    title: string;
    status: string;
    owner_id: string | null;
  }>(
    `UPDATE tasks
     SET status = CASE
           WHEN $1::text <> 'done' AND tasks.due_date IS NOT NULL AND tasks.due_date < current_date THEN 'overdue'
           WHEN $1::text = 'overdue' THEN 'todo'
           ELSE $1::text
         END,
         updated_at = now()
     FROM projects
     WHERE tasks.id = $2
       AND tasks.project_id = $3
       AND projects.id = tasks.project_id
       AND tasks.archived_at IS NULL
       AND projects.archived_at IS NULL
     RETURNING tasks.id, tasks.title, tasks.status, projects.owner_id`,
    [status, taskId, projectId]
  );
  const task = result.rows[0];

  if (!task) {
    return { error: "Task was not found." };
  }

  if (current && current.status !== task.status) {
    await createWorkItemLog({
      action: "status_changed",
      actorId: user.id,
      body: `Status changed from ${normalizeLogValue(current.status)} to ${normalizeLogValue(task.status)}.`,
      taskId
    });
  }

  await createNotifications({
    actorId: user.id,
    body: `${task.title} is now ${task.status.replaceAll("_", " ")}.`,
    projectId,
    recipients: [task.owner_id ?? ""].filter(Boolean),
    taskId,
    title: `${user.name ?? user.email} changed ${task.title} status`,
    type: "status_changed"
  });

  revalidatePath("/notifications");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Status updated." };
}

export async function updateSubtaskStatusAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const projectId = asString(formData, "projectId");
  const taskId = asString(formData, "taskId");
  const subtaskId = asString(formData, "subtaskId");
  const status = normalizeTaskStatus(asString(formData, "status"));

  if (!projectId || !taskId || !subtaskId) {
    return { error: "Sub-task is missing." };
  }

  const currentResult = await query<{ status: string }>(
    `SELECT subtasks.status
     FROM subtasks
     JOIN tasks ON tasks.id = subtasks.task_id
     WHERE subtasks.id = $1
       AND subtasks.task_id = $2
       AND tasks.project_id = $3
       AND subtasks.archived_at IS NULL
       AND tasks.archived_at IS NULL
     LIMIT 1`,
    [subtaskId, taskId, projectId]
  );
  const current = currentResult.rows[0];

  const result = await query<{
    id: string;
    title: string;
    status: string;
    owner_id: string | null;
  }>(
    `UPDATE subtasks
     SET status = CASE
           WHEN $1::text <> 'done' AND subtasks.due_date IS NOT NULL AND subtasks.due_date < current_date THEN 'overdue'
           WHEN $1::text = 'overdue' THEN 'todo'
           ELSE $1::text
         END,
         updated_at = now()
     FROM tasks
     JOIN projects ON projects.id = tasks.project_id
     WHERE subtasks.id = $2
       AND subtasks.task_id = $3
       AND tasks.id = subtasks.task_id
       AND tasks.project_id = $4
       AND subtasks.archived_at IS NULL
       AND tasks.archived_at IS NULL
       AND projects.archived_at IS NULL
     RETURNING subtasks.id, subtasks.title, subtasks.status, projects.owner_id`,
    [status, subtaskId, taskId, projectId]
  );
  const subtask = result.rows[0];

  if (!subtask) {
    return { error: "Sub-task was not found." };
  }

  if (current && current.status !== subtask.status) {
    await createWorkItemLog({
      action: "status_changed",
      actorId: user.id,
      body: `Status changed from ${normalizeLogValue(current.status)} to ${normalizeLogValue(subtask.status)}.`,
      subtaskId,
      taskId
    });
  }

  await createNotifications({
    actorId: user.id,
    body: `${subtask.title} is now ${subtask.status.replaceAll("_", " ")}.`,
    projectId,
    recipients: [subtask.owner_id ?? ""].filter(Boolean),
    subtaskId,
    taskId,
    title: `${user.name ?? user.email} changed ${subtask.title} status`,
    type: "status_changed"
  });

  revalidatePath("/notifications");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { message: "Status updated." };
}

export async function createTaskCommentAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const projectId = asString(formData, "projectId");
  const taskId = asString(formData, "taskId");
  const body = asString(formData, "body");

  if (!projectId || !taskId) {
    return { error: "Task is missing." };
  }

  if (!body) {
    return { error: "Write a message before sending." };
  }

  const taskResult = await query<{
    id: string;
    title: string;
    assigned_to_id: string;
    owner_id: string | null;
  }>(
    `SELECT tasks.id, tasks.title, tasks.assigned_to_id, projects.owner_id
     FROM tasks
     JOIN projects ON projects.id = tasks.project_id
     WHERE tasks.id = $1
       AND tasks.project_id = $2
       AND tasks.archived_at IS NULL
       AND projects.archived_at IS NULL
     LIMIT 1`,
    [taskId, projectId]
  );
  const task = taskResult.rows[0];

  if (!task) {
    return { error: "Task was not found." };
  }

  const commentResult = await query<{ id: string }>(
    "INSERT INTO task_comments (task_id, author_id, body) VALUES ($1, $2, $3) RETURNING id",
    [taskId, user.id, body]
  );
  const mentionedUserIds = await getMentionedUserIds(body);

  await createNotifications({
    actorId: user.id,
    body,
    projectId,
    recipients: [task.assigned_to_id, task.owner_id ?? "", ...mentionedUserIds].filter(Boolean),
    taskCommentId: commentResult.rows[0].id,
    taskId,
    title: `${user.name ?? user.email} commented on ${task.title}`,
    type: "comment_added"
  });

  revalidatePath("/notifications");
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function createSubtaskCommentAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const projectId = asString(formData, "projectId");
  const taskId = asString(formData, "taskId");
  const subtaskId = asString(formData, "subtaskId");
  const body = asString(formData, "body");

  if (!projectId || !taskId || !subtaskId) {
    return { error: "Sub-task is missing." };
  }

  if (!body) {
    return { error: "Write a message before sending." };
  }

  const subtaskResult = await query<{
    id: string;
    title: string;
    assigned_to_id: string;
    owner_id: string | null;
  }>(
    `SELECT subtasks.id, subtasks.title, subtasks.assigned_to_id, projects.owner_id
     FROM subtasks
     JOIN tasks ON tasks.id = subtasks.task_id
     JOIN projects ON projects.id = tasks.project_id
     WHERE subtasks.id = $1
       AND subtasks.task_id = $2
       AND tasks.project_id = $3
       AND subtasks.archived_at IS NULL
       AND tasks.archived_at IS NULL
       AND projects.archived_at IS NULL
     LIMIT 1`,
    [subtaskId, taskId, projectId]
  );
  const subtask = subtaskResult.rows[0];

  if (!subtask) {
    return { error: "Sub-task was not found." };
  }

  const commentResult = await query<{ id: string }>(
    "INSERT INTO subtask_comments (subtask_id, author_id, body) VALUES ($1, $2, $3) RETURNING id",
    [subtaskId, user.id, body]
  );
  const mentionedUserIds = await getMentionedUserIds(body);

  await createNotifications({
    actorId: user.id,
    body,
    projectId,
    recipients: [subtask.assigned_to_id, subtask.owner_id ?? "", ...mentionedUserIds].filter(Boolean),
    subtaskCommentId: commentResult.rows[0].id,
    subtaskId,
    taskId,
    title: `${user.name ?? user.email} commented on ${subtask.title}`,
    type: "comment_added"
  });

  revalidatePath("/notifications");
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = asString(formData, "notificationId");

  if (!notificationId) {
    return;
  }

  await query("UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2", [
    notificationId,
    user.id
  ]);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();

  await query("UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE user_id = $1 AND read_at IS NULL", [
    user.id
  ]);
  revalidatePath("/notifications");
}

export async function createUserAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();

  const name = asString(formData, "name");
  const email = asString(formData, "email").toLowerCase();
  const category = normalizeCategory(asString(formData, "category"));
  const role = normalizeRole(asString(formData, "role"));

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
      "INSERT INTO users (name, email, password_hash, role, category) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [name, email, await bcrypt.hash(randomToken(), 12), role, category]
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

export async function updateUserProfileAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const user = await requireUser();
  const name = asString(formData, "name");
  const email = asString(formData, "email").toLowerCase();
  const category = normalizeCategory(asString(formData, "category"));

  if (!name) {
    return { error: "Please enter a name." };
  }

  if (!validateEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  try {
    await query("UPDATE users SET name = $1, email = $2, category = $3, updated_at = now() WHERE id = $4", [
      name,
      email,
      category,
      user.id
    ]);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return { error: "This email is already registered." };
    }

    return { error: "Profile could not be updated." };
  }

  revalidatePath("/profile");
  revalidatePath("/team");
  return { message: "Profile updated." };
}

export async function adminUpdateUserAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  await requireAdmin();
  const userId = asString(formData, "userId");
  const name = asString(formData, "name");
  const category = normalizeCategory(asString(formData, "category"));
  const role = normalizeRole(asString(formData, "role"));

  if (!userId) {
    return { error: "User is missing." };
  }

  if (!name) {
    return { error: "Please enter a name." };
  }

  await query(
    `UPDATE users
     SET name = $1,
         category = $2,
         role = CASE WHEN role = 'admin' THEN role ELSE $3 END,
         updated_at = now()
     WHERE id = $4
       AND archived_at IS NULL`,
    [name, category, role, userId]
  );

  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { message: "User updated." };
}

export async function adminArchiveUserAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const currentUser = await requireAdmin();
  const userId = asString(formData, "userId");

  if (!userId) {
    return { error: "User is missing." };
  }

  if (userId === currentUser.id) {
    return { error: "You cannot archive your own account." };
  }

  await query(
    `UPDATE users
     SET archived_at = now(),
         updated_at = now()
     WHERE id = $1
       AND role <> 'admin'
       AND archived_at IS NULL`,
    [userId]
  );
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);

  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { message: "User archived." };
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
