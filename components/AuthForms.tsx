"use client";

import { useActionState, useEffect, useState } from "react";
import {
  type AuthActionState,
  adminArchiveUserAction,
  adminUpdateUserAction,
  beginTwoFactorSetupAction,
  changePasswordAction,
  clearPinDeviceAction,
  completeInvitedRegistrationAction,
  confirmTwoFactorSetupAction,
  createUserAction,
  disableTwoFactorAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  setupPinAction,
  updateUserProfileAction,
  verifyPinLoginAction,
  verifyLoginTwoFactorAction
} from "@/lib/actions";
import { SubmitButton } from "./FormStatus";
import { UiButton } from "./UiControls";

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
        <a className="forgot-password-link" href="/forgot-password">Forgot Password</a>
      </div>
      <div className="button-row">
        <SubmitButton>Log In</SubmitButton>
      </div>
    </form>
  );
}

export function AdminCreateUserForm() {
  const [createState, createAction] = useActionState(createUserAction, initialState);

  return (
    <form action={createAction}>
      <Feedback state={createState} />
      <div className="form-row">
        <label htmlFor="admin-name">Name</label>
        <input id="admin-name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="form-row">
        <label htmlFor="admin-email">Email</label>
        <input id="admin-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="form-row">
        <label htmlFor="admin-category">Category</label>
        <select id="admin-category" name="category" defaultValue="Business">
          <option value="IT">IT</option>
          <option value="Sales">Sales</option>
          <option value="Support">Support</option>
          <option value="Business">Business</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="admin-role">Permission</label>
        <select id="admin-role" name="role" defaultValue="staff">
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div className="button-row">
        <SubmitButton>Send Registration Email</SubmitButton>
      </div>
    </form>
  );
}

export function AdminCreateUserModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <UiButton type="button" onClick={() => setIsOpen(true)}>
        Create User
      </UiButton>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="modal-header">
              <h2 id="create-user-title">Create User</h2>
              <UiButton variant="secondary" type="button" onClick={() => setIsOpen(false)}>
                Close
              </UiButton>
            </div>
            <AdminCreateUserForm />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AdminUpdateUserForm({
  user,
  showRole = true
}: {
  user: { id: string; name: string | null; email: string; role: string; category: string | null };
  showRole?: boolean;
}) {
  const [state, action] = useActionState(adminUpdateUserAction, initialState);

  return (
    <form action={action} className="admin-user-edit-form">
      <Feedback state={state} />
      <input name="userId" type="hidden" value={user.id} />
      <label className="sr-only" htmlFor={`${user.id}-admin-name`}>
        Name
      </label>
      <input id={`${user.id}-admin-name`} name="name" type="text" defaultValue={user.name ?? ""} required />
      <label className="sr-only" htmlFor={`${user.id}-admin-category`}>
        Department
      </label>
      <select id={`${user.id}-admin-category`} name="category" defaultValue={user.category ?? "Business"}>
        <option value="IT">IT</option>
        <option value="Sales">Sales</option>
        <option value="Support">Support</option>
        <option value="Business">Business</option>
      </select>
      {showRole ? (
        user.role === "admin" ? (
          <>
            <label className="sr-only" htmlFor={`${user.id}-admin-role`}>
              Permission
            </label>
            <div className="readonly-field">{user.role}</div>
            <input name="role" type="hidden" value={user.role} />
          </>
        ) : (
          <>
            <label className="sr-only" htmlFor={`${user.id}-admin-role`}>
              Permission
            </label>
            <select id={`${user.id}-admin-role`} name="role" defaultValue={user.role === "manager" ? "manager" : "staff"}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </>
        )
      ) : null}
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

export function AdminArchiveUserForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(adminArchiveUserAction, initialState);

  if (role === "admin") {
    return null;
  }

  return (
    <form action={action} className="inline-action-form">
      <Feedback state={state} />
      <input name="userId" type="hidden" value={userId} />
      <UiButton variant="danger" type="submit">
        Archive
      </UiButton>
    </form>
  );
}

function ProfileForm({
  user
}: {
  user: { category: string | null; email: string; name: string | null; role: string };
}) {
  const [state, action] = useActionState(updateUserProfileAction, initialState);
  const canEditDepartment = user.role !== "staff";

  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-row">
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" name="name" type="text" defaultValue={user.name ?? ""} required />
      </div>
      <div className="form-row">
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" name="email" type="email" defaultValue={user.email} required />
      </div>
      <div className="form-row">
        <label htmlFor="profile-category">Department</label>
        {canEditDepartment ? (
          <select id="profile-category" name="category" defaultValue={user.category ?? "Business"}>
            <option value="IT">IT</option>
            <option value="Sales">Sales</option>
            <option value="Support">Support</option>
            <option value="Business">Business</option>
          </select>
        ) : (
          <div className="readonly-field" id="profile-category">
            {user.category || "Unassigned"}
          </div>
        )}
      </div>
          <div className="button-row">
        <SubmitButton>Update Profile</SubmitButton>
      </div>
    </form>
  );
}

