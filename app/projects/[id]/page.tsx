import { notFound } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import {
  CreateTaskModal,
  ProjectTasksAntTable,
  type SubtaskListItemData,
  type TaskCommentData,
  type TaskListItemData,
  type TaskFormData,
  type TaskLogData
} from "@/components/ProjectForms";
import { DropdownArrowIcon } from "@/components/AntArrowIcons";
import { canCreateTask, canManageTask, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { syncOverdueWorkItems } from "@/lib/overdue";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ taskStatus?: string }>;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: Date | string;
  ddl: Date | string;
  status: string;
  owner_name: string | null;
  owner_email: string | null;
  created_at: Date | string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  created_at: Date | string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  start_date: Date | string | null;
  due_date: Date | string | null;
  priority: string;
  status: string;
  assigned_to_id: string;
  assigned_to_name: string | null;
  assigned_to_email: string;
  created_at: Date | string;
};

type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  start_date: Date | string | null;
  due_date: Date | string | null;
  priority: string;
  status: string;
  assigned_to_id: string;
  assigned_to_name: string | null;
  assigned_to_email: string;
  created_at: Date | string;
};

type CommentRow = {
  author_id: string | null;
  id: string;
  work_item_id: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: Date | string;
};

type LogRow = {
  action: string;
  actor_email: string | null;
  actor_name: string | null;
  body: string;
  created_at: Date | string;
  id: string;
  subtask_id: string | null;
  task_id: string;
};

type TaskStatusFilter = "active" | "overdue" | "done" | "all";

