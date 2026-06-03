import crypto from "crypto";
import { generateSecret as generateTotpSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { hashToken, randomToken } from "./crypto";
import { query } from "./db";

const ISSUER = "Svida Job Tracker";
const SECRET_KEY_BYTES = 32;
const BACKUP_CODE_COUNT = 8;

function getEncryptionKey() {
  const rawKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY is required to use two-factor authentication.");
  }

  const decoded = Buffer.from(rawKey, "base64");

  if (decoded.length === SECRET_KEY_BYTES) {
    return decoded;
  }

  if (rawKey.length >= SECRET_KEY_BYTES) {
    return crypto.createHash("sha256").update(rawKey).digest();
  }

  throw new Error("TWO_FACTOR_ENCRYPTION_KEY must be a 32-byte base64 value or at least 32 characters.");
}

export function encryptSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(encryptedSecret: string) {
  const [ivValue, authTagValue, encryptedValue] = encryptedSecret.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Two-factor secret is not in the expected encrypted format.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function generateSecret() {
  return generateTotpSecret();
}

export function verifyTotp(secret: string, code: string) {
  const token = code.replace(/\s/g, "");

  if (!/^\d{6}$/.test(token)) {
    return false;
  }

  try {
    return verifySync({
      secret,
      token,
      strategy: "totp",
      epochTolerance: 30
    }).valid;
  } catch {
    return false;
  }
}

export async function createSetupQrCode(email: string, secret: string) {
  const otpauth = generateURI({
    issuer: ISSUER,
    label: email,
    secret,
    strategy: "totp"
  });
  return QRCode.toDataURL(otpauth, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220
  });
}

export function generateBackupCodes() {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${code.slice(0, 5)}-${code.slice(5, 10)}`;
  });
}

export async function replaceBackupCodes(userId: string, codes: string[]) {
  await query("DELETE FROM two_factor_backup_codes WHERE user_id = $1", [userId]);

  for (const code of codes) {
    await query("INSERT INTO two_factor_backup_codes (user_id, code_hash) VALUES ($1, $2)", [
      userId,
      hashToken(normalizeBackupCode(code))
    ]);
  }
}

export async function consumeBackupCode(userId: string, code: string) {
  const normalizedCode = normalizeBackupCode(code);

  if (!normalizedCode) {
    return false;
  }

  const result = await query<{ id: string }>(
    `UPDATE two_factor_backup_codes
     SET used_at = now()
     WHERE id = (
       SELECT id
       FROM two_factor_backup_codes
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       LIMIT 1
     )
     RETURNING id`,
    [userId, hashToken(normalizedCode)]
  );

  return Boolean(result.rows[0]);
}

export function normalizeBackupCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function looksLikeBackupCode(code: string) {
  return normalizeBackupCode(code).length >= 8;
}
