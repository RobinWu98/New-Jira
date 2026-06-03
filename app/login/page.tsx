import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
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
        <header className="masthead">
          <h1>Svida Job Tracker</h1>
        </header>
        <section className="panel auth-panel">
          {reset === "success" ? (
            <div className="notice success">Password updated. Log in with your new password.</div>
          ) : null}
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
