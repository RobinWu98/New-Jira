import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashToken, randomToken } from "./crypto";
import { query } from "./db";

const SESSION_COOKIE = "jobtracker_session";
const TWO_FACTOR_CHALLENGE_COOKIE = "jobtracker_2fa_challenge";
const TWO_FACTOR_TRUST_COOKIE = "jobtracker_2fa_trust";
const SESSION_DAYS = 14;
const TWO_FACTOR_CHALLENGE_MINUTES = 10;
const TWO_FACTOR_TRUST_DAYS = 30;

export type UserRole = "admin" | "manager" | "staff";

export type User = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  category: string | null;
  archived_at?: Date | string | null;
};

export async function createSession(userId: string) {
  const token = randomToken();
  const tokenHash = hashToken(token);

  await query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [userId, tokenHash, SESSION_DAYS]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export async function createTwoFactorChallenge(userId: string) {
  const token = randomToken();
  const tokenHash = hashToken(token);

  await query("DELETE FROM two_factor_challenges WHERE user_id = $1 OR expires_at <= now()", [userId]);
  await query(
    "INSERT INTO two_factor_challenges (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)",
    [userId, tokenHash, TWO_FACTOR_CHALLENGE_MINUTES]
  );

  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWO_FACTOR_CHALLENGE_MINUTES * 60
  });
}

export async function createTwoFactorTrust(userId: string) {
  const token = randomToken();
  const tokenHash = hashToken(token);

  await query("DELETE FROM two_factor_trusted_sessions WHERE user_id = $1 AND expires_at <= now()", [userId]);
  await query(
    `INSERT INTO two_factor_trusted_sessions (user_id, token_hash, last_two_factor_at, expires_at)
     VALUES ($1, $2, now(), now() + ($3 || ' days')::interval)`,
    [userId, tokenHash, TWO_FACTOR_TRUST_DAYS]
  );

  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_TRUST_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWO_FACTOR_TRUST_DAYS * 24 * 60 * 60
  });
}

export async function hasValidTwoFactorTrust(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_TRUST_COOKIE)?.value;

  if (!token) {
    return false;
  }

  const result = await query<{ id: string }>(
    `SELECT id
     FROM two_factor_trusted_sessions
     WHERE user_id = $1
       AND token_hash = $2
       AND expires_at > now()
     LIMIT 1`,
    [userId, hashToken(token)]
  );

  return Boolean(result.rows[0]);
}

export async function clearTwoFactorTrust() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_TRUST_COOKIE)?.value;

  if (token) {
    await query("DELETE FROM two_factor_trusted_sessions WHERE token_hash = $1", [hashToken(token)]);
  }

  cookieStore.delete(TWO_FACTOR_TRUST_COOKIE);
}

export async function getTwoFactorChallengeUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const result = await query<User>(
    `SELECT users.id, users.name, users.email, users.role, users.category, users.archived_at
     FROM two_factor_challenges
     JOIN users ON users.id = two_factor_challenges.user_id
     WHERE two_factor_challenges.token_hash = $1
       AND two_factor_challenges.expires_at > now()
       AND users.two_factor_enabled = true
       AND users.archived_at IS NULL
     LIMIT 1`,
    [hashToken(token)]
  );

  return result.rows[0] ?? null;
}

export async function clearTwoFactorChallenge() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;

  if (token) {
    await query("DELETE FROM two_factor_challenges WHERE token_hash = $1", [hashToken(token)]);
  }

  cookieStore.delete(TWO_FACTOR_CHALLENGE_COOKIE);
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TWO_FACTOR_CHALLENGE_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const result = await query<User>(
    `SELECT users.id, users.name, users.email, users.role, users.category, users.archived_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1
       AND sessions.expires_at > now()
       AND users.archived_at IS NULL
     LIMIT 1`,
    [hashToken(token)]
  );

  return result.rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  return user;
}

export function canManageUsers(user: User) {
  return user.role === "admin";
}

export function canCreateProject(user: User) {
  return user.role === "admin" || user.role === "manager";
}

export function canManageProject(user: User) {
  return user.role === "admin";
}

export function canCreateTask(user: User) {
  return user.role === "admin" || user.role === "manager";
}

export function canManageTask(user: User) {
  return user.role === "admin" || user.role === "manager";
}

export function canCreateSubtask() {
  return true;
}

export function canChangeTaskStatus() {
  return true;
}

export function canCommentMention() {
  return true;
}

export async function requireCreateProject() {
  const user = await requireUser();

  if (!canCreateProject(user)) {
    redirect("/profile");
  }

  return user;
}

export async function requireManageProject() {
  const user = await requireUser();

  if (!canManageProject(user)) {
    redirect("/profile");
  }

  return user;
}

export async function requireCreateTask() {
  const user = await requireUser();

  if (!canCreateTask(user)) {
    redirect("/profile");
  }

  return user;
}

export async function requireManageTask() {
  const user = await requireUser();

  if (!canManageTask(user)) {
    redirect("/profile");
  }

  return user;
}
