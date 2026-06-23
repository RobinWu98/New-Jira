import { AppFrame } from "@/components/AppFrame";
import { DropdownArrowIcon } from "@/components/AntArrowIcons";
import { PageHeader } from "@/components/PageHeader";
import { CreateProjectModal } from "@/components/ProjectForms";
import { ProjectsAntTable, type ProjectsAntTableRow } from "@/components/ProjectsAntTable";
import { canCreateProject, canEditProject, canManageProject, requireUser } from "@/lib/auth";
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
  display_status: ProjectDisplayStatus;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  completed_task_count: string;
  remaining_task_count: string;
  task_count: string;
  created_at: Date | string;
  last_update_at: Date | string | null;
};

type ProjectDisplayStatus = "active" | "overdue" | "done";
type ProjectStatusFilter = ProjectDisplayStatus | "all";

type ProjectsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const PROJECT_STATUS_LABELS: Record<ProjectStatusFilter, string> = {
  active: "Ongoing",
  overdue: "Overdue",
  done: "Completed",
  all: "View All"
};

function normalizeStatusFilter(value: string | undefined): ProjectStatusFilter {
  return value === "done" || value === "completed"
    ? "done"
    : value === "overdue"
      ? "overdue"
      : value === "all"
        ? "all"
        : "active";
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

function formatUpdateDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(date);
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

function normalizeStoredProjectStatus(status: string) {
  return status === "done" ? "done" : "active";
}

function formatProjectStatus(status: string) {
  return status === "done" ? "Completed" : status === "overdue" ? "Overdue" : "Ongoing";
}

function toTableRow(project: ProjectRow): ProjectsAntTableRow {
  const openDays = getOpenDays(project.created_at);
  const lastUpdateAt = project.last_update_at ?? project.created_at;
  const lastUpdate = formatUpdateDate(lastUpdateAt);

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
    rawStatus: normalizeStoredProjectStatus(project.status),
    status: project.display_status,
    statusLabel: formatProjectStatus(project.display_status),
    completedTaskCount: Number(project.completed_task_count),
    remainingTaskCount: Number(project.remaining_task_count),
    taskCount: Number(project.task_count),
    lastUpdate,
    lastUpdateAt: new Date(lastUpdateAt).getTime(),
    lastUpdateTitle: `Last update: ${lastUpdate}`
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
         CASE
           WHEN projects.status <> 'done' AND projects.ddl < current_date THEN 'overdue'
           ELSE projects.status
         END AS display_status,
         projects.owner_id,
         users.name AS owner_name,
         users.email::text AS owner_email,
         COUNT(tasks.id) FILTER (WHERE tasks.status = 'done')::text AS completed_task_count,
         COUNT(tasks.id) FILTER (WHERE tasks.status <> 'done')::text AS remaining_task_count,
         COUNT(tasks.id)::text AS task_count,
         projects.created_at,
         latest_activity.last_update_at
       FROM projects
       LEFT JOIN users ON users.id = projects.owner_id
       LEFT JOIN tasks ON tasks.project_id = projects.id AND tasks.archived_at IS NULL
       LEFT JOIN LATERAL (
         SELECT MAX(activity_at) AS last_update_at
         FROM (
           SELECT projects.updated_at AS activity_at
           UNION ALL
           SELECT project_tasks.updated_at
           FROM tasks AS project_tasks
           WHERE project_tasks.project_id = projects.id
           UNION ALL
           SELECT project_subtasks.updated_at
           FROM subtasks AS project_subtasks
           JOIN tasks AS project_tasks ON project_tasks.id = project_subtasks.task_id
           WHERE project_tasks.project_id = projects.id
           UNION ALL
           SELECT
             task_comments.updated_at
           FROM task_comments
           JOIN tasks ON tasks.id = task_comments.task_id
           WHERE tasks.project_id = projects.id
           UNION ALL
           SELECT
             subtask_comments.updated_at
           FROM subtask_comments
           JOIN subtasks ON subtasks.id = subtask_comments.subtask_id
           JOIN tasks ON tasks.id = subtasks.task_id
           WHERE tasks.project_id = projects.id
           UNION ALL
           SELECT work_item_logs.created_at
           FROM work_item_logs
           JOIN tasks ON tasks.id = work_item_logs.task_id
           WHERE tasks.project_id = projects.id
         ) AS project_activity
       ) AS latest_activity ON true
       WHERE projects.archived_at IS NULL
       GROUP BY
         projects.id,
         users.name,
         users.email,
         latest_activity.last_update_at
       ORDER BY
         CASE
           WHEN projects.status <> 'done' AND projects.ddl < current_date THEN 0
           WHEN projects.status = 'active' THEN 1
           ELSE 2
         END,
         projects.ddl ASC,
         projects.created_at DESC`
    )
  ]);

  const users = usersResult.rows.map((row) => ({
    id: row.id,
    label: row.name ? `${row.name} (${row.email})` : row.email
  }));
  const projects = projectsResult.rows
    .filter((project) => (selectedStatus === "all" ? true : project.display_status === selectedStatus))
    .map(toTableRow);
  const userCanCreateProject = canCreateProject(user);
  const userCanEditProject = canEditProject(user);
  const userCanManageProject = canManageProject(user);

  return (
    <AppFrame shellClassName="project-shell">
      <PageHeader title="Projects" />
      <section className="panel">
        <div className="project-group-toolbar table-title-toolbar project-table-toolbar">
          <div className="task-table-title-row project-table-title-row">
            <div className="task-table-title-main">
              {userCanCreateProject ? <CreateProjectModal users={users} currentUserId={user.id} /> : null}
            </div>
            <details className="table-view-switch project-view-switch">
              <summary className="button secondary table-view-trigger" aria-label="Project table view">
                <span>Table View: {PROJECT_STATUS_LABELS[selectedStatus]} ({projects.length})</span>
                <DropdownArrowIcon />
              </summary>
              <div className="table-view-menu" role="menu">
                {(["active", "overdue", "done", "all"] as ProjectStatusFilter[]).map((status) => {
                  const count =
                    status === "all"
                      ? projectsResult.rows.length
                      : projectsResult.rows.filter((project) => project.display_status === status).length;

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
            </details>
          </div>
        </div>
        <ProjectsAntTable
          canEdit={userCanEditProject}
          canManage={userCanManageProject}
          currentUserId={user.id}
          projects={projects}
          users={users}
        />
      </section>
    </AppFrame>
  );
}
