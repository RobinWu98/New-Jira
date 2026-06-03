# Two-Factor Authentication Design

## Purpose

Two-factor authentication adds a second proof of account ownership after the password step. The goal is to protect user sessions even when a password is guessed, reused, or leaked.

This project uses a self-managed authentication stack with Next.js server actions, PostgreSQL, bcrypt password hashes, and HTTP-only session cookies. The 2FA design follows that existing architecture instead of replacing authentication with a hosted identity provider.

## Chosen Method

The app uses TOTP, the time-based one-time password standard supported by authenticator apps such as Google Authenticator, Microsoft Authenticator, 1Password, Authy, and similar tools.

TOTP was selected because:

- It does not require phone numbers.
- It avoids SMS delivery cost and SIM swap risk.
- It works with standard authenticator apps.
- It can be verified locally by the application.
- It fits the current self-hosted authentication model.

SMS 2FA and hosted identity services were intentionally avoided for this stage. SMS would add cost, phone-number handling, delivery failure cases, and weaker security properties. Hosted identity services would require a broader migration of registration, login, sessions, password reset, and account settings.

## User Experience

### Setup Flow

1. A signed-in user opens `settings/two-factor`.
2. The user starts setup.
3. The server generates a TOTP secret and stores it as a pending encrypted secret.
4. The page displays a QR code and a manual setup key.
5. The user scans the QR code with an authenticator app.
6. The user enters the 6-digit code from the app.
7. If the code is valid, 2FA is enabled.
8. The app generates recovery codes and shows them once.

The account is not marked as 2FA-enabled until the confirmation code succeeds. This prevents users from locking themselves out with an unverified setup.

### Login Flow

1. The user submits email and password on the login page.
2. If the password is invalid, the login fails normally.
3. If the password is valid and 2FA is not enabled, the app creates a normal session.
4. If the password is valid and 2FA is enabled, the app creates a short-lived 2FA challenge instead of a full session.
5. The user is redirected to `two-factor`.
6. The user submits a 6-digit authenticator code or one recovery code.
7. If the code is valid, the challenge is cleared and a full session is created.
8. If the code is invalid, the page shows a form error without creating a session.

### Disable Flow

1. A signed-in user opens `settings/two-factor`.
2. The user enters the current password and a current authenticator code.
3. If both checks pass, the app disables 2FA.
4. Stored TOTP secrets, pending setup secrets, backup codes, and outstanding 2FA challenges are removed.

## Implementation

### Dependencies

- `otplib`: Generates TOTP secrets, creates TOTP provisioning URIs, and verifies submitted codes.
- `qrcode`: Converts the TOTP provisioning URI into a QR code data URL.

### Core Files

- `lib/two-factor.ts`
  - Generates TOTP secrets.
  - Creates QR code data URLs.
  - Encrypts and decrypts TOTP secrets.
  - Validates 6-digit TOTP codes.
  - Generates, hashes, stores, and consumes recovery codes.

- `lib/auth.ts`
  - Creates normal sessions.
  - Creates short-lived 2FA challenges after password verification.
  - Reads and clears 2FA challenge cookies.

- `lib/actions.ts`
  - Starts 2FA setup.
  - Confirms 2FA setup.
  - Verifies 2FA during login.
  - Disables 2FA.

- `components/AuthForms.tsx`
  - Renders the setup, login verification, and disable forms.

- `app/settings/two-factor/page.tsx`
  - Account settings page for enabling or disabling 2FA.

- `app/two-factor/page.tsx`
  - Login continuation page for 2FA verification.

### Database Model

The `users` table stores 2FA account state:

- `two_factor_enabled`
- `two_factor_secret`
- `two_factor_pending_secret`
- `two_factor_confirmed_at`

The `two_factor_challenges` table stores temporary login challenges:

- `user_id`
- `token_hash`
- `expires_at`
- `created_at`

The `two_factor_backup_codes` table stores one-time recovery codes:

- `user_id`
- `code_hash`
- `used_at`
- `created_at`

Only hashes of challenge tokens and recovery codes are stored. TOTP secrets are encrypted before storage.

### Secret Encryption

TOTP secrets are encrypted with AES-256-GCM before being stored. The encryption key comes from `TWO_FACTOR_ENCRYPTION_KEY`.

For production, this value should be generated as a 32-byte base64 secret and managed as a real deployment secret. It must not be committed with production credentials.

### Recovery Codes

Recovery codes are generated when 2FA setup is confirmed. They are displayed once and stored only as hashes. During login, a recovery code can be used instead of a TOTP code. Successful use marks the recovery code as used.

## Security Properties

- Password verification alone does not create a session for 2FA-enabled accounts.
- 2FA challenge cookies are HTTP-only, same-site, short-lived, and separate from full session cookies.
- Challenge tokens are hashed in the database.
- Recovery codes are hashed in the database.
- TOTP secrets are encrypted in the database.
- Invalid or malformed TOTP codes are handled as ordinary validation failures.
- Pending setup secrets do not enable 2FA until the user proves they can generate a valid code.

## Current Limits

- There is no rate limiting on repeated 2FA attempts yet.
- Recovery codes cannot currently be regenerated from the settings page.
- There is no audit log for 2FA enable, disable, or recovery-code use.
- There is no step-up authentication requirement for sensitive future actions beyond the disable flow.

## Future Improvements

- Add rate limiting for password login and 2FA challenge attempts.
- Add recovery-code regeneration.
- Add account security event logging.
- Add email notification when 2FA is enabled or disabled.
- Add backup-code count status on the settings page.
- Add tests for setup, login challenge, invalid PIN handling, recovery-code use, and disable flow.
