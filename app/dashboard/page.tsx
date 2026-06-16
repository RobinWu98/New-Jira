import { AppFrame } from "@/components/AppFrame";
import { DropdownArrowIcon } from "@/components/AntArrowIcons";
import { PageHeader } from "@/components/PageHeader";
import { type TaskCommentData, type TaskLogData, type UserOption } from "@/components/ProjectForms";
import { WorkItemsAntTable, type WorkItemAntTableRow } from "@/components/WorkItemsAntTable";
import { UiButton } from "@/components/UiControls";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { syncOverdueWorkItems } from "@/lib/overdue";

type DashboardPageProps = {
  searchParams: Promise<{ range?: string }>;
};

type WorkloadRange = "week" | "month" | "all";

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "overdue" | "done";
  project_name: string;
  assigned_to_name: string | null;
  assigned_to_email: string;
  start_date: Date | string | null;
  due_date: Date | string | null;
};

type SubtaskRow = TaskRow;

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
  work_item_id: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  created_at: Date | string;
};

const RANGE_LABELS: Record<WorkloadRange, string> = {
  all: "All tasks",
  month: "Due this month",
  week: "Due this week"
};

function normalizeRange(value: string | undefined): WorkloadRange {
  return value === "week" || value === "month" ? value : "all";
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toOptionalDateInput(value: Date | string | null) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatOptionalDate(value: Date | string | null) {
  return value ? formatDate(value) : "No due date";
}

function calculateOpenDays(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const start = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((todayDay.getTime() - startDay.getTime()) / 86_400_000);

  return Math.max(days, 0);
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

function groupLogs(logs: LogRow[]) {
  const groups = new Map<string, TaskLogData[]>();

  for (const log of logs) {
    const existing = groups.get(log.work_item_id) ?? [];
    existing.push(toLogData(log));
    groups.set(log.work_item_id, existing);
  }

  return groups;
}

function toTaskDetailData(task: TaskRow, comments: TaskCommentData[], logs: TaskLogData[], mentionUsers: UserOption[]) {
  return {
    id: task.id,
    projectId: task.project_id,
    type: "task" as const,
    title: task.title,
    description: task.description ?? "",
    projectName: task.project_name,
    assignedTo: task.assigned_to_name || task.assigned_to_email,
    startDate: task.start_date ? formatDate(task.start_date) : "No date",
    dueDate: formatOptionalDate(task.due_date),
    priority: task.priority,
    status: task.status,
    comments,
    logs,
    mentionUsers
  };
}

function getRangeWindow(range: WorkloadRange) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "week") {
    const start = startOfWeek(today);
    return { start, end: addDays(start, 7) };
  }

  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start, end: addMonths(start, 1) };
  }

  return { start: null, end: null };
}

