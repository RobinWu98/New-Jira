import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  await requireUser();

  return (
    <AppFrame>
      <header className="masthead">
        <h1>My Dashboard</h1>
      </header>
      <section className="panel">
        <h2>Welcome to My Dashboard</h2>
        <p>This page will hold your task dashboard.</p>
        <div className="button-row">
          <a className="button secondary" href="/main-page">
            Back to Main Page
          </a>
        </div>
      </section>
    </AppFrame>
  );
}
