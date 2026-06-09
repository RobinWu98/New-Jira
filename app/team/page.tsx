import { AppFrame } from "@/components/AppFrame";
import { TaskDetailModal } from "@/components/ProjectForms";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type TeamMemberRow = {
  id: string;
  name: string | null;
  email: string;
  category: string | null;
  role: string;
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

type ProjectTaskGroup = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  tasks: TeamTaskRow[];
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

function groupTasksByProject(tasks: TeamTaskRow[]) {
  const groups = new Map<string, ProjectTaskGroup>();

  for (const task of tasks) {
    const group = groups.get(task.project_id);

    if (group) {
      group.tasks.push(task);
      continue;
    }

    groups.set(task.project_id, {
      projectId: task.project_id,
      projectName: task.project_name,
      projectStatus: task.project_status,
      tasks: [task]
    });
  }

  return Array.from(groups.values());
}

function toTaskDetailData(task: TeamTaskRow, assignedTo: string) {
  return {
    title: task.task_title,
    projectName: task.project_name,
    assignedTo,
    startDate: task.task_start_date ? formatDate(task.task_start_date) : "No date",
    dueDate: formatOptionalDate(task.task_due_date),
    priority: task.task_priority,
    status: task.task_status
  };
}

export default async function TeamPage() {
  await requireUser();

  const [membersResult, tasksResult] = await Promise.all([
    query<TeamMemberRow>(
      `SELECT id, name, email::text AS email, category, role
       FROM users
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
       ORDER BY
         users.name NULLS LAST,
         users.email,
         CASE projects.status WHEN 'active' THEN 0 ELSE 1 END,
         tasks.due_date ASC NULLS LAST,
         projects.name,
         CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         CASE tasks.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         tasks.created_at DESC`
    )
  ]);

  const tasksByUser = new Map<string, TeamTaskRow[]>();

  for (const task of tasksResult.rows) {
    const existingTasks = tasksByUser.get(task.user_id) ?? [];
    existingTasks.push(task);
    tasksByUser.set(task.user_id, existingTasks);
  }

  return (
    <AppFrame shellClassName="project-shell">
      <header className="masthead">
        <h1>Team</h1>
      </header>
      <section className="panel">
        <div className="section-toolbar">
          <h2>Team Workload</h2>
          <a className="button secondary" href="/main-page">
            Back
          </a>
        </div>
        <div className="team-block-list">
          {membersResult.rows.map((member, index) => {
            const memberTasks = tasksByUser.get(member.id) ?? [];
            const projectGroups = groupTasksByProject(memberTasks);
            const remainingCount = memberTasks.filter((task) => task.task_status !== "done").length;
            const memberName = member.name || member.email;

            return (
              <details className="team-member-block" key={member.id} open={index === 0}>
                <summary className="team-member-summary">
                  <span>
                    <strong>{memberName}</strong>
                    <small>{member.category || "Unassigned"} · {member.role}</small>
                  </span>
                  <span>{memberTasks.length} tasks / {remainingCount} remaining</span>
                </summary>
                {projectGroups.length ? (
                  <div className="team-project-list">
                    {projectGroups.map((project) => (
                      <div className="team-project-block" key={project.projectId}>
                        <div className="team-project-name">
                          <a href={`/projects/${project.projectId}`}>{project.projectName}</a>
                          <span className={`status-pill status-${project.projectStatus}`}>
                            {formatLabel(project.projectStatus)}
                          </span>
                        </div>
                        <div className="team-task-list">
                          {project.tasks.map((task) => (
                            <div className="team-task-row" key={task.task_id}>
                              <span>
                                <TaskDetailModal task={toTaskDetailData(task, memberName)} />
                              </span>
                              <span>{formatOptionalDate(task.task_due_date)}</span>
                              <span className={`task-pill priority-${task.task_priority}`}>
                                {formatLabel(task.task_priority)}
                              </span>
                              <span className={`task-pill task-status-${task.task_status}`}>
                                {formatLabel(task.task_status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="notice">No assigned tasks.</div>
                )}
              </details>
            );
          })}
        </div>
      </section>
    </AppFrame>
  );
}
