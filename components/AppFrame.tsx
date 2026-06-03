import { logoutAction } from "@/lib/actions";
import { query } from "@/lib/db";

type ProjectNavRow = {
  id: string;
  name: string;
  status: string;
};

type AppFrameProps = {
  children: React.ReactNode;
  shellClassName?: string;
  currentProjectId?: string;
};

function normalizeProjectStatus(status: string) {
  return status === "done" ? "done" : "active";
}

function ProjectNavGroup({
  title,
  status,
  projects,
  currentProjectId
}: {
  title: string;
  status: "active" | "done";
  projects: ProjectNavRow[];
  currentProjectId?: string;
}) {
  return (
    <details className="leftbar-group" open={status === "active"}>
      <summary className={`leftbar-heading leftbar-heading-${status}`}>{title}</summary>
      {projects.length ? (
        <ul className="leftbar-list">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                className={`leftbar-project-link${project.id === currentProjectId ? " is-current" : ""}`}
                href={`/projects/${project.id}`}
              >
                {project.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="leftbar-empty">No projects</p>
      )}
    </details>
  );
}

export async function AppFrame({ children, shellClassName = "", currentProjectId }: AppFrameProps) {
  const result = await query<ProjectNavRow>(
    `SELECT id, name, status
     FROM projects
     ORDER BY ddl ASC, created_at DESC`
  );

  const activeProjects = result.rows.filter((project) => normalizeProjectStatus(project.status) === "active");
  const doneProjects = result.rows.filter((project) => normalizeProjectStatus(project.status) === "done");
  const shellClass = ["shell", shellClassName].filter(Boolean).join(" ");

  return (
    <main className="page app-frame">
      <nav className="topbar" aria-label="Global navigation">
        <div className="topbar-left">
          <a className="topbar-icon-link" href="/main-page" aria-label="Homepage" title="Homepage">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 11 12 3l9 8" />
              <path d="M5 10v10h5v-6h4v6h5V10" />
            </svg>
          </a>
          <a className="topbar-brand" href="/main-page">
            Svida Job Tracker
          </a>
        </div>
        <div className="topbar-right">
          <a className="topbar-icon-link" href="/notifications" aria-label="Notifications" title="Notifications">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </a>
          <div className="topbar-profile-menu">
            <button className="topbar-icon-link" type="button" aria-label="Profile menu" title="Profile menu">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </button>
            <div className="topbar-menu" role="menu">
              <a href="/profile" role="menuitem">
                Profile
              </a>
              <form action={logoutAction}>
                <button type="submit" role="menuitem">
                  Log Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <div className="leftnav">
        <span className="leftbar-handle" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
        <aside className="leftbar" aria-label="Project navigation">
          <a className="leftbar-title" href="/projects">
            Projects
          </a>
          <ProjectNavGroup
            title="Active"
            status="active"
            projects={activeProjects}
            currentProjectId={currentProjectId}
          />
          <ProjectNavGroup
            title="Completed"
            status="done"
            projects={doneProjects}
            currentProjectId={currentProjectId}
          />
        </aside>
      </div>
      <div className="app-content">
        <div className={shellClass}>{children}</div>
      </div>
    </main>
  );
}
