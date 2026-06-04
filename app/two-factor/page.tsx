import { redirect } from "next/navigation";
import { TwoFactorLoginForm } from "@/components/AuthForms";
import { getCurrentUser, getTwoFactorChallengeUser } from "@/lib/auth";

export default async function TwoFactorPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/main-page");
  }

  const challengeUser = await getTwoFactorChallengeUser();

  if (!challengeUser) {
    redirect("/login");
  }

  return (
    <main className="page">
      <div className="shell login-shell">
        <header className="masthead">
          <h1>Svida Job Tracker</h1>
        </header>
        <section className="panel auth-panel">
          <h2>Two-Factor Check</h2>
          <TwoFactorLoginForm />
        </section>
      </div>
    </main>
  );
}
