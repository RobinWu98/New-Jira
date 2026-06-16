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
  last_comment_author_email: string | null;
  last_comment_author_name: string | null;
  last_comment_body: string | null;
  last_comment_created_at: Date | string | null;
  last_comment_item_title: string | null;
  last_comment_item_type: string | null;
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

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
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

function formatLastComment(project: ProjectRow) {
  if (!project.last_comment_body || !project.last_comment_created_at) {
    return {
      label: "No comments",
      title: "No comments"
    };
  }

  const author = project.last_comment_author_name || project.last_comment_author_email || "Deleted user";
  const when = formatDateTime(project.last_comment_created_at);
  const label = `${author} - ${when}`;

  return {
    label,
    title: label
  };
}

function toTableRow(project: ProjectRow): ProjectsAntTableRow {
  const openDays = getOpenDays(project.created_at);
  const lastComment = formatLastComment(project);

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
    lastComment: lastComment.label,
    lastCommentCreatedAt: project.last_comment_created_at
      ? new Date(project.last_comment_created_at).getTime()
      : Number.NEGATIVE_INFINITY,
    lastCommentTitle: lastComment.title
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
         latest_comment.author_email AS last_comment_author_email,
         latest_comment.author_name AS last_comment_author_name,
         latest_comment.body AS last_comment_body,
         latest_comment.created_at AS last_comment_created_at,
         latest_comment.item_title AS last_comment_item_title,
         latest_comment.item_type AS last_comment_item_type
       FROM projects
       LEFT JOIN users ON users.id = projects.owner_id
       LEFT JOIN tasks ON tasks.project_id = projects.id AND tasks.archived_at IS NULL
       LEFT JOIN LATERAL (
         SELECT *
         FROM (
           SELECT
             comment_users.email::text AS author_email,
             comment_users.name AS author_name,
             task_comments.body,
             task_comments.created_at,
             tasks.title AS item_title,
             'task'::text AS item_type
           FROM task_comments
           JOIN tasks ON tasks.id = task_comments.task_id
           LEFT JOIN users AS comment_users ON comment_users.id = task_comments.author_id
           WHERE tasks.project_id = projects.id
             AND tasks.archived_at IS NULL
           UNION ALL
           SELECT
             comment_users.email::text AS author_email,
             comment_users.name AS author_name,
             subtask_comments.body,
             subtask_comments.created_at,
             subtasks.title AS item_title,
             'subtask'::text AS item_type
           FROM subtask_comments
           JOIN subtasks ON subtasks.id = subtask_comments.subtask_id
           JOIN tasks ON tasks.id = subtasks.task_id
           LEFT JOIN users AS comment_users ON comment_users.id = subtask_comments.author_id
           WHERE tasks.project_id = projects.id
             AND tasks.archived_at IS NULL
             AND subtasks.archived_at IS NULL
         ) AS project_comments
         ORDER BY project_comments.created_at DESC
         LIMIT 1
       ) AS latest_comment ON true
       WHERE projects.archived_at IS NULL
       GROUP BY
         projects.id,
         users.name,
         users.email,
         latest_comment.author_email,
         latest_comment.author_name,
         latest_comment.body,
         latest_comment.created_at,
         latest_comment.item_title,
         latest_comment.item_type
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
