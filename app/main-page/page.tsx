import { AppFrame } from "@/components/AppFrame";
import { requireUser } from "@/lib/auth";

export default async function MainPage() {
  await requireUser();

  return (
    <AppFrame shellClassName="main-page-shell">
      <nav className="main-actions" aria-label="Main navigation">
        <a className="main-action main-action-dashboard" href="/dashboard">
          <img src="/main-nav/dashboard.png" alt="" aria-hidden="true" />
          <span>My Dashboard</span>
        </a>
        <a className="main-action main-action-projects" href="/projects">
          <img src="/main-nav/projects.png" alt="" aria-hidden="true" />
          <span>Projects</span>
        </a>
        <a className="main-action main-action-team" href="/team">
          <img src="/main-nav/team.png" alt="" aria-hidden="true" />
          <span>Team</span>
        </a>
      </nav>
    </AppFrame>
  );
}
