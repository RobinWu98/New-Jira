import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function TeamPage() {
  await requireUser();

  return (
    <AppFrame>
      <header className="masthead">
        <h1>Team</h1>
      </header>
      <section className="panel">
        <h2>Welcome to Team</h2>
        <p>This page will hold team tracking.</p>
        <div className="button-row">
          <a className="button secondary" href="/main-page">
            Back to Main Page
          </a>
        </div>
      </section>
    </AppFrame>
  );
}
