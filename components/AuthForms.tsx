"use client";

import { useActionState, useState } from "react";
import {
  type AuthActionState,
  beginTwoFactorSetupAction,
  changePasswordAction,
  completeInvitedRegistrationAction,
  confirmTwoFactorSetupAction,
  createUserAction,
  disableTwoFactorAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  verifyUserInviteAction,
  verifyLoginTwoFactorAction
} from "@/lib/actions";
import { SubmitButton } from "./FormStatus";

const initialState: AuthActionState = {};

function Feedback({ state }: { state: AuthActionState }) {
  if (state.error) {
    return <div className="notice error">{state.error}</div>;
  }

  if (state.message) {
    return (
      <div className="notice success">
        <div>{state.message}</div>
        {state.resetUrl ? (
          <p className="small">
            Development reset link: <a href={state.resetUrl}>{state.resetUrl}</a>
          </p>
        ) : null}
        {state.verificationCode ? (
          <p className="small">
            Development verification code: <code>{state.verificationCode}</code>
          </p>
        ) : null}
        {state.inviteUrl ? (
          <p className="small">
            Development registration link: <a href={state.inviteUrl}>{state.inviteUrl}</a>
          </p>
        ) : null}
        {state.backupCodes ? (
          <div className="backup-codes" aria-label="Recovery codes">
            {state.backupCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-row">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="form-row">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="small">At least 8 characters. Use something you would not put on a resume.</p>
      </div>
      <div className="button-row">
        <SubmitButton>Create Account</SubmitButton>
        <a href="/login">Already have an account? Log in</a>
      </div>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="form-row">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="button-row">
        <SubmitButton>Log In</SubmitButton>
        <a href="/forgot-password">Forgot Password</a>
      </div>
    </form>
  );
}

export function AdminCreateUserForm() {
  const [createState, createAction] = useActionState(createUserAction, initialState);
  const [verifyState, verifyAction] = useActionState(verifyUserInviteAction, initialState);
  const inviteId = createState.inviteId;

  return (
    <>
      <form action={createAction}>
        <Feedback state={createState} />
        <div className="form-row">
          <label htmlFor="admin-name">Name</label>
          <input id="admin-name" name="name" type="text" autoComplete="name" required disabled={Boolean(inviteId)} />
        </div>
        <div className="form-row">
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" name="email" type="email" autoComplete="email" required disabled={Boolean(inviteId)} />
        </div>
        <div className="form-row">
          <label htmlFor="admin-category">Category</label>
          <select id="admin-category" name="category" defaultValue="Business" disabled={Boolean(inviteId)}>
            <option value="IT">IT</option>
            <option value="Sales">Sales</option>
            <option value="Support">Support</option>
            <option value="Business">Business</option>
          </select>
        </div>
        {!inviteId ? (
          <div className="button-row">
            <SubmitButton>Send Verification Code</SubmitButton>
          </div>
        ) : null}
      </form>

      {inviteId ? (
        <form action={verifyAction} className="stacked-form">
          <Feedback state={verifyState} />
          <input name="inviteId" type="hidden" value={inviteId} />
          <div className="form-row">
            <label htmlFor="admin-code">Verification Code</label>
            <input
              id="admin-code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength={6}
              maxLength={6}
              required
            />
          </div>
          <div className="button-row">
            <SubmitButton>Send Registration Email</SubmitButton>
          </div>
        </form>
      ) : null}
    </>
  );
}

export function AdminCreateUserModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="button" type="button" onClick={() => setIsOpen(true)}>
        Create User
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="modal-header">
              <h2 id="create-user-title">Create User</h2>
              <button className="button secondary" type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>
            <AdminCreateUserForm />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CompleteInvitedRegistrationForm({ token }: { token: string }) {
  const [state, action] = useActionState(completeInvitedRegistrationAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="token" type="hidden" value={token} />
      <div className="form-row">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="small">Minimum 8 characters.</p>
      </div>
      <div className="button-row">
        <SubmitButton>Complete Registration</SubmitButton>
      </div>
    </form>
  );
}

export function TwoFactorLoginForm({ hasPin, canUsePin }: { hasPin: boolean; canUsePin: boolean }) {
  const [state, action] = useActionState(verifyLoginTwoFactorAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      {canUsePin ? (
        <div className="form-row pin-section">
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            name="pin"
            type="password"
            autoComplete="current-password"
            inputMode="numeric"
            pattern="[0-9 ]*"
            minLength={4}
            maxLength={8}
            required
          />
          <p className="small">Your 4-week two-factor session is active, so PIN can finish this sign-in.</p>
        </div>
      ) : !hasPin ? (
        <div className="form-row pin-section">
          <label htmlFor="pin">Create PIN</label>
          <input
            id="pin"
            name="pin"
            type="password"
            autoComplete="new-password"
            inputMode="numeric"
            pattern="[0-9 ]*"
            minLength={4}
            maxLength={8}
            required
          />
          <p className="small">After this first two-factor check, this PIN can pass future two-factor sign-ins.</p>
        </div>
      ) : null}
      {!canUsePin ? (
        <>
          <div className="form-row">
            <label htmlFor="code">Authenticator or Recovery Code</label>
            <input
              id="code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="text"
              required
            />
          </div>
          <div className="notice">
            {hasPin
              ? "Your 4-week two-factor session has expired. Verify once to refresh PIN sign-in."
              : "Enter a 6-digit authenticator code or one recovery code to activate your PIN."}
          </div>
        </>
      ) : (
        <div className="notice">Enter your PIN. Every 4 weeks, you will be asked for authenticator 2FA again.</div>
      )}
      <div className="button-row">
        <SubmitButton>Verify</SubmitButton>
        <a href="/login">Back to Login</a>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-row">
        <label htmlFor="email">Registered Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <p className="small">If the address exists, we will send a password reset link.</p>
      </div>
      <div className="button-row">
        <SubmitButton>Send Reset Email</SubmitButton>
        <a href="/login">Back to Login</a>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="token" type="hidden" value={token} />
      <div className="form-row">
        <label htmlFor="password">New Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="small">Minimum 8 characters.</p>
      </div>
      <div className="button-row">
        <SubmitButton>Save New Password</SubmitButton>
        <a href="/login">Back to Login</a>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-row">
        <label htmlFor="currentPassword">Current Password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="form-row">
        <label htmlFor="newPassword">New Password</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        <p className="small">Minimum 8 characters.</p>
      </div>
      <div className="button-row">
        <SubmitButton>Change Password</SubmitButton>
        <a href="/dashboard">Back to Home</a>
      </div>
    </form>
  );
}

export function TwoFactorSetupForm() {
  const [setupState, setupAction] = useActionState(beginTwoFactorSetupAction, initialState);
  const [confirmState, confirmAction] = useActionState(confirmTwoFactorSetupAction, initialState);

  return (
    <>
      <form action={setupAction}>
        <Feedback state={setupState} />
        {setupState.qrCodeDataUrl ? (
          <div className="qr-panel">
            <img src={setupState.qrCodeDataUrl} alt="Two-factor authentication QR code" />
            <p className="small">Manual key: <code>{setupState.manualKey}</code></p>
          </div>
        ) : null}
        <div className="button-row">
          <SubmitButton>{setupState.qrCodeDataUrl ? "Generate New QR Code" : "Start Setup"}</SubmitButton>
        </div>
      </form>

      {setupState.qrCodeDataUrl ? (
        <form action={confirmAction} className="stacked-form">
          <Feedback state={confirmState} />
          <div className="form-row">
            <label htmlFor="setup-code">Authenticator Code</label>
            <input
              id="setup-code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9 ]*"
              required
            />
          </div>
          <div className="button-row">
            <SubmitButton>Enable Two-Factor</SubmitButton>
          </div>
        </form>
      ) : null}
    </>
  );
}

export function DisableTwoFactorForm() {
  const [state, action] = useActionState(disableTwoFactorAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-row">
        <label htmlFor="disable-password">Current Password</label>
        <input
          id="disable-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor="disable-code">Authenticator Code</label>
        <input
          id="disable-code"
          name="code"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]*"
          required
        />
      </div>
      <div className="button-row">
        <SubmitButton>Disable Two-Factor</SubmitButton>
        <a href="/dashboard">Back to Home</a>
      </div>
    </form>
  );
}
