import { ForgotPasswordForm } from "@/components/AuthForms";

export default function ForgotPasswordPage() {
  return (
    <main className="page">
      <div className="shell">
        <header className="masthead">
          <h1>Svida Job Tracker</h1>
          <p>Start a password recovery request. Reset links expire after 30 minutes.</p>
          <nav className="nav">
            <a href="/login">Back to Login</a>
          </nav>
        </header>
        <section className="panel">
          <h2>Forgot Password</h2>
          <div className="notice">Enter your account email and we will send a reset link if the account exists.</div>
          <div className="table-like compact">
            <div>
              <strong>Step 1</strong>
              <span>Enter the email for your account</span>
            </div>
            <div>
              <strong>Step 2</strong>
              <span>Open the email link and choose a new password</span>
            </div>
          </div>
          <ForgotPasswordForm />
        </section>
      </div>
    </main>
  );
}
