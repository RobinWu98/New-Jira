import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    redirect("/main-page");
  }

  return (
    <main className="page">
      <div className="shell login-shell">
        <PageHeader title="Svida Job Tracker" />
        <section className="panel auth-panel">
          {reset === "success" ? (
            <div className="notice success">Password updated. Log in with your new password.</div>
          ) : null}
          <LoginForm />
          <div className="login-role-list" aria-label="Test accounts">
            <div>
              <strong>Admin</strong>
              <span>admin@example.com</span>
            </div>
            <div>
              <strong>Manager</strong>
              <span>ava.chen@example.com</span>
            </div>
            <div>
              <strong>Staff</strong>
              <span>mia.rodriguez@example.com</span>
            </div>
            <p>Password for all: <strong>Password123!</strong></p>
          </div>
        </section>
      </div>
    </main>
  );
}
