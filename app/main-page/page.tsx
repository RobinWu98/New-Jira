import { AppFrame } from "@/components/AppFrame";
import { TwoFactorSetupForm } from "@/components/AuthForms";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function MainPage() {
  const user = await requireUser();
  const result = await query<{ two_factor_enabled: boolean }>(
    "SELECT two_factor_enabled FROM users WHERE id = $1 LIMIT 1",
    [user.id]
  );
  const needsTwoFactorSetup = !result.rows[0]?.two_factor_enabled;

  return (
    <AppFrame shellClassName="main-page-shell">
      <nav className="main-actions" aria-label="Main navigation">
        <a className="main-action main-action-dashboard" href="/dashboard">
          <img src="/main-nav/dashboard.png" alt="" aria-hidden="true" />
          <span>My Dashboard</span>
        </a>
        <a className="main-action main-action-projects" href="/projects">
          <img src="/main-nav/projects.png" alt="" aria-hidden="true" />
          <span>Projects</span>
        </a>
        <a className="main-action main-action-team" href="/team">
          <img src="/main-nav/team.png" alt="" aria-hidden="true" />
          <span>Team</span>
        </a>
      </nav>
      {needsTwoFactorSetup ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="two-factor-required-title">
            <div className="modal-header">
              <h2 id="two-factor-required-title">Set Up Two-Factor Authentication</h2>
            </div>
            <div className="notice">Use an authenticator app to protect this account before continuing.</div>
            <TwoFactorSetupForm redirectOnComplete />
          </div>
        </div>
      ) : null}
    </AppFrame>
  );
}
