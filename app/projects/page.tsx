import { AppFrame } from "@/components/AppFrame";
import { DraggableScroll } from "@/components/DraggableScroll";
import {
  CreateProjectModal,
  DeleteProjectForm,
  EditProjectModal,
  type ProjectFormData
} from "@/components/ProjectForms";
import { requireUser } from "@/lib/auth";
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
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  task_count: string;
  created_at: Date | string;
};

type ProjectStatusFilter = "active" | "done" | "all";
type ProjectSort = "ddl_asc" | "ddl_desc" | "name_asc" | "newest" | "tasks_desc";

type ProjectsPageProps = {
  searchParams: Promise<{ status?: string; owner?: string; q?: string; sort?: string }>;
};

const PROJECT_STATUS_LABELS: Record<ProjectStatusFilter, string> = {
  active: "Active",
  done: "Completed",
  all: "View All"
};

const PROJECT_SORT_LABELS: Record<ProjectSort, string> = {
  ddl_asc: "Due Date Soonest",
  ddl_desc: "Due Date Latest",
  name_asc: "Name A-Z",
  newest: "Newest",
  tasks_desc: "Most Tasks"
};

function normalizeStatusFilter(value: string | undefined): ProjectStatusFilter {
  return value === "done" || value === "completed" ? "done" : value === "all" ? "all" : "active";
}

function normalizeProjectSort(value: string | undefined): ProjectSort {
  return value === "ddl_desc" || value === "name_asc" || value === "newest" || value === "tasks_desc"
    ? value
    : "ddl_asc";
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

function normalizeProjectStatus(status: string) {
  return status === "done" ? "done" : "active";
}

function getDateTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(`${value}T00:00:00`).getTime();
}

function getProjectHref(params: { status: ProjectStatusFilter; ownerId: string; queryText: string; sort: ProjectSort }) {
  const next = new URLSearchParams();
  next.set("status", params.status);

  if (params.ownerId) {
    next.set("owner", params.ownerId);
  }

  if (params.queryText) {
    next.set("q", params.queryText);
  }

  if (params.sort !== "ddl_asc") {
    next.set("sort", params.sort);
  }

  return `/projects?${next.toString()}`;
}

function toProjectFormData(project: ProjectRow): ProjectFormData {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    startDate: toDateInput(project.start_date),
    ddl: toDateInput(project.ddl),
    ownerId: project.owner_id ?? "",
    status: normalizeProjectStatus(project.status)
  };
}

