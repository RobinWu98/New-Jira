import { notFound } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import {
  CreateTaskModal,
  DeleteTaskForm,
  EditTaskModal,
  type TaskFormData
} from "@/components/ProjectForms";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
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
};

type TaskRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigned_to_id: string;
  assigned_to_name: string | null;
  assigned_to_email: string;
};

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toTaskFormData(projectId: string, task: TaskRow): TaskFormData {
  return {
    id: task.id,
    projectId,
    title: task.title,
    assignedToId: task.assigned_to_id,
    priority: task.priority,
    status: task.status
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  await requireUser();
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const [projectResult, tasksResult, usersResult] = await Promise.all([
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
       LIMIT 1`,
      [id]
    ),
    query<TaskRow>(
      `SELECT
         tasks.id,
         tasks.title,
         tasks.priority,
         tasks.status,
         tasks.assigned_to_id,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email
       FROM tasks
       JOIN users ON users.id = tasks.assigned_to_id
       WHERE tasks.project_id = $1
       ORDER BY tasks.created_at DESC`,
      [id]
    ),
    query<UserRow>("SELECT id, name, email::text AS email FROM users ORDER BY name NULLS LAST, email")
  ]);

  const project = projectResult.rows[0];

  if (!project) {
    notFound();
  }

  const users = usersResult.rows.map((user) => ({
    id: user.id,
    label: user.name ? `${user.name} (${user.email})` : user.email
  }));

  return (
    <AppFrame shellClassName="project-shell" currentProjectId={project.id}>
      <header className="masthead">
        <h1>{project.name}</h1>
      </header>
      <section className="panel">
        <div className="section-toolbar">
          <h2>Tasks View</h2>
          <div className="toolbar-actions">
            <CreateTaskModal projectId={project.id} users={users} />
            <a className="button secondary" href="/projects">
              Back
            </a>
          </div>
        </div>
        {project.description ? <p className="project-summary">{project.description}</p> : null}
        <div className="meta-grid detail-meta">
          <div>
            <strong>Start</strong>
            <span>{formatDate(project.start_date)}</span>
          </div>
          <div>
            <strong>DDL</strong>
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
        <h2>Tasks</h2>
        <div className="tasks-table" role="table" aria-label={`${project.name} tasks`}>
          <div className="tasks-table-row tasks-table-head task-detail-row" role="row">
            <strong role="columnheader">Task</strong>
            <strong role="columnheader">Assigned To</strong>
            <strong role="columnheader">Priority</strong>
            <strong role="columnheader">Status</strong>
            <strong role="columnheader">Actions</strong>
          </div>
          {tasksResult.rows.map((task) => (
            <div className="tasks-table-row task-detail-row" role="row" key={task.id}>
              <span role="cell">{task.title}</span>
              <span role="cell">{task.assigned_to_name || task.assigned_to_email}</span>
              <span role="cell">
                <span className={`task-pill priority-${task.priority}`}>{formatLabel(task.priority)}</span>
              </span>
              <span role="cell">
                <span className={`task-pill task-status-${task.status}`}>{formatLabel(task.status)}</span>
              </span>
              <span role="cell" className="table-actions">
                <EditTaskModal projectId={project.id} users={users} task={toTaskFormData(project.id, task)} />
                <DeleteTaskForm projectId={project.id} taskId={task.id} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </AppFrame>
  );
}