function getDateOnly(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isInRange(task: TaskRow, range: WorkloadRange) {
  if (range === "all") {
    return true;
  }

  const dueDate = getDateOnly(task.due_date);
  const window = getRangeWindow(range);

  return Boolean(dueDate && window.start && window.end && dueDate >= window.start && dueDate < window.end);
}

function getRangeHref(range: WorkloadRange) {
  return `/dashboard?range=${range}`;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const range = normalizeRange(params.range);

  await syncOverdueWorkItems();

  const [tasksResult, subtasksResult, usersResult] = await Promise.all([
    query<TaskRow>(
      `SELECT
         tasks.id,
         tasks.project_id,
         tasks.title,
         tasks.description,
         tasks.priority,
         tasks.status,
         projects.name AS project_name,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email,
         tasks.start_date,
         tasks.due_date
     FROM tasks
     JOIN projects ON projects.id = tasks.project_id
     JOIN users ON users.id = tasks.assigned_to_id
     WHERE tasks.assigned_to_id = $1
       AND tasks.archived_at IS NULL
       AND projects.archived_at IS NULL
       ORDER BY
         CASE projects.status WHEN 'active' THEN 0 ELSE 1 END,
         tasks.due_date ASC NULLS LAST,
         CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         CASE tasks.status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
         tasks.created_at DESC`,
      [user.id]
    ),
    query<SubtaskRow>(
      `SELECT
         subtasks.id,
         tasks.project_id,
         subtasks.title,
         NULL::text AS description,
         subtasks.priority,
         subtasks.status,
         projects.name AS project_name,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email,
         subtasks.start_date,
         subtasks.due_date
       FROM subtasks
       JOIN tasks ON tasks.id = subtasks.task_id
       JOIN projects ON projects.id = tasks.project_id
       JOIN users ON users.id = subtasks.assigned_to_id
       WHERE subtasks.assigned_to_id = $1
         AND subtasks.archived_at IS NULL
         AND tasks.archived_at IS NULL
         AND projects.archived_at IS NULL
       ORDER BY
         subtasks.due_date ASC NULLS LAST,
         CASE subtasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         CASE subtasks.status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
         subtasks.created_at DESC`,
      [user.id]
    ),
    query<UserRow>(
      "SELECT id, name, email::text AS email, created_at FROM users WHERE archived_at IS NULL ORDER BY name NULLS LAST, email"
    )
  ]);

  // merge tasks and subtasks — treat them equally
  const allTasks = [...tasksResult.rows, ...subtasksResult.rows.map((s) => ({
    id: s.id,
    project_id: s.project_id,
    title: s.title,
    description: s.description,
    priority: s.priority,
    status: s.status,
    project_name: s.project_name,
    assigned_to_name: s.assigned_to_name,
    assigned_to_email: s.assigned_to_email,
    start_date: s.start_date,
    due_date: s.due_date
  }))];
  const rangeCounts = {
    all: allTasks.length,
    month: allTasks.filter((task) => isInRange(task, "month")).length,
    week: allTasks.filter((task) => isInRange(task, "week")).length
  } satisfies Record<WorkloadRange, number>;
  const tasks = allTasks.filter((task) => isInRange(task, range));
  const mentionUsers = usersResult.rows.map((user) => ({
    id: user.id,
    label: user.name ? `${user.name} (${user.email})` : user.email,
    createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at)
  }));
  const itemIds = tasks.map((task) => task.id);
  const commentsResult = itemIds.length
          ? await query<CommentRow>(
              `SELECT task_comments.id AS id, task_id AS work_item_id, author_id, users.name AS author_name, users.email::text AS author_email, body, task_comments.created_at AS created_at
         FROM task_comments
         LEFT JOIN users ON users.id = task_comments.author_id
         WHERE task_comments.task_id = ANY($1::uuid[])
         UNION ALL
                  SELECT subtask_comments.id AS id, subtask_id AS work_item_id, author_id, users.name AS author_name, users.email::text AS author_email, body, subtask_comments.created_at AS created_at
         FROM subtask_comments
         LEFT JOIN users ON users.id = subtask_comments.author_id
         WHERE subtask_comments.subtask_id = ANY($1::uuid[])
         ORDER BY created_at ASC`,
        [itemIds]
      )
    : { rows: [] };

  const logsResult = itemIds.length
    ? await query<LogRow>(
        `SELECT work_item_logs.id, COALESCE(work_item_logs.subtask_id::text, work_item_logs.task_id::text) AS work_item_id, users.name AS actor_name, users.email::text AS actor_email, work_item_logs.action, work_item_logs.body, work_item_logs.created_at
         FROM work_item_logs
         LEFT JOIN users ON users.id = work_item_logs.actor_id
         WHERE (work_item_logs.task_id = ANY($1::uuid[]) OR work_item_logs.subtask_id = ANY($1::uuid[]))
         ORDER BY work_item_logs.created_at ASC`,
        [itemIds]
      )
    : { rows: [] };
  const commentsByTask = groupComments(commentsResult.rows, user);
  const logsByTask = groupLogs(logsResult.rows);
  const taskRows: WorkItemAntTableRow[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    projectName: task.project_name,
    openDays: calculateOpenDays(task.start_date),
    startLabel: task.start_date ? formatDate(task.start_date) : "No date",
    dueLabel: formatOptionalDate(task.due_date),
    dueSort: toOptionalDateInput(task.due_date),
    priority: task.priority,
    status: task.status,
    detail: toTaskDetailData(task, commentsByTask.get(task.id) ?? [], logsByTask.get(task.id) ?? [], mentionUsers)
  }));

  return (
    <AppFrame shellClassName="dashboard-shell">
      <PageHeader title="My Dashboard" subtitle={`Welcome, ${user.name || user.email}`} />
      <section className="panel">
        <div className="section-toolbar">
          <h2>My tasks ({taskRows.length})</h2>
          <nav className="table-view-switch" aria-label="Dashboard task range">
            <UiButton variant="secondary" className="table-view-trigger dashboard-range-trigger" type="button" aria-haspopup="true">
              <span>{RANGE_LABELS[range]} ({rangeCounts[range]})</span>
              <DropdownArrowIcon />
            </UiButton>
            <div className="table-view-menu" role="menu">
              {(["all", "month", "week"] as WorkloadRange[]).map((option) => (
                <a
                  className={range === option ? "is-active" : ""}
                  href={getRangeHref(option)}
                  key={option}
                  role="menuitem"
                >
                  {RANGE_LABELS[option]} ({rangeCounts[option]})
                </a>
              ))}
            </div>
          </nav>
        </div>
        {taskRows.length ? (
          <WorkItemsAntTable
            enableProjectSort={false}
            groupByProject
            rows={taskRows}
            showProject
            showOpenDays
            showResetFilters={false}
            showStart={false}
            showToolbarTitle={false}
            title="Tasks"
          />
        ) : (
          <div className="notice">No assigned tasks in this range.</div>
        )}
      </section>
    </AppFrame>
  );
}
