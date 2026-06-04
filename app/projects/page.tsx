import { AppFrame } from "@/components/AppFrame";
import {
  CreateProjectModal,
  DeleteProjectForm,
  EditProjectModal,
  type ProjectFormData
} from "@/components/ProjectForms";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: Date | string;
  ddl: Date | string;
  status: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  task_count: string;
};

function toDateInput(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function normalizeProjectStatus(status: string) {
  return status === "done" ? "done" : "active";
}

function toProjectFormData(project: ProjectRow): ProjectFormData {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    startDate: toDateInput(project.start_date),
    ddl: toDateInput(project.ddl),
    ownerId: project.owner_id ?? "",
    status: normalizeProjectStatus(project.status)
  };
}

function ProjectTable({
  title,
  status,
  projects,
  users,
  currentUserId,
  canModify
}: {
  title: string;
  status: "active" | "done";
  projects: ProjectRow[];
  users: { id: string; label: string }[];
  currentUserId: string;
  canModify: boolean;
}) {
  return (
    <div className={`project-group project-group-${status}`}>
      <h3>
        <span className={`project-keyword project-keyword-${status}`}>{status === "active" ? "Active" : "Done"}</span>{" "}
        Projects
      </h3>
      <div className={`project-list project-list-${status}`} role="table" aria-label={title}>
        <div className="project-list-row project-list-head" role="row">
          <strong role="columnheader">Project</strong>
          <strong role="columnheader">Start</strong>
          <strong role="columnheader">DDL</strong>
          <strong role="columnheader">Creator</strong>
          <strong role="columnheader">Actions</strong>
        </div>
        {projects.map((project) => (
          <div className="project-list-row" role="row" key={project.id}>
            <span role="cell">
              <a className="project-row-link" href={`/projects/${project.id}`}>
                {project.name}
              </a>
            </span>
            <span role="cell">{formatDate(project.start_date)}</span>
            <span role="cell">{formatDate(project.ddl)}</span>
            <span role="cell">{project.owner_name || project.owner_email || "Unassigned"}</span>
            <span role="cell" className="record-actions">
              {canModify ? (
                <>
                  <EditProjectModal users={users} currentUserId={currentUserId} project={toProjectFormData(project)} />
                  <DeleteProjectForm projectId={project.id} />
                </>
              ) : (
                <a className="button secondary" href={`/projects/${project.id}`}>
                  View
                </a>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ProjectsPage() {
  const user = await requireUser();

  const [usersResult, projectsResult] = await Promise.all([
    query<UserRow>("SELECT id, name, email::text AS email FROM users ORDER BY name NULLS LAST, email"),
    query<ProjectRow>(
      `SELECT
         projects.id,
         projects.name,
         projects.description,
         projects.start_date,
         projects.ddl,
         projects.status,
         projects.owner_id,
         users.name AS owner_name,
         users.email::text AS owner_email,
         COUNT(tasks.id)::text AS task_count
       FROM projects
       LEFT JOIN users ON users.id = projects.owner_id
       LEFT JOIN tasks ON tasks.project_id = projects.id
       GROUP BY projects.id, users.name, users.email
       ORDER BY CASE projects.status WHEN 'active' THEN 0 ELSE 1 END, projects.ddl ASC, projects.created_at DESC`
    )
  ]);

  const users = usersResult.rows.map((row) => ({
    id: row.id,
    label: row.name ? `${row.name} (${row.email})` : row.email
  }));
  const activeProjects = projectsResult.rows.filter((project) => normalizeProjectStatus(project.status) === "active");
  const doneProjects = projectsResult.rows.filter((project) => normalizeProjectStatus(project.status) === "done");
  const canModify = user.role === "admin";

  return (
    <AppFrame shellClassName="project-shell">
      <header className="masthead">
        <h1>Projects</h1>
      </header>
      <section className="panel">
        <div className="section-toolbar">
          <h2>All Project List</h2>
          <div className="toolbar-actions">
            {canModify ? <CreateProjectModal users={users} currentUserId={user.id} /> : null}
            <a className="button secondary" href="/main-page">
              Back
            </a>
          </div>
        </div>
        <ProjectTable
          title="Active Projects"
          status="active"
          projects={activeProjects}
          users={users}
          currentUserId={user.id}
          canModify={canModify}
        />
        <ProjectTable
          title="Done Projects"
          status="done"
          projects={doneProjects}
          users={users}
          currentUserId={user.id}
          canModify={canModify}
        />
      </section>
    </AppFrame>
  );
}
