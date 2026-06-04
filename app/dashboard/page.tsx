import { AppFrame } from "@/components/AppFrame";
import { DashboardChart } from "@/components/DashboardChart";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type DashboardPageProps = {
  searchParams: Promise<{ range?: string }>;
};

type WorkloadRange = "week" | "month" | "all";

type TaskRow = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  project_name: string;
  ddl: Date | string;
};

const RANGE_LABELS: Record<WorkloadRange, string> = {
  week: "This Week",
  month: "This Month",
  all: "All Assigned"
};

function normalizeRange(value: string | undefined): WorkloadRange {
  return value === "month" || value === "all" ? value : "week";
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

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
    const ddl = task.ddl instanceof Date ? task.ddl : new Date(`${task.ddl}T00:00:00`);
    return task.status !== "done" && ddl < today;
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
      ? "AND projects.ddl >= $2::date AND projects.ddl < $3::date"
      : "";

  if (window.start && window.end) {
    values.push(toDateInput(window.start), toDateInput(window.end));
  }

  const tasksResult = await query<TaskRow>(
    `SELECT
       tasks.id,
       tasks.title,
       tasks.priority,
       tasks.status,
       projects.name AS project_name,
       projects.ddl
     FROM tasks
     JOIN projects ON projects.id = tasks.project_id
     WHERE tasks.assigned_to_id = $1
       ${windowClause}
     ORDER BY
       CASE projects.status WHEN 'active' THEN 0 ELSE 1 END,
       projects.ddl ASC,
       CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       CASE tasks.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
       tasks.created_at DESC`,
    values
  );

  const tasks = tasksResult.rows;
  const summary = getSummary(tasks);
  const rangeText =
    range === "all"
      ? "across all assigned projects"
      : `for ${RANGE_LABELS[range].toLowerCase()}`;
  const statusData = [
    { name: "Todo", value: summary.todo, color: "#f1e7d9" },
    { name: "In Progress", value: summary.inProgress, color: "#dce9c6" },
    { name: "Done", value: summary.done, color: "#d8e5f0" }
  ];
  const priorityData = [
    { name: "High", value: tasks.filter((task) => task.priority === "high").length, color: "#f2c5bd" },
    { name: "Medium", value: tasks.filter((task) => task.priority === "medium").length, color: "#f6dea3" },
    { name: "Low", value: tasks.filter((task) => task.priority === "low").length, color: "#d8e5f0" }
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
            {(["week", "month", "all"] as WorkloadRange[]).map((option) => (
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
          <a className="button secondary" href="/main-page">
            Back
          </a>
        </div>
        {tasks.length ? (
          <div className="tasks-table" role="table" aria-label="Assigned tasks">
            <div className="tasks-table-row dashboard-task-row tasks-table-head" role="row">
              <strong role="columnheader">Task</strong>
              <strong role="columnheader">Project</strong>
              <strong role="columnheader">DDL</strong>
              <strong role="columnheader">Priority</strong>
              <strong role="columnheader">Status</strong>
            </div>
            {tasks.map((task) => (
              <div className="tasks-table-row dashboard-task-row" role="row" key={task.id}>
                <span role="cell">{task.title}</span>
                <span role="cell">{task.project_name}</span>
                <span role="cell">{formatDate(task.ddl)}</span>
                <span role="cell">
                  <span className={`task-pill priority-${task.priority}`}>{formatLabel(task.priority)}</span>
                </span>
                <span role="cell">
                  <span className={`task-pill task-status-${task.status}`}>{formatLabel(task.status)}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="notice">No assigned tasks in this range.</div>
        )}
      </section>
    </AppFrame>
  );
}
