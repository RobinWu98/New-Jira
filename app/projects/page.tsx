import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import { CreateProjectModal } from "@/components/ProjectForms";
import { ProjectsAntTable, type ProjectsAntTableRow } from "@/components/ProjectsAntTable";
import { UiButton } from "@/components/UiControls";
import { canCreateProject, canManageProject, requireUser } from "@/lib/auth";
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
  created_at: Date | string;
};

type ProjectStatusFilter = "active" | "done" | "all";

type ProjectsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const PROJECT_STATUS_LABELS: Record<ProjectStatusFilter, string> = {
  active: "Ongoing",
  done: "Completed",
  all: "View All"
};

function normalizeStatusFilter(value: string | undefined): ProjectStatusFilter {
  return value === "done" || value === "completed" ? "done" : value === "all" ? "all" : "active";
}

function toDateInput(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function getOpenDays(value: Date | string) {
  const opened = value instanceof Date ? new Date(value) : new Date(value);
  const today = new Date();
  opened.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today.getTime() - opened.getTime()) / 86_400_000));
}

function formatOpenDays(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function normalizeProjectStatus(status: string) {
  return status === "done" ? "done" : "active";
}

function formatProjectStatus(status: string) {
  return normalizeProjectStatus(status) === "done" ? "Completed" : "Ongoing";
}

function toTableRow(project: ProjectRow): ProjectsAntTableRow {
  const openDays = getOpenDays(project.created_at);

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    startDate: toDateInput(project.start_date),
    dueDate: toDateInput(project.ddl),
    dueDateLabel: formatDate(project.ddl),
    openDays,
    openDaysLabel: formatOpenDays(openDays),
    ownerId: project.owner_id ?? "",
    status: normalizeProjectStatus(project.status),
    statusLabel: formatProjectStatus(project.status),
    taskCount: Number(project.task_count)
  };
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedStatus = normalizeStatusFilter(params.status);

  const [usersResult, projectsResult] = await Promise.all([
    query<UserRow>(
      "SELECT id, name, email::text AS email FROM users WHERE archived_at IS NULL ORDER BY name NULLS LAST, email"
    ),
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
         COUNT(tasks.id)::text AS task_count,
         projects.created_at
       FROM projects
       LEFT JOIN users ON users.id = projects.owner_id
       LEFT JOIN tasks ON tasks.project_id = projects.id AND tasks.archived_at IS NULL
       WHERE projects.archived_at IS NULL
       GROUP BY projects.id, users.name, users.email
       ORDER BY CASE projects.status WHEN 'active' THEN 0 ELSE 1 END, projects.ddl ASC, projects.created_at DESC`
    )
  ]);

  const users = usersResult.rows.map((row) => ({
    id: row.id,
    label: row.name ? `${row.name} (${row.email})` : row.email
  }));
  const projects = projectsResult.rows
    .filter((project) => (selectedStatus === "all" ? true : normalizeProjectStatus(project.status) === selectedStatus))
    .map(toTableRow);
  const userCanCreateProject = canCreateProject(user);
  const userCanManageProject = canManageProject(user);

  return (
    <AppFrame shellClassName="project-shell">
      <PageHeader title="Projects" />
      <section className="panel">
        <div className="section-toolbar project-create-toolbar">
          <div className="toolbar-actions">
            {userCanCreateProject ? <CreateProjectModal users={users} currentUserId={user.id} /> : null}
          </div>
        </div>
        <div className="project-group-toolbar table-title-toolbar project-table-toolbar">
          <div className="task-table-title-row project-table-title-row">
            <div className="task-table-title-main">
              <h3>
                <span className={`project-keyword project-keyword-${selectedStatus}`}>
                  {PROJECT_STATUS_LABELS[selectedStatus]} Projects
                </span>
              </h3>
            </div>
            <nav className="table-view-switch" aria-label="Project table view">
              <UiButton variant="secondary" className="table-view-trigger" type="button" aria-haspopup="true">
                Table View: {PROJECT_STATUS_LABELS[selectedStatus]} ({projects.length})
              </UiButton>
              <div className="table-view-menu" role="menu">
                {(["active", "done", "all"] as ProjectStatusFilter[]).map((status) => {
                  const count =
                    status === "all"
                      ? projectsResult.rows.length
                      : projectsResult.rows.filter((project) => normalizeProjectStatus(project.status) === status).length;

                  return (
                    <a
                      className={selectedStatus === status ? "is-active" : ""}
                      href={`/projects?status=${status}`}
                      key={status}
                      role="menuitem"
                    >
                      {PROJECT_STATUS_LABELS[status]} ({count})
                    </a>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
        <ProjectsAntTable
          canModify={userCanManageProject}
          currentUserId={user.id}
          projects={projects}
          users={users}
        />
      </section>
    </AppFrame>
  );
}
