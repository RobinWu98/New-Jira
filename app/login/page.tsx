import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser, getRememberedPinUser } from "@/lib/auth";

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

  const rememberedUser = await getRememberedPinUser();

  if (rememberedUser) {
    redirect("/pin");
  }

  return (
    <main className="page">
      <div className="shell login-shell">
        <PageHeader title="SVIDA Job Tracker" hideBack />
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
