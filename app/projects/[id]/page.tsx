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
};

type TaskRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigned_to_id: string;
  assigned_to_name: string | null;
  assigned_to_email: string;
  created_at: Date | string;
};

type TaskPriorityFilter = "all" | "high" | "medium" | "low";
type TaskStatusFilter = "active" | "done" | "all";
type TaskSort = "default" | "priority" | "status" | "assignee" | "title" | "newest";

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
  default: "Active + Priority",
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
  return value === "priority" || value === "status" || value === "assignee" || value === "title" || value === "newest"
    ? value
    : "default";
}

function getDateTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
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
    priority: task.priority,
    status: task.status
  };
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
         users.email::text AS assigned_to_email,
         tasks.created_at
       FROM tasks
       JOIN users ON users.id = tasks.assigned_to_id
       WHERE tasks.project_id = $1
       ORDER BY
         CASE tasks.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         CASE tasks.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         tasks.created_at DESC`,
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
  const canModify = user.role === "admin";
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
        getStatusRank(left.status) - getStatusRank(right.status) ||
        getPriorityRank(left.priority) - getPriorityRank(right.priority) ||
        getDateTime(right.created_at) - getDateTime(left.created_at)
      );
    });

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
        <div className="project-group-toolbar">
          <h2>
            <span className={`project-keyword task-view-keyword task-view-keyword-${selectedTaskStatus}`}>
              {TASK_STATUS_LABELS[selectedTaskStatus]} Tasks
            </span>
          </h2>
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
        <form className="filter-bar task-filter-bar" action={`/projects/${project.id}`}>
          <input name="taskStatus" type="hidden" value={selectedTaskStatus} />
          <div className="filter-field">
            <label htmlFor="task-search">Search</label>
            <input id="task-search" name="q" type="search" defaultValue={queryText} placeholder="Task or assignee" />
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
        <div className="tasks-table" role="table" aria-label={`${project.name} tasks`}>
          <div className={`tasks-table-row tasks-table-head task-detail-row${canModify ? "" : " task-detail-row-readonly"}`} role="row">
            <strong role="columnheader">Task</strong>
            <strong role="columnheader">Assigned To</strong>
            <strong role="columnheader">Priority</strong>
            <strong role="columnheader">Status</strong>
            {canModify ? <strong role="columnheader">Actions</strong> : null}
          </div>
          {filteredTasks.map((task) => (
            <div className={`tasks-table-row task-detail-row${canModify ? "" : " task-detail-row-readonly"}`} role="row" key={task.id}>
              <span role="cell">{task.title}</span>
              <span role="cell">{task.assigned_to_name || task.assigned_to_email}</span>
              <span role="cell">
                <span className={`task-pill priority-${task.priority}`}>{formatLabel(task.priority)}</span>
              </span>
              <span role="cell">
                <span className={`task-pill task-status-${task.status}`}>{formatLabel(task.status)}</span>
              </span>
              {canModify ? (
                <span role="cell" className="table-actions">
                  <EditTaskModal projectId={project.id} users={users} task={toTaskFormData(project.id, task)} />
                  <DeleteTaskForm projectId={project.id} taskId={task.id} />
                </span>
              ) : null}
            </div>
          ))}
          {filteredTasks.length === 0 ? (
            <div className="tasks-table-empty" role="row">
              No tasks match these filters.
            </div>
          ) : null}
        </div>
      </section>
    </AppFrame>
  );
}