export function ProfileEditModal({
  user
}: {
  user: { category: string | null; email: string; name: string | null; role: string };
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <UiButton type="button" onClick={() => setIsOpen(true)}>
        Edit Profile
      </UiButton>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="edit-profile-title">Edit Profile</h2>
              </div>
              <UiButton variant="secondary" type="button" onClick={() => setIsOpen(false)}>
                Close
              </UiButton>
            </div>
            <ProfileForm user={user} />
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

export function TwoFactorLoginForm() {
  const [state, action] = useActionState(verifyLoginTwoFactorAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
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
      <div className="notice">After this check, this browser will not ask for 2FA again for 30 days.</div>
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

export function PinSetupForm({ enabled, redirectTo }: { enabled: boolean; redirectTo?: string }) {
  const [state, action] = useActionState(setupPinAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      {redirectTo ? <input name="redirectTo" type="hidden" value={redirectTo} /> : null}
      <input name="hasCurrentPin" type="hidden" value={enabled ? "true" : "false"} />
      {enabled ? (
        <div className="form-row">
          <label htmlFor="currentPin">Current PIN</label>
          <input
            autoComplete="off"
            id="currentPin"
            inputMode="numeric"
            maxLength={4}
            minLength={4}
            name="currentPin"
            pattern="[0-9]{4}"
            required
            type="password"
          />
        </div>
      ) : null}
      <div className="form-row">
        <label htmlFor="newPin">New PIN</label>
        <input
          autoComplete="off"
          id="newPin"
          inputMode="numeric"
          maxLength={4}
          minLength={4}
          name="newPin"
          pattern="[0-9]{4}"
          required
          type="password"
        />
        <p className="small">4 digits required.</p>
      </div>
      <div className="form-row">
        <label htmlFor="confirmNewPin">Confirm New PIN</label>
        <input
          autoComplete="off"
          id="confirmNewPin"
          inputMode="numeric"
          maxLength={4}
          minLength={4}
          name="confirmNewPin"
          pattern="[0-9]{4}"
          required
          type="password"
        />
      </div>
      <div className="button-row">
        <SubmitButton>{enabled ? "Reset PIN" : "Confirm PIN"}</SubmitButton>
      </div>
    </form>
  );
}

export function PinLoginForm({ user }: { user: { email: string; name: string | null } }) {
  const [pin, setPin] = useState("");
  const [state, action] = useActionState(verifyPinLoginAction, initialState);
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  function addDigit(value: string) {
    setPin((current) => (current.length < 4 ? `${current}${value}` : current));
  }

  return (
    <div className="pin-console" aria-label="PIN unlock">
      <div className="pin-account">
        <span>Quick unlock</span>
        <strong>{user.name || user.email}</strong>
      </div>
      <form action={action}>
        <Feedback state={state} />
        <input name="pin" type="hidden" value={pin} />
        <div className="pin-display" aria-label={`${pin.length} of 4 PIN digits entered`}>
          {[0, 1, 2, 3].map((slot) => (
            <span className={slot < pin.length ? "is-filled" : ""} key={slot} />
          ))}
        </div>
        <div className="pin-keypad" aria-label="PIN keypad">
          {numbers.map((number) => (
            <button key={number} onClick={() => addDigit(number)} type="button">
              {number}
            </button>
          ))}
          <button onClick={() => setPin("")} type="button">
            C
          </button>
          <button onClick={() => addDigit("0")} type="button">
            0
          </button>
          <button onClick={() => setPin((current) => current.slice(0, -1))} type="button">
            Del
          </button>
        </div>
        <div className="button-row pin-actions">
          <SubmitButton disabled={pin.length !== 4}>Unlock</SubmitButton>
          <button className="button secondary" formAction={clearPinDeviceAction} type="submit">
            Use Password Login
          </button>
        </div>
      </form>
    </div>
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
      <div className="form-row">
        <label htmlFor="confirmNewPassword">Confirm New Password</label>
        <input id="confirmNewPassword" name="confirmNewPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="button-row">
        <SubmitButton>Password Reset</SubmitButton>
      </div>
    </form>
  );
}

export function TwoFactorSetupForm({ redirectOnComplete = false }: { redirectOnComplete?: boolean }) {
  const [setupState, setupAction] = useActionState(beginTwoFactorSetupAction, initialState);
  const [confirmState, confirmAction] = useActionState(confirmTwoFactorSetupAction, initialState);

  useEffect(() => {
    if (!redirectOnComplete || !confirmState.message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.location.assign("/main-page");
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [confirmState.message, redirectOnComplete]);

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
