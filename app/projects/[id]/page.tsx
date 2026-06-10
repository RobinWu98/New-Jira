import { notFound } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import {
  CreateTaskModal,
  TaskWithSubtasks,
  type SubtaskListItemData,
  type TaskCommentData,
  type TaskListItemData,
  type TaskFormData,
  type TaskLogData
} from "@/components/ProjectForms";
import { ResizableTaskColumnHeader, ResizableTaskTable } from "@/components/ResizableTaskTable";
import { canCreateTask, canManageTask, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assignee?: string; priority?: string; q?: string; sort?: string; taskStatus?: string }>;
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

type TaskPriorityFilter = "all" | "high" | "medium" | "low";
type TaskStatusFilter = "active" | "done" | "all";
type TaskSort = "default" | "due_date" | "priority" | "status" | "assignee" | "title" | "newest";

const TASK_PRIORITY_LABELS: Record<TaskPriorityFilter, string> = {
  all: "All priorities",
  high: "High",
  medium: "Medium",
  low: "Low"
};

const TASK_STATUS_LABELS: Record<TaskStatusFilter, string> = {
  active: "Active",
  done: "Completed",
  all: "View All"
};

const TASK_SORT_LABELS: Record<TaskSort, string> = {
  default: "Priority + Due Date",
  due_date: "Due Date",
  priority: "Priority",
  status: "Status",
  assignee: "Assignee",
  title: "Task A-Z",
  newest: "Newest"
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatOptionalDate(value: Date | string | null) {
  return value ? formatDate(value) : "No date";
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

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTaskPriorityFilter(value: string | undefined): TaskPriorityFilter {
  return value === "high" || value === "medium" || value === "low" ? value : "all";
}

function normalizeTaskStatusFilter(value: string | undefined): TaskStatusFilter {
  return value === "done" || value === "completed" ? "done" : value === "all" ? "all" : "active";
}

function normalizeTaskSort(value: string | undefined): TaskSort {
  return value === "due_date" ||
    value === "priority" ||
    value === "status" ||
    value === "assignee" ||
    value === "title" ||
    value === "newest"
    ? value
    : "default";
}

function getDateTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function getNullableDateTime(value: Date | string | null) {
  return value ? getDateTime(value) : Number.POSITIVE_INFINITY;
}

function getPriorityRank(priority: string) {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

function getStatusRank(status: string) {
  return status === "done" ? 2 : status === "in_progress" ? 1 : 0;
}

function getTaskHref(params: {
  projectId: string;
  status: TaskStatusFilter;
  assigneeId: string;
  priority: TaskPriorityFilter;
  queryText: string;
  sort: TaskSort;
}) {
  const next = new URLSearchParams();
  next.set("taskStatus", params.status);

  if (params.assigneeId) {
    next.set("assignee", params.assigneeId);
  }

  if (params.priority !== "all") {
    next.set("priority", params.priority);
  }

  if (params.queryText) {
    next.set("q", params.queryText);
  }

  if (params.sort !== "default") {
    next.set("sort", params.sort);
  }

  return `/projects/${params.projectId}?${next.toString()}`;
}

function toTaskFormData(projectId: string, task: TaskRow): TaskFormData {
  return {
    id: task.id,
    projectId,
    title: task.title,
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
  const selectedAssigneeId = filters.assignee ?? "";
  const selectedPriority = normalizeTaskPriorityFilter(filters.priority);
  const selectedTaskStatus = normalizeTaskStatusFilter(filters.taskStatus);
  const selectedTaskSort = normalizeTaskSort(filters.sort);
  const queryText = (filters.q ?? "").trim();

  if (!isUuid(id)) {
    notFound();
  }

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
         CASE tasks.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
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
         CASE subtasks.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
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
  const canShowTaskActions = true;
  const selectedAssignee = selectedAssigneeId ? users.find((assignee) => assignee.id === selectedAssigneeId) : null;
  const taskCommentsById = groupComments(taskCommentsResult.rows, user);
  const subtaskCommentsById = groupComments(subtaskCommentsResult.rows, user);
  const taskLogsById = groupLogs(logsResult.rows.filter((log) => !log.subtask_id));
  const subtaskLogsById = groupLogs(logsResult.rows.filter((log) => Boolean(log.subtask_id)), true);
  const subtasksByTask = groupSubtasksByTask(subtasksResult.rows, project.id, subtaskCommentsById, subtaskLogsById);
  const baseFilteredTasks = tasksResult.rows
    .filter((task) => (selectedAssigneeId ? task.assigned_to_id === selectedAssigneeId : true))
    .filter((task) => (selectedPriority === "all" ? true : task.priority === selectedPriority))
    .filter((task) => {
      if (!queryText) {
        return true;
      }

      const needle = queryText.toLowerCase();
      return [task.title, task.assigned_to_name ?? "", task.assigned_to_email].some((value) =>
        value.toLowerCase().includes(needle)
      );
    });
  const taskGroups = {
    active: baseFilteredTasks.filter((task) => task.status !== "done"),
    done: baseFilteredTasks.filter((task) => task.status === "done"),
    all: baseFilteredTasks
  } satisfies Record<TaskStatusFilter, TaskRow[]>;
  const filteredTasks = [...taskGroups[selectedTaskStatus]].sort((left, right) => {
      if (selectedTaskSort === "due_date") {
        return getNullableDateTime(left.due_date) - getNullableDateTime(right.due_date);
      }

      if (selectedTaskSort === "priority") {
        return getPriorityRank(left.priority) - getPriorityRank(right.priority);
      }

      if (selectedTaskSort === "status") {
        return getStatusRank(left.status) - getStatusRank(right.status);
      }

      if (selectedTaskSort === "assignee") {
        const leftAssignee = left.assigned_to_name || left.assigned_to_email;
        const rightAssignee = right.assigned_to_name || right.assigned_to_email;
        return leftAssignee.localeCompare(rightAssignee);
      }

      if (selectedTaskSort === "title") {
        return left.title.localeCompare(right.title);
      }

      if (selectedTaskSort === "newest") {
        return getDateTime(right.created_at) - getDateTime(left.created_at);
      }

      return (
        getPriorityRank(left.priority) - getPriorityRank(right.priority) ||
        getNullableDateTime(left.due_date) - getNullableDateTime(right.due_date) ||
        getStatusRank(left.status) - getStatusRank(right.status) ||
        getDateTime(right.created_at) - getDateTime(left.created_at)
      );
    });
  const activeFilterLabels = [
    queryText ? `Search: ${queryText}` : null,
    selectedAssignee ? `Assignee: ${selectedAssignee.label}` : null,
    selectedPriority !== "all" ? `Priority: ${TASK_PRIORITY_LABELS[selectedPriority]}` : null,
    selectedTaskSort !== "default" ? `Sort: ${TASK_SORT_LABELS[selectedTaskSort]}` : null
  ].filter((label): label is string => Boolean(label));

  return (
    <AppFrame shellClassName="project-shell" currentProjectId={project.id}>
      <PageHeader title={project.name} />
      <section className="panel">
        <div className="section-toolbar">
          <h2>Tasks View</h2>
          <div className="toolbar-actions">
            {userCanCreateTask ? <CreateTaskModal projectId={project.id} users={users} /> : null}
          </div>
        </div>
        {project.description ? <p className="project-summary">{project.description}</p> : null}
        <div className="meta-grid detail-meta">
          <div>
            <strong>Start</strong>
            <span>{formatDate(project.start_date)}</span>
          </div>
          <div>
            <strong>Due Date</strong>
            <span>{formatDate(project.ddl)}</span>
          </div>
          <div>
            <strong>Creator</strong>
            <span>{project.owner_name || project.owner_email || "Unassigned"}</span>
          </div>
          <div>
            <strong>Status</strong>
            <span>{formatLabel(project.status)}</span>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="project-group-toolbar table-title-toolbar">
          <details className="title-filter-disclosure" open={activeFilterLabels.length > 0}>
            <summary>
              <span className={`project-keyword task-view-keyword task-view-keyword-${selectedTaskStatus}`}>
                {TASK_STATUS_LABELS[selectedTaskStatus]} Tasks
              </span>
              <span className="title-filter-toggle">Filters</span>
              {activeFilterLabels.length ? (
                <span className="title-filter-chips">
                  {activeFilterLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </span>
              ) : null}
            </summary>
            <form className="title-filter-bar task-filter-bar" action={`/projects/${project.id}`}>
              <input name="taskStatus" type="hidden" value={selectedTaskStatus} />
              <div className="filter-field">
                <label htmlFor="task-search">Search</label>
                <input id="task-search" name="q" type="search" defaultValue={queryText} placeholder="Search tasks" />
              </div>
              <div className="filter-field">
                <label htmlFor="task-assignee">Assignee</label>
                <select id="task-assignee" name="assignee" defaultValue={selectedAssigneeId}>
                  <option value="">Everyone</option>
                  {users.map((assignee) => (
                    <option value={assignee.id} key={assignee.id}>
                      {assignee.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="task-priority">Priority</label>
                <select id="task-priority" name="priority" defaultValue={selectedPriority}>
                  {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriorityFilter[]).map((priority) => (
                    <option value={priority} key={priority}>
                      {TASK_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="task-sort">Sort</label>
                <select id="task-sort" name="sort" defaultValue={selectedTaskSort}>
                  {(Object.keys(TASK_SORT_LABELS) as TaskSort[]).map((sort) => (
                    <option value={sort} key={sort}>
                      {TASK_SORT_LABELS[sort]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-actions">
                <button className="button" type="submit">
                  Apply
                </button>
                <a className="button secondary" href={`/projects/${project.id}`}>
                  Reset
                </a>
              </div>
            </form>
          </details>
          <div className="toolbar-actions">
            <span className="result-count">
              {filteredTasks.length} of {tasksResult.rows.length}
            </span>
            <nav className="table-view-switch" aria-label="Task table view">
              <button className="button secondary table-view-trigger" type="button" aria-haspopup="true">
                Table View: {TASK_STATUS_LABELS[selectedTaskStatus]} ({taskGroups[selectedTaskStatus].length})
              </button>
              <div className="table-view-menu" role="menu">
                {(["active", "done", "all"] as TaskStatusFilter[]).map((status) => (
                  <a
                    className={selectedTaskStatus === status ? "is-active" : ""}
                    href={getTaskHref({
                      projectId: project.id,
                      status,
                      assigneeId: selectedAssigneeId,
                      priority: selectedPriority,
                      queryText,
                      sort: selectedTaskSort
                    })}
                    key={status}
                    role="menuitem"
                  >
                    {TASK_STATUS_LABELS[status]} ({taskGroups[status].length})
                  </a>
                ))}
              </div>
            </nav>
          </div>
        </div>
        <ResizableTaskTable
          ariaLabel={`${project.name} tasks`}
          className="project-task-table"
          defaultWidths={canShowTaskActions ? [280, 200, 110, 120, 110, 126, 180] : [280, 200, 110, 120, 110, 126]}
          storageKey={`project-task-table-widths-${canShowTaskActions ? "editable" : "readonly"}`}
        >
          <div className={`tasks-table-row tasks-table-head task-detail-row${canShowTaskActions ? "" : " task-detail-row-readonly"}`} role="row">
            <ResizableTaskColumnHeader index={0}>Task</ResizableTaskColumnHeader>
            <ResizableTaskColumnHeader index={1}>Assigned To</ResizableTaskColumnHeader>
            <ResizableTaskColumnHeader index={2}>Start</ResizableTaskColumnHeader>
            <ResizableTaskColumnHeader index={3}>Due Date</ResizableTaskColumnHeader>
            <ResizableTaskColumnHeader index={4}>Priority</ResizableTaskColumnHeader>
            <ResizableTaskColumnHeader index={5}>Status</ResizableTaskColumnHeader>
            {canShowTaskActions ? <ResizableTaskColumnHeader index={6}>Actions</ResizableTaskColumnHeader> : null}
          </div>
          {filteredTasks.map((task) => (
            <TaskWithSubtasks
              canManageTask={userCanManageTask}
              canUpdateStatus
              key={task.id}
              subtasks={subtasksByTask.get(task.id) ?? []}
              task={toTaskListItemData(
                project.id,
                project.name,
                task,
                taskCommentsById.get(task.id) ?? [],
                taskLogsById.get(task.id) ?? []
              )}
              users={users}
            />
          ))}
          {filteredTasks.length === 0 ? (
            <div className="tasks-table-empty" role="row">
              No tasks match these filters.
            </div>
          ) : null}
        </ResizableTaskTable>
      </section>
    </AppFrame>
  );
}
