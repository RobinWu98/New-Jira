import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/main-page");
  }

  return (
    <main className="page">
      <div className="shell">
        <PageHeader
          title="Svida Job Tracker"
          subtitle="Open a desk file for your job search. Password sign-in is active now; stronger verification can be added later."
        />
        <section className="panel">
          <h2>Create Account</h2>
          <div className="notice">Use an email address you can keep. This will be the account record for every future application note.</div>
          <div className="table-like compact">
            <div>
              <strong>Account</strong>
              <span>Email and password</span>
            </div>
            <div>
              <strong>Password</strong>
              <span>Minimum 8 characters</span>
            </div>
            <div>
              <strong>After Signup</strong>
              <span>You will return to the login desk</span>
            </div>
          </div>
          <RegisterForm />
        </section>
      </div>
    </main>
  );
}