const TASK_STATUS_LABELS: Record<TaskStatusFilter, string> = {
  active: "Ongoing",
  overdue: "Overdue",
  done: "Completed",
  all: "View All"
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatOpenDays(value: Date | string) {
  const opened = value instanceof Date ? new Date(value) : new Date(value);
  const today = new Date();
  opened.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const days = Math.max(0, Math.floor((today.getTime() - opened.getTime()) / 86_400_000));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function formatOptionalDate(value: Date | string | null) {
  return value ? formatDate(value) : "No date";
}

function getProjectDisplayStatus(project: Pick<ProjectRow, "ddl" | "status">) {
  if (project.status === "done") {
    return "Completed";
  }

  const dueDate = project.ddl instanceof Date ? project.ddl : new Date(`${project.ddl}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today ? "Overdue" : "Ongoing";
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTaskStatusFilter(value: string | undefined): TaskStatusFilter {
  return value === "done" || value === "completed"
    ? "done"
    : value === "overdue"
      ? "overdue"
      : value === "all"
        ? "all"
        : "active";
}

function getTaskHref(params: {
  projectId: string;
  status: TaskStatusFilter;
}) {
  const next = new URLSearchParams();
  next.set("taskStatus", params.status);

  return `/projects/${params.projectId}?${next.toString()}`;
}

function toTaskFormData(projectId: string, task: TaskRow): TaskFormData {
  return {
    id: task.id,
    projectId,
    title: task.title,
    description: task.description ?? "",
    assignedToId: task.assigned_to_id,
    startDate: task.start_date ? toDateInput(task.start_date) : "",
    dueDate: task.due_date ? toDateInput(task.due_date) : "",
    priority: task.priority,
    status: task.status
  };
}

function toTaskListItemData(
  projectId: string,
  projectName: string,
  task: TaskRow,
  comments: TaskCommentData[],
  logs: TaskLogData[]
): TaskListItemData {
  return {
    ...toTaskFormData(projectId, task),
    assignedTo: task.assigned_to_name || task.assigned_to_email,
    startLabel: formatOptionalDate(task.start_date),
    dueLabel: task.due_date ? formatDate(task.due_date) : "No due date",
    projectName,
    comments,
    logs
  };
}

function toSubtaskListItemData(
  projectId: string,
  subtask: SubtaskRow,
  comments: TaskCommentData[],
  logs: TaskLogData[]
): SubtaskListItemData {
  return {
    id: subtask.id,
    projectId,
    taskId: subtask.task_id,
    title: subtask.title,
    assignedToId: subtask.assigned_to_id,
    startDate: subtask.start_date ? toDateInput(subtask.start_date) : "",
    dueDate: subtask.due_date ? toDateInput(subtask.due_date) : "",
    priority: subtask.priority,
    status: subtask.status,
    assignedTo: subtask.assigned_to_name || subtask.assigned_to_email,
    startLabel: formatOptionalDate(subtask.start_date),
    dueLabel: subtask.due_date ? formatDate(subtask.due_date) : "No due date",
    comments,
    logs
  };
}

function isUserMentioned(body: string, user: { email: string; name: string | null }) {
  const normalizedBody = body.toLowerCase();
  const emailMention = `@${user.email.toLowerCase()}`;
  const nameMention = user.name ? `@${user.name.toLowerCase()}` : "";

  return normalizedBody.includes(emailMention) || Boolean(nameMention && normalizedBody.includes(nameMention));
}

function toCommentData(comment: CommentRow, user: { email: string; id: string; name: string | null }): TaskCommentData {
  return {
    id: comment.id,
    author: comment.author_name || comment.author_email || "Deleted user",
    body: comment.body,
    createdAt: formatDateTime(comment.created_at),
    isMine: comment.author_id === user.id,
    mentionsMe: comment.author_id !== user.id && isUserMentioned(comment.body, user)
  };
}

function groupComments(comments: CommentRow[], user: { email: string; id: string; name: string | null }) {
  const groups = new Map<string, TaskCommentData[]>();

  for (const comment of comments) {
    const existing = groups.get(comment.work_item_id) ?? [];
    existing.push(toCommentData(comment, user));
    groups.set(comment.work_item_id, existing);
  }

  return groups;
}

function toLogData(log: LogRow): TaskLogData {
  return {
    id: log.id,
    actor: log.actor_name || log.actor_email || "System",
    action: log.action,
    body: log.body,
    createdAt: formatDateTime(log.created_at)
  };
}

function groupLogs(logs: LogRow[], useSubtaskId = false) {
  const groups = new Map<string, TaskLogData[]>();

  for (const log of logs) {
    const workItemId = useSubtaskId ? log.subtask_id : log.task_id;

    if (!workItemId) {
      continue;
    }

    const existing = groups.get(workItemId) ?? [];
    existing.push(toLogData(log));
    groups.set(workItemId, existing);
  }

  return groups;
}

function groupSubtasksByTask(
  subtasks: SubtaskRow[],
  projectId: string,
  subtaskCommentsById: Map<string, TaskCommentData[]>,
  subtaskLogsById: Map<string, TaskLogData[]>
) {
  const groups = new Map<string, SubtaskListItemData[]>();

  for (const subtask of subtasks) {
    const existing = groups.get(subtask.task_id) ?? [];
    existing.push(
      toSubtaskListItemData(
        projectId,
        subtask,
        subtaskCommentsById.get(subtask.id) ?? [],
        subtaskLogsById.get(subtask.id) ?? []
      )
    );
    groups.set(subtask.task_id, existing);
  }

  return groups;
}

function toDateInput(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const filters = await searchParams;
  const selectedTaskStatus = normalizeTaskStatusFilter(filters.taskStatus);

  if (!isUuid(id)) {
    notFound();
  }

  await syncOverdueWorkItems();

  const [projectResult, tasksResult, subtasksResult, taskCommentsResult, subtaskCommentsResult, logsResult, usersResult] =
    await Promise.all([
    query<ProjectRow>(
      `SELECT
         projects.id,
         projects.name,
         projects.description,
         projects.start_date,
         projects.ddl,
         projects.status,
         projects.created_at,
         users.name AS owner_name,
         users.email::text AS owner_email
       FROM projects
       LEFT JOIN users ON users.id = projects.owner_id
       WHERE projects.id = $1
         AND projects.archived_at IS NULL
       LIMIT 1`,
      [id]
    ),
    query<TaskRow>(
      `SELECT
         tasks.id,
         tasks.title,
         tasks.description,
         tasks.start_date,
         tasks.due_date,
         tasks.priority,
         tasks.status,
         tasks.assigned_to_id,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email,
         tasks.created_at
       FROM tasks
       JOIN users ON users.id = tasks.assigned_to_id
       WHERE tasks.project_id = $1
         AND tasks.archived_at IS NULL
       ORDER BY
         CASE tasks.status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
         tasks.due_date ASC NULLS LAST,
         CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         tasks.created_at DESC`,
      [id]
    ),
    query<SubtaskRow>(
      `SELECT
         subtasks.id,
         subtasks.task_id,
         subtasks.title,
         subtasks.start_date,
         subtasks.due_date,
         subtasks.priority,
         subtasks.status,
         subtasks.assigned_to_id,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email,
         subtasks.created_at
       FROM subtasks
       JOIN tasks ON tasks.id = subtasks.task_id
       JOIN users ON users.id = subtasks.assigned_to_id
       WHERE tasks.project_id = $1
         AND tasks.archived_at IS NULL
         AND subtasks.archived_at IS NULL
       ORDER BY
         subtasks.due_date ASC NULLS LAST,
         CASE subtasks.status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
         CASE subtasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         subtasks.created_at DESC`,
      [id]
    ),
      query<CommentRow>(
        `SELECT
           task_comments.id,
           task_comments.task_id AS work_item_id,
           task_comments.author_id,
           users.name AS author_name,
           users.email::text AS author_email,
           task_comments.body,
           task_comments.created_at
         FROM task_comments
         JOIN tasks ON tasks.id = task_comments.task_id
         LEFT JOIN users ON users.id = task_comments.author_id
         WHERE tasks.project_id = $1
           AND tasks.archived_at IS NULL
         ORDER BY task_comments.created_at ASC`,
        [id]
      ),
      query<CommentRow>(
        `SELECT
           subtask_comments.id,
           subtask_comments.subtask_id AS work_item_id,
           subtask_comments.author_id,
           users.name AS author_name,
           users.email::text AS author_email,
           subtask_comments.body,
           subtask_comments.created_at
         FROM subtask_comments
         JOIN subtasks ON subtasks.id = subtask_comments.subtask_id
         JOIN tasks ON tasks.id = subtasks.task_id
         LEFT JOIN users ON users.id = subtask_comments.author_id
         WHERE tasks.project_id = $1
           AND tasks.archived_at IS NULL
           AND subtasks.archived_at IS NULL
         ORDER BY subtask_comments.created_at ASC`,
        [id]
      ),
      query<LogRow>(
        `SELECT
           work_item_logs.id,
           work_item_logs.task_id,
           work_item_logs.subtask_id,
           users.name AS actor_name,
           users.email::text AS actor_email,
           work_item_logs.action,
           work_item_logs.body,
           work_item_logs.created_at
         FROM work_item_logs
         JOIN tasks ON tasks.id = work_item_logs.task_id
         LEFT JOIN users ON users.id = work_item_logs.actor_id
         WHERE tasks.project_id = $1
           AND tasks.archived_at IS NULL
         ORDER BY work_item_logs.created_at ASC`,
        [id]
      ),
      query<UserRow>(
        "SELECT id, name, email::text AS email, created_at FROM users WHERE archived_at IS NULL ORDER BY name NULLS LAST, email"
      )
    ]);

  const project = projectResult.rows[0];

  if (!project) {
    notFound();
  }

  const users = usersResult.rows.map((user) => ({
    id: user.id,
    label: user.name ? `${user.name} (${user.email})` : user.email,
    createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at)
  }));
  const userCanCreateTask = canCreateTask(user);
  const userCanManageTask = canManageTask(user);
  const taskCommentsById = groupComments(taskCommentsResult.rows, user);
  const subtaskCommentsById = groupComments(subtaskCommentsResult.rows, user);
  const taskLogsById = groupLogs(logsResult.rows.filter((log) => !log.subtask_id));
  const subtaskLogsById = groupLogs(logsResult.rows.filter((log) => Boolean(log.subtask_id)), true);
  const subtasksByTask = groupSubtasksByTask(subtasksResult.rows, project.id, subtaskCommentsById, subtaskLogsById);
  const taskGroups = {
    active: tasksResult.rows.filter((task) => task.status !== "done"),
    overdue: tasksResult.rows.filter((task) => task.status === "overdue"),
    done: tasksResult.rows.filter((task) => task.status === "done"),
    all: tasksResult.rows
  } satisfies Record<TaskStatusFilter, TaskRow[]>;
  const filteredTasks = taskGroups[selectedTaskStatus];

  return (
    <AppFrame shellClassName="project-shell" currentProjectId={project.id}>
      <PageHeader
        title={project.name}
        subtitle={project.description ? <span className="project-header-description">{project.description}</span> : undefined}
      />
      <section className="panel">
        <div className="project-group-toolbar table-title-toolbar">
          <div className="task-table-title-row">
            <div className="task-table-title-main">
              {userCanCreateTask ? <CreateTaskModal projectId={project.id} users={users} /> : null}
            </div>
            <details className="table-view-switch project-view-switch">
              <summary className="button secondary table-view-trigger" aria-label="Task table view">
                <span>Table View: {TASK_STATUS_LABELS[selectedTaskStatus]} ({taskGroups[selectedTaskStatus].length})</span>
                <DropdownArrowIcon />
              </summary>
              <div className="table-view-menu" role="menu">
                {(["active", "overdue", "done", "all"] as TaskStatusFilter[]).map((status) => (
                  <a
                    className={selectedTaskStatus === status ? "is-active" : ""}
                    href={getTaskHref({
                      projectId: project.id,
                      status
                    })}
                    key={status}
                    role="menuitem"
                  >
                    {TASK_STATUS_LABELS[status]} ({taskGroups[status].length})
                  </a>
                ))}
              </div>
            </details>
          </div>
        </div>
        <ProjectTasksAntTable
          canManageTask={userCanManageTask}
          canUpdateStatus
          currentUserId={user.id}
          rows={filteredTasks.map((task) => {
            const taskData = toTaskListItemData(
                project.id,
                project.name,
                task,
                taskCommentsById.get(task.id) ?? [],
                taskLogsById.get(task.id) ?? []
              );

            return {
              key: task.id,
              subtasks: subtasksByTask.get(task.id) ?? [],
              task: taskData
            };
          })}
          users={users}
        />
      </section>
    </AppFrame>
  );
}
