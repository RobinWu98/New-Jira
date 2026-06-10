import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import { TaskDetailModal, type TaskLogData, type UserOption } from "@/components/ProjectForms";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { syncOverdueWorkItems } from "@/lib/overdue";

type TeamMemberRow = {
  id: string;
  name: string | null;
  email: string;
  category: string | null;
  role: string;
  created_at: Date | string;
};

type TeamTaskRow = {
  user_id: string;
  project_id: string;
  project_name: string;
  project_status: string;
  task_id: string;
  task_title: string;
  task_start_date: Date | string | null;
  task_due_date: Date | string | null;
  task_priority: string;
  task_status: string;
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

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function isOverdue(task: TeamTaskRow) {
  return task.task_status === "overdue";
}

function getFocusTask(tasks: TeamTaskRow[]) {
  return (
    tasks.find((task) => task.task_status === "overdue") ??
    tasks.find((task) => task.task_status === "in_progress") ??
    tasks.find((task) => task.task_status !== "done")
  );
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

function toTaskDetailData(task: TeamTaskRow, assignedTo: string, mentionUsers: UserOption[], logs: TaskLogData[]) {
  return {
    id: task.task_id,
    projectId: task.project_id,
    type: "task" as const,
    title: task.task_title,
    projectName: task.project_name,
    assignedTo,
    startDate: task.task_start_date ? formatDate(task.task_start_date) : "No date",
    dueDate: formatOptionalDate(task.task_due_date),
    priority: task.task_priority,
    status: task.task_status,
    comments: [],
    logs,
    mentionUsers
  };
}

export default async function TeamPage() {
  await requireUser();
  await syncOverdueWorkItems();

  const [membersResult, tasksResult] = await Promise.all([
    query<TeamMemberRow>(
      `SELECT id, name, email::text AS email, category, role, created_at
       FROM users
       WHERE archived_at IS NULL
       ORDER BY name NULLS LAST, email`
    ),
    query<TeamTaskRow>(
      `SELECT
         users.id AS user_id,
         projects.id AS project_id,
         projects.name AS project_name,
         projects.status AS project_status,
         tasks.id AS task_id,
         tasks.title AS task_title,
         tasks.start_date AS task_start_date,
         tasks.due_date AS task_due_date,
         tasks.priority AS task_priority,
         tasks.status AS task_status
       FROM users
       JOIN tasks ON tasks.assigned_to_id = users.id
       JOIN projects ON projects.id = tasks.project_id
       WHERE users.archived_at IS NULL
         AND tasks.archived_at IS NULL
         AND projects.archived_at IS NULL
       ORDER BY
         users.name NULLS LAST,
         users.email,
         CASE projects.status WHEN 'active' THEN 0 ELSE 1 END,
         CASE tasks.status WHEN 'overdue' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
         tasks.due_date ASC NULLS LAST,
         CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         projects.name,
         tasks.created_at DESC`
    )
  ]);

  const tasksByUser = new Map<string, TeamTaskRow[]>();
  const taskIds = tasksResult.rows.map((task) => task.task_id);
  const logsResult = taskIds.length
    ? await query<LogRow>(
        `SELECT
           work_item_logs.id,
           work_item_logs.task_id AS work_item_id,
           users.name AS actor_name,
           users.email::text AS actor_email,
           work_item_logs.action,
           work_item_logs.body,
           work_item_logs.created_at
         FROM work_item_logs
         LEFT JOIN users ON users.id = work_item_logs.actor_id
         WHERE work_item_logs.task_id = ANY($1::uuid[])
           AND work_item_logs.subtask_id IS NULL
         ORDER BY work_item_logs.created_at ASC`,
        [taskIds]
      )
    : { rows: [] };
  const logsByTask = groupLogs(logsResult.rows);
  const mentionUsers = membersResult.rows.map((member) => ({
    id: member.id,
    label: member.name ? `${member.name} (${member.email})` : member.email,
    createdAt: member.created_at instanceof Date ? member.created_at.toISOString() : String(member.created_at)
  }));

  for (const task of tasksResult.rows) {
    const existingTasks = tasksByUser.get(task.user_id) ?? [];
    existingTasks.push(task);
    tasksByUser.set(task.user_id, existingTasks);
  }

  const teamSummary = {
    active: tasksResult.rows.filter((task) => task.task_status !== "done").length,
    inProgress: tasksResult.rows.filter((task) => task.task_status === "in_progress").length,
    overdue: tasksResult.rows.filter(isOverdue).length
  };

  return (
    <AppFrame shellClassName="team-shell">
      <PageHeader title="Team" />
      <section className="panel team-overview-panel">
        <div className="section-toolbar">
          <h2>Team Snapshot</h2>
        </div>
        <div className="team-summary-strip" aria-label="Team workload summary">
          <div>
            <strong>{membersResult.rows.length}</strong>
            <span>People</span>
          </div>
          <div>
            <strong>{teamSummary.active}</strong>
            <span>Active Tasks</span>
          </div>
          <div>
            <strong>{teamSummary.inProgress}</strong>
            <span>In Progress</span>
          </div>
          <div>
            <strong>{teamSummary.overdue}</strong>
            <span>Overdue</span>
          </div>
        </div>
      </section>
      <section className="team-board" aria-label="Team workload by person">
        {membersResult.rows.map((member) => {
          const memberTasks = tasksByUser.get(member.id) ?? [];
          const remainingCount = memberTasks.filter((task) => task.task_status !== "done").length;
          const doneCount = memberTasks.filter((task) => task.task_status === "done").length;
          const inProgressCount = memberTasks.filter((task) => task.task_status === "in_progress").length;
          const overdueCount = memberTasks.filter(isOverdue).length;
          const focusTask = getFocusTask(memberTasks);
          const memberName = member.name || member.email;

          return (
            <article className="team-member-card" key={member.id}>
              <header className="team-member-card-header">
                <div>
                  <h2>{memberName}</h2>
                  <p>{member.category || "Unassigned"} · {member.role}</p>
                </div>
                <span className={`team-load-badge${overdueCount ? " is-alert" : remainingCount ? "" : " is-clear"}`}>
                  {remainingCount} active
                </span>
              </header>
              <div className="team-member-stats">
                <span>{inProgressCount} in progress</span>
                <span>{doneCount} done</span>
                <span>{overdueCount} overdue</span>
              </div>
              <div className="team-focus-line">
                <strong>Now</strong>
                {focusTask ? (
                  <span>
                    <TaskDetailModal
                      task={toTaskDetailData(focusTask, memberName, mentionUsers, logsByTask.get(focusTask.task_id) ?? [])}
                    />
                    <small>{focusTask.project_name}</small>
                  </span>
                ) : (
                  <span>No active task</span>
                )}
              </div>
              {memberTasks.length ? (
                <div className="team-task-list">
                  {memberTasks.slice(0, 5).map((task) => (
                    <div className="team-task-row" key={task.task_id}>
                      <span>
                        <TaskDetailModal
                          task={toTaskDetailData(task, memberName, mentionUsers, logsByTask.get(task.task_id) ?? [])}
                        />
                        <small>{task.project_name}</small>
                      </span>
                      <span>{formatOptionalDate(task.task_due_date)}</span>
                      <span className={`task-pill priority-${task.task_priority}`}>{formatLabel(task.task_priority)}</span>
                      <span className={`task-pill task-status-${task.task_status}`}>{formatLabel(task.task_status)}</span>
                    </div>
                  ))}
                  {memberTasks.length > 5 ? <div className="team-more-link">{memberTasks.length - 5} more tasks</div> : null}
                </div>
              ) : (
                <div className="team-empty-state">No assigned tasks</div>
              )}
            </article>
          );
        })}
      </section>
    </AppFrame>
  );
}
