import { ChangePasswordForm } from "@/components/AuthForms";
import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await requireUser();

  return (
    <AppFrame>
      <header className="masthead">
        <h1>Svida Job Tracker</h1>
        <p>Keep the account desk locked. Change your password when it feels stale or exposed.</p>
        <nav className="nav">
          <a href="/dashboard">Account Home</a>
        </nav>
      </header>
      <section className="panel">
        <h2>Change Password</h2>
        <div className="notice">For account safety, enter your current password first.</div>
        <div className="table-like compact">
          <div>
            <strong>Account</strong>
            <span>{user.email}</span>
          </div>
          <div>
            <strong>Requirement</strong>
            <span>New password must be at least 8 characters</span>
          </div>
        </div>
        <ChangePasswordForm />
      </section>
    </AppFrame>
  );
}
