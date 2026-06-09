import { AppFrame } from "@/components/AppFrame";
import { DashboardChart } from "@/components/DashboardChart";
import { TaskDetailModal, type TaskCommentData, type UserOption } from "@/components/ProjectForms";
import { ResizableTaskColumnHeader, ResizableTaskTable } from "@/components/ResizableTaskTable";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type DashboardPageProps = {
  searchParams: Promise<{ range?: string }>;
};

type WorkloadRange = "week" | "month" | "all";

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  project_name: string;
  assigned_to_name: string | null;
  assigned_to_email: string;
  start_date: Date | string | null;
  due_date: Date | string | null;
};

type CommentRow = {
  id: string;
  work_item_id: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: Date | string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  created_at: Date | string;
};

const RANGE_LABELS: Record<WorkloadRange, string> = {
  week: "This Week",
  month: "This Month",
  all: "All Assigned"
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

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatOptionalDate(value: Date | string | null) {
  return value ? formatDate(value) : "No due date";
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

function toCommentData(comment: CommentRow): TaskCommentData {
  return {
    id: comment.id,
    author: comment.author_name || comment.author_email || "Deleted user",
    body: comment.body,
    createdAt: formatDateTime(comment.created_at)
  };
}

function groupComments(comments: CommentRow[]) {
  const groups = new Map<string, TaskCommentData[]>();

  for (const comment of comments) {
    const existing = groups.get(comment.work_item_id) ?? [];
    existing.push(toCommentData(comment));
    groups.set(comment.work_item_id, existing);
  }

  return groups;
}

function toTaskDetailData(task: TaskRow, comments: TaskCommentData[], mentionUsers: UserOption[]) {
  return {
    id: task.id,
    projectId: task.project_id,
    type: "task" as const,
    title: task.title,
    projectName: task.project_name,
    assignedTo: task.assigned_to_name || task.assigned_to_email,
    startDate: task.start_date ? formatDate(task.start_date) : "No date",
    dueDate: formatOptionalDate(task.due_date),
    priority: task.priority,
    status: task.status,
    comments,
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

function getSummary(tasks: TaskRow[]) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const todo = tasks.filter((task) => task.status === "todo").length;
  const remaining = total - done;
  const highRemaining = tasks.filter((task) => task.priority === "high" && task.status !== "done").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter((task) => {
    if (!task.due_date) {
      return false;
    }

    const dueDate = task.due_date instanceof Date ? task.due_date : new Date(`${task.due_date}T00:00:00`);
    return task.status !== "done" && dueDate < today;
  }).length;

  return { total, done, inProgress, todo, remaining, highRemaining, overdue };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const range = normalizeRange(params.range);
  const window = getRangeWindow(range);

  const values: unknown[] = [user.id];
  const windowClause =
    window.start && window.end
      ? "AND tasks.due_date >= $2::date AND tasks.due_date < $3::date"
      : "";

  if (window.start && window.end) {
    values.push(toDateInput(window.start), toDateInput(window.end));
  }

  const [tasksResult, usersResult] = await Promise.all([
    query<TaskRow>(
      `SELECT
         tasks.id,
         tasks.project_id,
         tasks.title,
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
         ${windowClause}
       ORDER BY
         CASE projects.status WHEN 'active' THEN 0 ELSE 1 END,
         tasks.due_date ASC NULLS LAST,
         CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         CASE tasks.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         tasks.created_at DESC`,
      values
    ),
    query<UserRow>("SELECT id, name, email::text AS email, created_at FROM users ORDER BY name NULLS LAST, email")
  ]);

  const tasks = tasksResult.rows;
  const mentionUsers = usersResult.rows.map((user) => ({
    id: user.id,
    label: user.name ? `${user.name} (${user.email})` : user.email,
    createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at)
  }));
  const taskIds = tasks.map((task) => task.id);
  const commentsResult = taskIds.length
    ? await query<CommentRow>(
        `SELECT
           task_comments.id,
           task_comments.task_id AS work_item_id,
           users.name AS author_name,
           users.email::text AS author_email,
           task_comments.body,
           task_comments.created_at
         FROM task_comments
         LEFT JOIN users ON users.id = task_comments.author_id
         WHERE task_comments.task_id = ANY($1::uuid[])
         ORDER BY task_comments.created_at ASC`,
        [taskIds]
      )
    : { rows: [] };
  const commentsByTask = groupComments(commentsResult.rows);
  const summary = getSummary(tasks);
  const rangeText =
    range === "all"
      ? "across all assigned projects"
      : `for ${RANGE_LABELS[range].toLowerCase()}`;
  const statusData = [
    { name: "Todo", value: summary.todo, color: "#8590a2" },
    { name: "In Progress", value: summary.inProgress, color: "#0c66e4" },
    { name: "Done", value: summary.done, color: "#22a06b" }
  ];
  const priorityData = [
    { name: "High", value: tasks.filter((task) => task.priority === "high").length, color: "#f15b50" },
    { name: "Medium", value: tasks.filter((task) => task.priority === "medium").length, color: "#f5cd47" },
    { name: "Low", value: tasks.filter((task) => task.priority === "low").length, color: "#579dff" }
  ];

  return (
    <AppFrame shellClassName="dashboard-shell">
      <header className="masthead">
        <h1>My Dashboard</h1>
        <p>{user.name || user.email}</p>
      </header>
      <section className="panel">
        <div className="section-toolbar">
          <h2>Workload Summary</h2>
          <nav className="segmented-nav" aria-label="Dashboard range">
            {(["all", "month", "week"] as WorkloadRange[]).map((option) => (
              <a
                className={`button secondary${range === option ? " is-active" : ""}`}
                href={`/dashboard?range=${option}`}
                key={option}
              >
                {RANGE_LABELS[option]}
              </a>
            ))}
          </nav>
        </div>
        <div className="notice">
          You have {summary.total} task{summary.total === 1 ? "" : "s"} {rangeText}; {summary.remaining} remain
          {summary.overdue ? `, including ${summary.overdue} overdue` : ""}.
        </div>
        <div className="summary-grid">
          <div>
            <strong>Total</strong>
            <span>{summary.total}</span>
          </div>
          <div>
            <strong>Remaining</strong>
            <span>{summary.remaining}</span>
          </div>
          <div>
            <strong>In Progress</strong>
            <span>{summary.inProgress}</span>
          </div>
          <div>
            <strong>Done</strong>
            <span>{summary.done}</span>
          </div>
          <div>
            <strong>High Priority</strong>
            <span>{summary.highRemaining}</span>
          </div>
          <div>
            <strong>Overdue</strong>
            <span>{summary.overdue}</span>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>Workload Chart</h2>
        <DashboardChart statusData={statusData} priorityData={priorityData} />
      </section>
      <section className="panel">
        <div className="section-toolbar">
          <h2>Assigned Tasks</h2>
        </div>
        {tasks.length ? (
          <ResizableTaskTable
            ariaLabel="Assigned tasks"
            className="dashboard-task-table"
            defaultWidths={[280, 210, 130, 120, 130]}
            storageKey="dashboard-task-table-widths"
          >
            <div className="tasks-table-row dashboard-task-row tasks-table-head" role="row">
              <ResizableTaskColumnHeader index={0}>Task</ResizableTaskColumnHeader>
              <ResizableTaskColumnHeader index={1}>Project</ResizableTaskColumnHeader>
              <ResizableTaskColumnHeader index={2}>Due Date</ResizableTaskColumnHeader>
              <ResizableTaskColumnHeader index={3}>Priority</ResizableTaskColumnHeader>
              <ResizableTaskColumnHeader index={4}>Status</ResizableTaskColumnHeader>
            </div>
            {tasks.map((task) => (
              <div className="tasks-table-row dashboard-task-row" role="row" key={task.id}>
                <span role="cell">
                  <TaskDetailModal task={toTaskDetailData(task, commentsByTask.get(task.id) ?? [], mentionUsers)} />
                </span>
                <span role="cell">{task.project_name}</span>
                <span role="cell">{formatOptionalDate(task.due_date)}</span>
                <span role="cell">
                  <span className={`task-pill priority-${task.priority}`}>{formatLabel(task.priority)}</span>
                </span>
                <span role="cell">
                  <span className={`task-pill task-status-${task.status}`}>{formatLabel(task.status)}</span>
                </span>
              </div>
            ))}
          </ResizableTaskTable>
        ) : (
          <div className="notice">No assigned tasks in this range.</div>
        )}
      </section>
    </AppFrame>
  );
}
