import { AppFrame } from "@/components/AppFrame";
import { PageHeader } from "@/components/PageHeader";
import { type UserOption } from "@/components/ProjectForms";
import { TeamPersonTables, type TeamPersonTable } from "@/components/TeamPersonTables";
import { type WorkItemAntTableRow } from "@/components/WorkItemsAntTable";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { syncOverdueWorkItems } from "@/lib/overdue";

type TeamMemberRow = {
  created_at: Date | string;
  email: string;
  id: string;
  name: string | null;
};

type TeamWorkRow = {
  assigned_to_email: string;
  assigned_to_name: string | null;
  description: string | null;
  due_date: Date | string | null;
  id: string;
  project_id: string;
  project_name: string;
  start_date: Date | string | null;
  title: string;
  type: "task" | "subtask";
  user_id: string;
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatOptionalDate(value: Date | string | null) {
  return value ? formatDate(value) : "No due date";
}

function toOptionalDateInput(value: Date | string | null) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
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

function toTableRow(work: TeamWorkRow, mentionUsers: UserOption[]): WorkItemAntTableRow {
  return {
    id: `${work.type}-${work.id}`,
    title: work.title,
    projectName: work.project_name,
    openDays: calculateOpenDays(work.start_date),
    startLabel: work.start_date ? formatDate(work.start_date) : "No date",
    dueLabel: formatOptionalDate(work.due_date),
    dueSort: toOptionalDateInput(work.due_date),
    priority: "medium",
    status: "in_progress",
    detail: {
      id: work.id,
      projectId: work.project_id,
      type: work.type,
      title: work.title,
      description: work.description ?? "",
      projectName: work.project_name,
      assignedTo: work.assigned_to_name || work.assigned_to_email,
      startDate: work.start_date ? formatDate(work.start_date) : "No date",
      dueDate: formatOptionalDate(work.due_date),
      priority: "medium",
      status: "in_progress",
      comments: [],
      logs: [],
      mentionUsers
    }
  };
}

export default async function TeamPage() {
  await requireUser();
  await syncOverdueWorkItems();

  const [membersResult, workResult] = await Promise.all([
    query<TeamMemberRow>(
      `SELECT id, name, email::text AS email, created_at
       FROM users
       WHERE archived_at IS NULL
       ORDER BY name NULLS LAST, email`
    ),
    query<TeamWorkRow>(
      `SELECT
         tasks.assigned_to_id AS user_id,
         tasks.id,
         'task'::text AS type,
         tasks.title,
         tasks.description,
         tasks.start_date,
         tasks.due_date,
         projects.id AS project_id,
         projects.name AS project_name,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email
       FROM tasks
       JOIN projects ON projects.id = tasks.project_id
       JOIN users ON users.id = tasks.assigned_to_id
       WHERE tasks.archived_at IS NULL
         AND tasks.status <> 'done'
         AND projects.archived_at IS NULL
         AND projects.status = 'active'
       UNION ALL
       SELECT
         subtasks.assigned_to_id AS user_id,
         subtasks.id,
         'subtask'::text AS type,
         subtasks.title,
         subtasks.description,
         subtasks.start_date,
         subtasks.due_date,
         projects.id AS project_id,
         projects.name AS project_name,
         users.name AS assigned_to_name,
         users.email::text AS assigned_to_email
       FROM subtasks
       JOIN tasks ON tasks.id = subtasks.task_id
       JOIN projects ON projects.id = tasks.project_id
       JOIN users ON users.id = subtasks.assigned_to_id
       WHERE subtasks.archived_at IS NULL
         AND subtasks.status <> 'done'
         AND tasks.archived_at IS NULL
         AND projects.archived_at IS NULL
         AND projects.status = 'active'
       ORDER BY project_name, start_date ASC NULLS LAST, title`
    )
  ]);

  const mentionUsers = membersResult.rows.map((member) => ({
    id: member.id,
    label: member.name ? `${member.name} (${member.email})` : member.email,
    createdAt: member.created_at instanceof Date ? member.created_at.toISOString() : String(member.created_at)
  }));
  const workByUser = new Map<string, TeamWorkRow[]>();

  for (const work of workResult.rows) {
    const existingWork = workByUser.get(work.user_id) ?? [];
    existingWork.push(work);
    workByUser.set(work.user_id, existingWork);
  }

  const people: TeamPersonTable[] = membersResult.rows.map((member) => {
    const memberName = member.name || member.email;

    return {
      email: member.email,
      id: member.id,
      name: memberName,
      rows: (workByUser.get(member.id) ?? []).map((work) => toTableRow(work, mentionUsers))
    };
  });

  return (
    <AppFrame shellClassName="team-shell">
      <PageHeader title="Team" />
      <TeamPersonTables people={people} />
    </AppFrame>
  );
}