function ProjectTable({
  title,
  status,
  projects,
  users,
  currentUserId,
  canModify,
  viewSwitch,
  searchForm
}: {
  title: string;
  status: ProjectStatusFilter;
  projects: ProjectRow[];
  users: { id: string; label: string }[];
  currentUserId: string;
  canModify: boolean;
  viewSwitch: React.ReactNode;
  searchForm: React.ReactNode;
}) {
  return (
    <div className={`project-group project-group-${status}`}>
      <div className="project-group-toolbar">
        <h3>
          <span className={`project-keyword project-keyword-${status}`}>{PROJECT_STATUS_LABELS[status]} Projects</span>
        </h3>
        <div className="toolbar-actions">
          {searchForm}
          {viewSwitch}
        </div>
      </div>
      <DraggableScroll>
        <div className={`project-list project-list-${status}`} role="table" aria-label={title}>
          <div className="project-list-row project-list-head" role="row">
            <strong role="columnheader">Project</strong>
            <strong role="columnheader">Start</strong>
            <strong role="columnheader">Due Date</strong>
            <strong role="columnheader">Creator</strong>
            <strong role="columnheader">Actions</strong>
          </div>
          {projects.map((project) => (
            <div className="project-list-row" role="row" key={project.id}>
              <span role="cell">
                <a className="project-row-link" href={`/projects/${project.id}`}>
                  {project.name}
                </a>
              </span>
              <span role="cell">{formatDate(project.start_date)}</span>
              <span role="cell">{formatDate(project.ddl)}</span>
              <span role="cell">{project.owner_name || project.owner_email || "Unassigned"}</span>
              <span role="cell" className="record-actions">
                {canModify ? (
                  <>
                    <EditProjectModal users={users} currentUserId={currentUserId} project={toProjectFormData(project)} />
                    <DeleteProjectForm projectId={project.id} />
                  </>
                ) : (
                  <a className="button secondary" href={`/projects/${project.id}`}>
                    View
                  </a>
                )}
              </span>
            </div>
          ))}
          {projects.length === 0 ? (
            <div className="project-list-empty" role="row">
              No {PROJECT_STATUS_LABELS[status].toLowerCase()} projects match this view.
            </div>
          ) : null}
        </div>
      </DraggableScroll>
    </div>
  );
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedStatus = normalizeStatusFilter(params.status);
  const selectedSort = normalizeProjectSort(params.sort);
  const selectedOwnerId = params.owner ?? "";
  const queryText = (params.q ?? "").trim();

  const [usersResult, projectsResult] = await Promise.all([
    query<UserRow>("SELECT id, name, email::text AS email FROM users ORDER BY name NULLS LAST, email"),
    query<ProjectRow>(
      `SELECT
         projects.id,
         projects.name,
         projects.description,
         projects.start_date,
         projects.ddl,
         projects.status,
         projects.owner_id,
         users.name AS owner_name,
         users.email::text AS owner_email,
         COUNT(tasks.id)::text AS task_count,
         projects.created_at
       FROM projects
       LEFT JOIN users ON users.id = projects.owner_id
       LEFT JOIN tasks ON tasks.project_id = projects.id
       GROUP BY projects.id, users.name, users.email
       ORDER BY CASE projects.status WHEN 'active' THEN 0 ELSE 1 END, projects.ddl ASC, projects.created_at DESC`
    )
  ]);

  const users = usersResult.rows.map((row) => ({
    id: row.id,
    label: row.name ? `${row.name} (${row.email})` : row.email
  }));
  const filteredProjects = projectsResult.rows
    .filter((project) => (selectedOwnerId ? project.owner_id === selectedOwnerId : true))
    .filter((project) => {
      if (!queryText) {
        return true;
      }

      const needle = queryText.toLowerCase();
      return [project.name, project.description ?? "", project.owner_name ?? "", project.owner_email ?? ""].some((value) =>
        value.toLowerCase().includes(needle)
      );
    })
    .sort((left, right) => {
      if (selectedSort === "ddl_desc") {
        return getDateTime(right.ddl) - getDateTime(left.ddl);
      }

      if (selectedSort === "name_asc") {
        return left.name.localeCompare(right.name);
      }

      if (selectedSort === "newest") {
        return getDateTime(right.created_at) - getDateTime(left.created_at);
      }

      if (selectedSort === "tasks_desc") {
        return Number(right.task_count) - Number(left.task_count);
      }

      return getDateTime(left.ddl) - getDateTime(right.ddl);
    });
  const projectGroups = {
    active: filteredProjects.filter((project) => normalizeProjectStatus(project.status) === "active"),
    done: filteredProjects.filter((project) => normalizeProjectStatus(project.status) === "done"),
    all: filteredProjects
  } satisfies Record<ProjectStatusFilter, ProjectRow[]>;
  const canModify = user.role === "admin";

  return (
    <AppFrame shellClassName="project-shell">
      <header className="masthead">
        <h1>Projects</h1>
      </header>
      <section className="panel">
        <div className="section-toolbar">
          <div className="toolbar-actions">
            {canModify ? <CreateProjectModal users={users} currentUserId={user.id} /> : null}
            <a className="button secondary" href="/main-page">
              Back
            </a>
          </div>
        </div>
        <form className="filter-bar project-filter-bar" action="/projects">
          <input name="status" type="hidden" value={selectedStatus} />
          {queryText ? <input name="q" type="hidden" value={queryText} /> : null}
          <div className="filter-field">
            <label htmlFor="project-owner">Owner</label>
            <select id="project-owner" name="owner" defaultValue={selectedOwnerId}>
              <option value="">All owners</option>
              {users.map((owner) => (
                <option value={owner.id} key={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="project-sort">Sort</label>
            <select id="project-sort" name="sort" defaultValue={selectedSort}>
              {(Object.keys(PROJECT_SORT_LABELS) as ProjectSort[]).map((sort) => (
                <option value={sort} key={sort}>
                  {PROJECT_SORT_LABELS[sort]}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-actions">
            <button className="button" type="submit">
              Apply
            </button>
            <a className="button secondary" href={`/projects?status=${selectedStatus}`}>
              Reset
            </a>
          </div>
        </form>
        <ProjectTable
          title={`${PROJECT_STATUS_LABELS[selectedStatus]} Projects`}
          status={selectedStatus}
          projects={projectGroups[selectedStatus]}
          users={users}
          currentUserId={user.id}
          canModify={canModify}
          searchForm={
            <form className="table-title-search" action="/projects">
              <input name="status" type="hidden" value={selectedStatus} />
              {selectedOwnerId ? <input name="owner" type="hidden" value={selectedOwnerId} /> : null}
              {selectedSort !== "ddl_asc" ? <input name="sort" type="hidden" value={selectedSort} /> : null}
              <label className="sr-only" htmlFor="project-search">Search projects</label>
              <input id="project-search" name="q" type="search" defaultValue={queryText} placeholder="Search projects" />
              <button className="button secondary" type="submit">
                Search
              </button>
            </form>
          }
          viewSwitch={
            <nav className="table-view-switch" aria-label="Project table view">
              <button className="button secondary table-view-trigger" type="button" aria-haspopup="true">
                Table View: {PROJECT_STATUS_LABELS[selectedStatus]} ({projectGroups[selectedStatus].length})
              </button>
              <div className="table-view-menu" role="menu">
                {(["active", "done", "all"] as ProjectStatusFilter[]).map((status) => (
                  <a
                    className={selectedStatus === status ? "is-active" : ""}
                    href={getProjectHref({ status, ownerId: selectedOwnerId, queryText, sort: selectedSort })}
                    key={status}
                    role="menuitem"
                  >
                    {PROJECT_STATUS_LABELS[status]} ({projectGroups[status].length})
                  </a>
                ))}
              </div>
            </nav>
          }
        />
      </section>
    </AppFrame>
  );
}
