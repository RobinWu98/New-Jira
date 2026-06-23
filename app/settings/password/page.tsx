import { ChangePasswordForm } from "@/components/AuthForms";
import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";

export default async function ChangePasswordPage() {
  return (
    <AppFrame>
      <PageHeader title="Password Reset" />
      <section className="panel">
        <ChangePasswordForm />
      </section>
    </AppFrame>
  );
}
