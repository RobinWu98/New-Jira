import { redirect } from "next/navigation";
import { PinLoginForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser, getRememberedPinUser } from "@/lib/auth";

export default async function PinPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/main-page");
  }

  const rememberedUser = await getRememberedPinUser();

  if (!rememberedUser) {
    redirect("/login");
  }

  return (
    <main className="page pin-page">
      <div className="shell pin-shell">
        <PageHeader title="SVIDA Job Tracker" subtitle="Enter your quick access PIN." hideBack />
        <section className="panel pin-panel">
          <PinLoginForm user={rememberedUser} />
        </section>
      </div>
    </main>
  );
}
