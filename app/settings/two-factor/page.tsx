import { DisableTwoFactorForm, TwoFactorSetupForm } from "@/components/AuthForms";
import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function TwoFactorSettingsPage() {
  const user = await requireUser();
  const result = await query<{ two_factor_enabled: boolean; two_factor_confirmed_at: Date | null }>(
    "SELECT two_factor_enabled, two_factor_confirmed_at FROM users WHERE id = $1 LIMIT 1",
    [user.id]
  );
  const settings = result.rows[0];
  const enabled = Boolean(settings?.two_factor_enabled);

  return (
    <AppFrame>
      <header className="masthead">
        <h1>Svida Job Tracker</h1>
        <p>Protect sign-in with an authenticator app.</p>
        <nav className="nav">
          <a href="/dashboard">Account Home</a>
          <a href="/settings/password">Change Password</a>
        </nav>
      </header>
      <section className="panel">
        <h2>Two-Factor Authentication</h2>
        <div className={enabled ? "notice success" : "notice"}>
          {enabled ? "Two-factor authentication is enabled." : "Two-factor authentication is not enabled."}
        </div>
        <div className="table-like compact">
          <div>
            <strong>Account</strong>
            <span>{user.email}</span>
          </div>
          <div>
            <strong>Method</strong>
            <span>Authenticator app using TOTP codes</span>
          </div>
          <div>
            <strong>Status</strong>
            <span>{enabled ? "Required after password login" : "Password login only"}</span>
          </div>
        </div>
        {enabled ? <DisableTwoFactorForm /> : <TwoFactorSetupForm />}
      </section>
    </AppFrame>
  );
}
