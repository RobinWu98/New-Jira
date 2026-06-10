import { redirect } from "next/navigation";
import { TwoFactorLoginForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";
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
        <PageHeader title="Svida Job Tracker" />
        <section className="panel auth-panel">
          <h2>Two-Factor Check</h2>
          <TwoFactorLoginForm />
        </section>
      </div>
    </main>
  );
}
