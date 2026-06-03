import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function MainPage() {
  await requireUser();

  return (
    <AppFrame shellClassName="main-page-shell">
      <section className="panel">
        <nav className="main-actions" aria-label="Main navigation">
          <a className="button main-action" href="/projects">
            Projects
          </a>
          <a className="button main-action" href="/dashboard">
            My Dashboard
          </a>
          <a className="button main-action" href="/team">
            Team
          </a>
        </nav>
      </section>
    </AppFrame>
  );
}
