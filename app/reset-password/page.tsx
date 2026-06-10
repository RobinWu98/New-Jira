import { ResetPasswordForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="page">
      <div className="shell">
        <PageHeader
          title="Svida Job Tracker"
          subtitle="File a new password for your account. Reset links are single-purpose and should be used promptly."
        />
        <section className="panel">
          <h2>Reset Password</h2>
          {token ? (
            <>
              <div className="notice">Choose a new password with at least 8 characters. After saving, log in again with the new password.</div>
              <div className="table-like compact">
                <div>
                  <strong>Status</strong>
                  <span>Reset token received</span>
                </div>
                <div>
                  <strong>Next Step</strong>
                  <span>Save a new password</span>
                </div>
              </div>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <>
              <div className="notice error">The reset link is missing a token. Please request a new password reset.</div>
              <div className="button-row">
                <a href="/forgot-password">Request New Reset Link</a>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
