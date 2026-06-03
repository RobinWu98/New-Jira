import { redirect } from "next/navigation";
import { TwoFactorLoginForm } from "@/components/AuthForms";
import { getCurrentUser, getTwoFactorChallengeUser, hasValidTwoFactorTrust } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function TwoFactorPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/main-page");
  }

  const challengeUser = await getTwoFactorChallengeUser();

  if (!challengeUser) {
    redirect("/login");
  }

  const result = await query<{ two_factor_pin_hash: string | null }>(
    "SELECT two_factor_pin_hash FROM users WHERE id = $1 LIMIT 1",
    [challengeUser.id]
  );
  const hasPin = Boolean(result.rows[0]?.two_factor_pin_hash);
  const canUsePin = hasPin && (await hasValidTwoFactorTrust(challengeUser.id));

  return (
    <main className="page">
      <div className="shell login-shell">
        <header className="masthead">
          <h1>Svida Job Tracker</h1>
        </header>
        <section className="panel auth-panel">
          <h2>{canUsePin ? "PIN Check" : "Two-Factor Check"}</h2>
          <TwoFactorLoginForm hasPin={hasPin} canUsePin={canUsePin} />
        </section>
      </div>
    </main>
  );
}
