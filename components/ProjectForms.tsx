"use client";

import { Button, Dropdown, Input, Popover, Space, Table } from "antd";
import type { MenuProps } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import type { SorterResult } from "antd/es/table/interface";
import { useActionState, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type AuthActionState,
  createProjectAction,
  createSubtaskCommentAction,
  createSubtaskAction,
  createTaskCommentAction,
  createTaskAction,
  archiveProjectAction,
  archiveSubtaskAction,
  archiveTaskAction,
  deleteProjectAction,
  deleteSubtaskAction,
  deleteTaskAction,
  updateProjectAction,
  updateSubtaskStatusAction,
  updateSubtaskAction,
  updateTaskStatusAction,
  updateTaskAction
} from "@/lib/actions";
import { SubmitButton } from "./FormStatus";
import InlinePicker from "./InlinePicker";
import { useResizableAntColumns } from "./ResizableAntColumns";
import { PriorityPill, TaskStatusPill, UiButton } from "./UiControls";

export type UserOption = {
  id: string;
  label: string;
  createdAt?: string;
};

export type ProjectFormData = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  ddl: string;
  ownerId: string;
  status: string;
  completedTaskCount?: number;
  remainingTaskCount?: number;
  totalTaskCount?: number;
};

export type TaskFormData = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignedToId: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
};

export type SubtaskFormData = {
  id: string;
  projectId: string;
  taskId: string;
  title: string;
  assignedToId: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
};

export type TaskListItemData = TaskFormData & {
  assignedTo: string;
  startLabel: string;
  dueLabel: string;
  projectName: string;
  comments?: TaskCommentData[];
  logs?: TaskLogData[];
};

export type SubtaskListItemData = SubtaskFormData & {
  assignedTo: string;
  startLabel: string;
  dueLabel: string;
  comments?: TaskCommentData[];
  logs?: TaskLogData[];
};

export type TaskDetailData = {
  id: string;
  projectId: string;
  taskId?: string;
  type: "task" | "subtask";
  title: string;
  description?: string;
  projectName?: string;
  assignedTo: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
  comments?: TaskCommentData[];
  logs?: TaskLogData[];
  mentionUsers?: UserOption[];
  subtaskCreateUsers?: UserOption[];
};

export type TaskCommentData = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  isMine?: boolean;
  mentionsMe?: boolean;
};

export type TaskLogData = {
  id: string;
  actor: string;
  action: string;
  body: string;
  createdAt: string;
};

const initialState: AuthActionState = {};

function Feedback({ state }: { state: AuthActionState }) {
  if (state.error) {
    return <div className="notice error">{state.error}</div>;
  }

  if (state.message) {
    return <div className="notice success">{state.message}</div>;
  }

  return null;
}

function Modal({
  title,
  trigger,
  triggerClassName = "button",
  triggerKind = "ui",
  children
}: {
  title: string;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerKind?: "ui" | "antd";
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      {triggerKind === "antd" ? (
        <Button size="small" type="primary" onClick={() => setIsOpen(true)}>
          {trigger}
        </Button>
      ) : triggerClassName === "button" ? (
        <UiButton type="button" onClick={() => setIsOpen(true)}>
          {trigger}
        </UiButton>
      ) : (
        <button className={triggerClassName} type="button" onClick={() => setIsOpen(true)}>
          {trigger}
        </button>
      )}
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="modal-header">
              <h2 id={titleId}>{title}</h2>
              <UiButton variant="secondary" type="button" onClick={() => setIsOpen(false)}>
                Close
              </UiButton>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function TaskDetailModal({ task }: { task: TaskDetailData }) {
  const [activeTab, setActiveTab] = useState<"message" | "log">("message");

  return (
    <Modal title={task.title} trigger={task.title} triggerClassName="task-title-trigger">
      <div className="task-detail-modal">
        {task.description ? (
          <section className="task-detail-description">
            <strong>Description</strong>
            <p>{task.description}</p>
          </section>
        ) : null}
        <div className="task-detail-meta-grid">
          {task.projectName ? (
            <div>
              <strong>Project</strong>
              <span>{task.projectName}</span>
            </div>
          ) : null}
          <div>
            <strong>Assigned To</strong>
            <span>{task.assignedTo}</span>
          </div>
          <div>
            <strong>Start</strong>
            <span>{task.startDate}</span>
          </div>
          <div>
            <strong>Due Date</strong>
            <span>{task.dueDate}</span>
          </div>
          <div>
            <strong>Priority</strong>
            <PriorityPill priority={task.priority} />
          </div>
          <div>
            <strong>Status</strong>
            <TaskStatusPill status={task.status} />
          </div>
        </div>
        {task.type === "task" && task.subtaskCreateUsers ? (
          <div className="task-detail-actions">
            <CreateSubtaskModal
              projectId={task.projectId}
              taskId={task.id}
              trigger="Create Sub-task"
              triggerClassName="button subtask-create-button"
              users={task.subtaskCreateUsers}
            />
          </div>
        ) : null}
        <div className="task-detail-tabs" role="tablist" aria-label="Task conversation and activity">
          <button
            aria-selected={activeTab === "message"}
            className={`task-detail-tab${activeTab === "message" ? " is-active" : ""}`}
            onClick={() => setActiveTab("message")}
            role="tab"
            type="button"
          >
            Message
          </button>
          <button
            aria-selected={activeTab === "log"}
            className={`task-detail-tab${activeTab === "log" ? " is-active" : ""}`}
            onClick={() => setActiveTab("log")}
            role="tab"
            type="button"
          >
            Log
          </button>
        </div>
        {activeTab === "message" ? <TaskComments task={task} /> : <TaskLog logs={task.logs ?? []} />}
      </div>
    </Modal>
  );
}

function TaskComments({ task }: { task: TaskDetailData }) {
  const comments = task.comments ?? [];

  return (
    <div className="task-message-shell">
      <div className="task-message-list" aria-label={`${task.title} messages`}>
        {comments.length ? (
          comments.map((comment) => (
            <article
              className={`task-message${comment.isMine ? " is-mine" : ""}${comment.mentionsMe ? " mentions-me" : ""}`}
              key={comment.id}
            >
              <div className="task-message-meta">
                <strong>{comment.author}</strong>
                <span>{comment.createdAt}</span>
              </div>
              <p>{comment.body}</p>
            </article>
          ))
        ) : (
          <div className="task-message-empty">No messages yet.</div>
        )}
      </div>
      <TaskCommentForm task={task} />
    </div>
  );
}

function TaskLog({ logs }: { logs: TaskLogData[] }) {
  return (
    <div className="task-log-list" aria-label="Task activity log">
      {logs.length ? (
        logs.map((log) => (
          <article className="task-log-item" key={log.id}>
            <span className="task-log-dot" aria-hidden="true" />
            <div>
              <div className="task-log-meta">
                <strong>{log.actor}</strong>
                <span>{log.createdAt}</span>
              </div>
              <p>{log.body}</p>
            </div>
          </article>
        ))
      ) : (
        <div className="task-message-empty">No activity yet.</div>
      )}
    </div>
  );
}

function TaskCommentForm({ task }: { task: TaskDetailData }) {
  const [state, action] = useActionState(
    task.type === "task" ? createTaskCommentAction : createSubtaskCommentAction,
    initialState
  );
  const [resetSignal, setResetSignal] = useState(0);
  const submittedRef = useRef(false);
  const commentId = `${task.type}-${task.id}-comment`;

  useEffect(() => {
    if (!submittedRef.current) {
      return;
    }

    if (state.error) {
      submittedRef.current = false;
      return;
    }

    setResetSignal((current) => current + 1);
    submittedRef.current = false;
  }, [state]);

  return (
    <form
      action={action}
      className="task-message-form"
      onSubmit={() => {
        submittedRef.current = true;
      }}
    >
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={task.projectId} />
      <input name="taskId" type="hidden" value={task.type === "task" ? task.id : task.taskId ?? ""} />
      {task.type === "subtask" ? <input name="subtaskId" type="hidden" value={task.id} /> : null}
      <label className="sr-only" htmlFor={commentId}>
        Message
      </label>
      <MentionTextarea id={commentId} resetSignal={resetSignal} users={task.mentionUsers ?? []} />
      <div className="button-row">
        <SubmitButton>Send</SubmitButton>
      </div>
    </form>
  );
}

function getMentionToken(label: string) {
  return label.includes(" (") ? label.split(" (")[0] : label;
}

function getActiveMention(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

  if (!match || match.index === undefined) {
    return null;
  }

  const atIndex = match.index + match[0].lastIndexOf("@");

  return {
    query: match[1].toLowerCase(),
    start: atIndex,
    end: cursor
  };
}

function MentionTextarea({ id, resetSignal, users }: { id: string; resetSignal: number; users: UserOption[] }) {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeMention = getActiveMention(value, cursor);
  const suggestions = useMemo(() => {
    if (!activeMention || !users.length) {
      return [];
    }

    const query = activeMention.query;

    return users
      .filter((user) => user.label.toLowerCase().includes(query))
      .sort((left, right) => {
        if (!query) {
          return left.label.localeCompare(right.label);
        }

        const leftLabel = left.label.toLowerCase();
        const rightLabel = right.label.toLowerCase();
        const leftToken = getMentionToken(left.label).toLowerCase();
        const rightToken = getMentionToken(right.label).toLowerCase();
        const leftPrefix = leftToken.startsWith(query) || leftLabel.startsWith(query) ? 0 : 1;
        const rightPrefix = rightToken.startsWith(query) || rightLabel.startsWith(query) ? 0 : 1;

        return leftPrefix - rightPrefix || leftLabel.localeCompare(rightLabel);
      });
  }, [activeMention, users]);
  const showSuggestions = Boolean(activeMention && suggestions.length);

  useEffect(() => {
    setValue("");
    setCursor(0);
    setSelectedIndex(0);
  }, [resetSignal]);

  function updateCursor(element: HTMLTextAreaElement) {
    setCursor(element.selectionStart);
    setSelectedIndex(0);
  }

  function insertMention(user: UserOption) {
    if (!activeMention) {
      return;
    }

    const mention = `@${getMentionToken(user.label)} `;
    const nextValue = `${value.slice(0, activeMention.start)}${mention}${value.slice(activeMention.end)}`;
    const nextCursor = activeMention.start + mention.length;

    setValue(nextValue);
    setCursor(nextCursor);
    setSelectedIndex(0);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="mention-composer">
      <textarea
        id={id}
        name="body"
        placeholder="send your message"
        ref={textareaRef}
        rows={4}
        value={value}
        onBlur={(event) => updateCursor(event.currentTarget)}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          updateCursor(event.currentTarget);
        }}
        onClick={(event) => updateCursor(event.currentTarget)}
        onKeyDown={(event) => {
          if (!showSuggestions) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((index) => (index + 1) % suggestions.length);
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
          }

          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            insertMention(suggestions[selectedIndex]);
          }

          if (event.key === "Escape") {
            setCursor(-1);
          }
        }}
        onKeyUp={(event) => updateCursor(event.currentTarget)}
      />
      {showSuggestions ? (
        <div className="mention-menu" role="listbox">
          {suggestions.map((user, index) => (
            <button
              className={index === selectedIndex ? "is-active" : ""}
              key={user.id}
              onMouseDown={(event) => {
                event.preventDefault();
                insertMention(user);
              }}
              role="option"
              type="button"
            >
              <span>@{getMentionToken(user.label)}</span>
              <small>{user.label}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectForm({
  users,
  currentUserId,
  project,
  readOnly = false
}: {
  users: UserOption[];
  currentUserId: string;
  project?: ProjectFormData;
  readOnly?: boolean;
}) {
  const [state, action] = useActionState(project ? updateProjectAction : createProjectAction, initialState);
  const ownerId = project?.ownerId || currentUserId;

  return (
    <form action={readOnly ? undefined : action}>
      {readOnly ? null : <Feedback state={state} />}
      {project ? <input name="projectId" type="hidden" value={project.id} /> : null}
      <div className="form-row">
        <label htmlFor={`${project?.id ?? "new"}-project-name`}>Project Name</label>
        <input
          id={`${project?.id ?? "new"}-project-name`}
          name="name"
          type="text"
          defaultValue={project?.name}
          disabled={readOnly}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor={`${project?.id ?? "new"}-project-description`}>Description</label>
        <input
          id={`${project?.id ?? "new"}-project-description`}
          name="description"
          type="text"
          defaultValue={project?.description}
          disabled={readOnly}
        />
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${project?.id ?? "new"}-project-start`}>Start</label>
          <input
            id={`${project?.id ?? "new"}-project-start`}
            name="startDate"
            type="date"
            defaultValue={project?.startDate}
            disabled={readOnly}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor={`${project?.id ?? "new"}-project-ddl`}>Due Date</label>
          <input
            id={`${project?.id ?? "new"}-project-ddl`}
            name="ddl"
            type="date"
            defaultValue={project?.ddl}
            disabled={readOnly}
            required
          />
        </div>
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${project?.id ?? "new"}-project-owner`}>Creator</label>
          <select id={`${project?.id ?? "new"}-project-owner`} name="ownerId" defaultValue={ownerId} disabled={readOnly}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor={`${project?.id ?? "new"}-project-status`}>Status</label>
          <select
            id={`${project?.id ?? "new"}-project-status`}
            name="status"
            defaultValue={project?.status ?? "active"}
            disabled={readOnly}
          >
            <option value="active">Active</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      {project ? (
        <div className="form-grid two-columns project-task-counts">
          <div className="form-row">
            <label htmlFor={`${project.id}-project-remaining-tasks`}>Remaining Tasks</label>
            <input
              id={`${project.id}-project-remaining-tasks`}
              type="text"
              value={project.remainingTaskCount ?? 0}
              readOnly
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${project.id}-project-completed-tasks`}>Completed Tasks</label>
            <input
              id={`${project.id}-project-completed-tasks`}
              type="text"
              value={project.completedTaskCount ?? 0}
              readOnly
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${project.id}-project-total-tasks`}>Total Tasks</label>
            <input
              id={`${project.id}-project-total-tasks`}
              type="text"
              value={project.totalTaskCount ?? 0}
              readOnly
            />
          </div>
        </div>
      ) : null}
      {readOnly ? null : (
        <div className="button-row">
          <SubmitButton>{project ? "Update Project" : "Create Project"}</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function CreateProjectModal({ users, currentUserId }: { users: UserOption[]; currentUserId: string }) {
  return (
    <Modal title="Create Project" trigger="Create Project">
      <ProjectForm users={users} currentUserId={currentUserId} />
    </Modal>
  );
}

export function EditProjectModal({
  users,
  currentUserId,
  project,
  showActions = true,
  triggerKind = "ui"
}: {
  users: UserOption[];
  currentUserId: string;
  project: ProjectFormData;
  showActions?: boolean;
  triggerKind?: "ui" | "antd";
}) {
  return (
    <Modal title="Edit Project" trigger="Edit" triggerKind={triggerKind}>
      {showActions ? <ProjectActionMenu project={project} /> : null}
      <ProjectForm users={users} currentUserId={currentUserId} project={project} />
    </Modal>
  );
}

export function ViewProjectModal({
  users,
  currentUserId,
  project,
  triggerKind = "antd"
}: {
  users: UserOption[];
  currentUserId: string;
  project: ProjectFormData;
  triggerKind?: "ui" | "antd";
}) {
  return (
    <Modal title="View Project" trigger="View" triggerKind={triggerKind}>
      <ProjectForm users={users} currentUserId={currentUserId} project={project} readOnly />
    </Modal>
  );
}

type ProjectDangerAction = "archive" | "delete";

function ProjectActionMenu({ project }: { project: ProjectFormData }) {
  const [archiveState, archiveAction] = useActionState(archiveProjectAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteProjectAction, initialState);
  const [pendingAction, setPendingAction] = useState<ProjectDangerAction | null>(null);
  const [deleteProjectName, setDeleteProjectName] = useState("");

  const closeConfirm = () => {
    setPendingAction(null);
    setDeleteProjectName("");
  };
  const canDeleteProject = pendingAction !== "delete" || deleteProjectName === project.name;
  const actionLabel = pendingAction === "delete" ? "Delete" : "Archive";
  const actionDescription =
    pendingAction === "delete"
      ? "This permanently removes the project and its tasks."
      : "This hides the project from active views.";
  const menuItems: MenuProps["items"] = [
    {
      key: "archive",
      label: "Archive"
    },
    {
      danger: true,
      key: "delete",
      label: "Delete"
    }
  ];
  const confirmContent = pendingAction ? (
    <div className="project-action-popover">
      <strong>{`${actionLabel} this project?`}</strong>
      <p>{actionDescription}</p>
      {pendingAction === "archive" ? <Feedback state={archiveState} /> : <Feedback state={deleteState} />}
      <form action={pendingAction === "archive" ? archiveAction : deleteAction}>
        <input name="projectId" type="hidden" value={project.id} />
        {pendingAction === "delete" ? (
          <label className="project-action-confirm-name">
            <span>
              Type <strong>{project.name}</strong> to delete this project.
            </span>
            <Input
              autoComplete="off"
              onChange={(event) => setDeleteProjectName(event.target.value)}
              placeholder={project.name}
              value={deleteProjectName}
            />
          </label>
        ) : null}
        <Space>
          <Button htmlType="submit" type="primary" danger disabled={!canDeleteProject}>
            Confirm {actionLabel}
          </Button>
          <Button htmlType="button" onClick={closeConfirm}>
            Cancel
          </Button>
        </Space>
      </form>
    </div>
  ) : null;

  return (
    <div className="project-action-menu">
      <Popover content={confirmContent} open={Boolean(pendingAction)} placement="bottomRight" trigger="click">
        <Dropdown
          menu={{
            items: menuItems,
            onClick: ({ key }) => {
              setPendingAction(key as ProjectDangerAction);
              setDeleteProjectName("");
            }
          }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button aria-label="Project actions" className="project-action-trigger" type="default">
            ...
          </Button>
        </Dropdown>
      </Popover>
    </div>
  );
}

function TaskForm({
  projectId,
  users,
  task
}: {
  projectId: string;
  users: UserOption[];
  task?: TaskFormData;
}) {
  const [state, action] = useActionState(task ? updateTaskAction : createTaskAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      {task ? <input name="taskId" type="hidden" value={task.id} /> : null}
      <div className="form-row">
        <label htmlFor={`${task?.id ?? "new"}-task-title`}>Task</label>
        <input
          id={`${task?.id ?? "new"}-task-title`}
          name="title"
          type="text"
          defaultValue={task?.title}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor={`${task?.id ?? "new"}-task-description`}>Description</label>
        <textarea
          id={`${task?.id ?? "new"}-task-description`}
          name="description"
          defaultValue={task?.description}
          placeholder="Describe the expected outcome, important context, and next action for this task."
        />
      </div>
      <div className="form-row">
        <label htmlFor={`${task?.id ?? "new"}-task-assigned`}>Assigned To</label>
        <select
          id={`${task?.id ?? "new"}-task-assigned`}
          name="assignedToId"
          defaultValue={task?.assignedToId ?? users[0]?.id}
          required
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${task?.id ?? "new"}-task-start`}>Start</label>
          <input
            id={`${task?.id ?? "new"}-task-start`}
            name="startDate"
            type="date"
            defaultValue={task?.startDate}
          />
        </div>
        <div className="form-row">
          <label htmlFor={`${task?.id ?? "new"}-task-due`}>Due Date</label>
          <input
            id={`${task?.id ?? "new"}-task-due`}
            name="dueDate"
            type="date"
            defaultValue={task?.dueDate}
          />
        </div>
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${task?.id ?? "new"}-task-priority`}>Priority</label>
          <select id={`${task?.id ?? "new"}-task-priority`} name="priority" defaultValue={task?.priority ?? "medium"}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="form-row">
          <label htmlFor={`${task?.id ?? "new"}-task-status`}>Status</label>
          <select id={`${task?.id ?? "new"}-task-status`} name="status" defaultValue={task?.status ?? "todo"}>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="overdue">Overdue</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      <div className="button-row">
        <SubmitButton>{task ? "Update Task" : "Create Task"}</SubmitButton>
      </div>
    </form>
  );
}

export function CreateTaskModal({ projectId, users }: { projectId: string; users: UserOption[] }) {
  return (
    <Modal title="Create Task" trigger="Create Task">
      <TaskForm projectId={projectId} users={users} />
    </Modal>
  );
}

export function EditTaskModal({ projectId, users, task }: { projectId: string; users: UserOption[]; task: TaskFormData }) {
  return (
    <Modal title="Edit Task" trigger="Edit">
      <WorkItemActionMenu item={task} projectId={projectId} type="task" />
      <TaskForm projectId={projectId} users={users} task={task} />
    </Modal>
  );
}

type WorkItemDangerAction = "archive" | "delete";

function WorkItemActionMenu({
  item,
  projectId,
  taskId,
  type
}: {
  item: { id: string; title: string };
  projectId: string;
  taskId?: string;
  type: "task" | "subtask";
}) {
  const [archiveTaskState, archiveTask] = useActionState(archiveTaskAction, initialState);
  const [deleteTaskState, deleteTask] = useActionState(deleteTaskAction, initialState);
  const [archiveSubtaskState, archiveSubtask] = useActionState(archiveSubtaskAction, initialState);
  const [deleteSubtaskState, deleteSubtask] = useActionState(deleteSubtaskAction, initialState);
  const [pendingAction, setPendingAction] = useState<WorkItemDangerAction | null>(null);
  const [deleteItemName, setDeleteItemName] = useState("");
  const isSubtask = type === "subtask";
  const itemLabel = isSubtask ? "sub-task" : "task";

  const closeConfirm = () => {
    setPendingAction(null);
    setDeleteItemName("");
  };
  const canDeleteItem = pendingAction !== "delete" || deleteItemName === item.title;
  const actionLabel = pendingAction === "delete" ? "Delete" : "Archive";
  const actionDescription =
    pendingAction === "delete"
      ? `This permanently removes the ${itemLabel}.`
      : `This hides the ${itemLabel} from active views.`;
  const archiveState = isSubtask ? archiveSubtaskState : archiveTaskState;
  const deleteState = isSubtask ? deleteSubtaskState : deleteTaskState;
  const action = pendingAction === "archive"
    ? isSubtask
      ? archiveSubtask
      : archiveTask
    : isSubtask
      ? deleteSubtask
      : deleteTask;
  const menuItems: MenuProps["items"] = [
    {
      key: "archive",
      label: "Archive"
    },
    {
      danger: true,
      key: "delete",
      label: "Delete"
    }
  ];
  const confirmContent = pendingAction ? (
    <div className="project-action-popover">
      <strong>{`${actionLabel} this ${itemLabel}?`}</strong>
      <p>{actionDescription}</p>
      {pendingAction === "archive" ? <Feedback state={archiveState} /> : <Feedback state={deleteState} />}
      <form action={action}>
        <input name="projectId" type="hidden" value={projectId} />
        <input name="taskId" type="hidden" value={isSubtask ? taskId : item.id} />
        {isSubtask ? <input name="subtaskId" type="hidden" value={item.id} /> : null}
        {pendingAction === "delete" ? (
          <label className="project-action-confirm-name">
            <span>
              Type <strong>{item.title}</strong> to delete this {itemLabel}.
            </span>
            <Input
              autoComplete="off"
              onChange={(event) => setDeleteItemName(event.target.value)}
              placeholder={item.title}
              value={deleteItemName}
            />
          </label>
        ) : null}
        <Space>
          <Button htmlType="submit" type="primary" danger disabled={!canDeleteItem}>
            Confirm {actionLabel}
          </Button>
          <Button htmlType="button" onClick={closeConfirm}>
            Cancel
          </Button>
        </Space>
      </form>
    </div>
  ) : null;

  return (
    <div className="project-action-menu">
      <Popover content={confirmContent} open={Boolean(pendingAction)} placement="bottomRight" trigger="click">
        <Dropdown
          menu={{
            items: menuItems,
            onClick: ({ key }) => {
              setPendingAction(key as WorkItemDangerAction);
              setDeleteItemName("");
            }
          }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button aria-label={`${itemLabel} actions`} className="project-action-trigger" type="default">
            ...
          </Button>
        </Dropdown>
      </Popover>
    </div>
  );
}

function SubtaskForm({
  projectId,
  taskId,
  users,
  subtask
}: {
  projectId: string;
  taskId: string;
  users: UserOption[];
  subtask?: SubtaskFormData;
}) {
  const [state, action] = useActionState(subtask ? updateSubtaskAction : createSubtaskAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="taskId" type="hidden" value={taskId} />
      {subtask ? <input name="subtaskId" type="hidden" value={subtask.id} /> : null}
      <div className="form-row">
        <label htmlFor={`${subtask?.id ?? taskId}-subtask-title`}>Sub-task</label>
        <input
          id={`${subtask?.id ?? taskId}-subtask-title`}
          name="title"
          type="text"
          defaultValue={subtask?.title}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor={`${subtask?.id ?? taskId}-subtask-assigned`}>Assigned To</label>
        <select
          id={`${subtask?.id ?? taskId}-subtask-assigned`}
          name="assignedToId"
          defaultValue={subtask?.assignedToId ?? users[0]?.id}
          required
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${subtask?.id ?? taskId}-subtask-start`}>Start</label>
          <input
            id={`${subtask?.id ?? taskId}-subtask-start`}
            name="startDate"
            type="date"
            defaultValue={subtask?.startDate}
          />
        </div>
        <div className="form-row">
          <label htmlFor={`${subtask?.id ?? taskId}-subtask-due`}>Due Date</label>
          <input
            id={`${subtask?.id ?? taskId}-subtask-due`}
            name="dueDate"
            type="date"
            defaultValue={subtask?.dueDate}
          />
        </div>
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${subtask?.id ?? taskId}-subtask-priority`}>Priority</label>
          <select
            id={`${subtask?.id ?? taskId}-subtask-priority`}
            name="priority"
            defaultValue={subtask?.priority ?? "medium"}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="form-row">
          <label htmlFor={`${subtask?.id ?? taskId}-subtask-status`}>Status</label>
          <select id={`${subtask?.id ?? taskId}-subtask-status`} name="status" defaultValue={subtask?.status ?? "todo"}>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="overdue">Overdue</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      <div className="button-row">
        <SubmitButton>{subtask ? "Update Sub-task" : "Create Sub-task"}</SubmitButton>
      </div>
    </form>
  );
}

export function CreateSubtaskModal({
  projectId,
  taskId,
  users,
  trigger = "Create Sub-task",
  triggerClassName = "button"
}: {
  projectId: string;
  taskId: string;
  users: UserOption[];
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <Modal title="Create Sub-task" trigger={trigger} triggerClassName={triggerClassName}>
      <SubtaskForm projectId={projectId} taskId={taskId} users={users} />
    </Modal>
  );
}

export function EditSubtaskModal({
  projectId,
  taskId,
  users,
  subtask
}: {
  projectId: string;
  taskId: string;
  users: UserOption[];
  subtask: SubtaskFormData;
}) {
  return (
    <Modal title="Edit Sub-task" trigger="Edit">
      <WorkItemActionMenu item={subtask} projectId={projectId} taskId={taskId} type="subtask" />
      <SubtaskForm projectId={projectId} taskId={taskId} users={users} subtask={subtask} />
    </Modal>
  );
}

export function ArchiveSubtaskForm({ projectId, taskId, subtaskId }: { projectId: string; taskId: string; subtaskId: string }) {
  const [state, action] = useActionState(archiveSubtaskAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="taskId" type="hidden" value={taskId} />
      <input name="subtaskId" type="hidden" value={subtaskId} />
      <UiButton variant="danger" type="submit">
        Archive
      </UiButton>
    </form>
  );
}

export function ArchiveTaskForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [state, action] = useActionState(archiveTaskAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="taskId" type="hidden" value={taskId} />
      <UiButton variant="danger" type="submit">
        Archive
      </UiButton>
    </form>
  );
}

function WorkItemStatusForm({
  currentStatus,
  projectId,
  subtaskId,
  taskId,
  type
}: {
  currentStatus: string;
  projectId: string;
  subtaskId?: string;
  taskId: string;
  type: "task" | "subtask";
}) {
  const [state, action] = useActionState(
    type === "task" ? updateTaskStatusAction : updateSubtaskStatusAction,
    initialState
  );
  const statusId = `${type}-${subtaskId ?? taskId}-status-update`;

  return (
    <form action={action} className="status-update-form">
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="taskId" type="hidden" value={taskId} />
      {type === "subtask" ? <input name="subtaskId" type="hidden" value={subtaskId} /> : null}
      <label className="sr-only" htmlFor={statusId}>
        Status
      </label>
      <select id={statusId} name="status" defaultValue={currentStatus}>
        <option value="todo">Todo</option>
        <option value="in_progress">In Progress</option>
        <option value="overdue">Overdue</option>
        <option value="done">Done</option>
      </select>
      <UiButton variant="secondary" type="submit">
        Update
      </UiButton>
    </form>
  );
}

type ProjectTaskAntRow = {
  key: string;
  subtasks: SubtaskListItemData[];
  task: TaskListItemData;
};

type ProjectTaskTableRow =
  | {
      key: string;
      kind: "task";
      subtasks: SubtaskListItemData[];
      task: TaskListItemData;
    }
  | {
      key: string;
      kind: "subtask";
      parentTask: TaskListItemData;
      subtask: SubtaskListItemData;
    };

function taskPriorityRank(priority: string) {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

function taskStatusRank(status: string) {
  return status === "overdue" ? 0 : status === "in_progress" ? 1 : status === "todo" ? 2 : 3;
}

function taskDateRank(value: string) {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

export function ProjectTasksAntTable({
  canManageTask,
  canUpdateStatus,
  rows,
  users
}: {
  canManageTask: boolean;
  canUpdateStatus: boolean;
  rows: ProjectTaskAntRow[];
  users: UserOption[];
}) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [sortedInfo, setSortedInfo] = useState<SorterResult<ProjectTaskTableRow>>({});
  const showActions = canManageTask || canUpdateStatus;

  const clearAll = () => {
    setSortedInfo({});
  };

  const handleChange: TableProps<ProjectTaskTableRow>["onChange"] = (_pagination, _filters, sorter) => {
    setSortedInfo(Array.isArray(sorter) ? sorter[0] ?? {} : sorter);
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  };

  const renderTaskDetail = (task: TaskListItemData) => {
    const taskDetail = {
      id: task.id,
      projectId: task.projectId,
      type: "task" as const,
      title: task.title,
      description: task.description,
      projectName: task.projectName,
      assignedTo: task.assignedTo,
      startDate: task.startLabel,
      dueDate: task.dueLabel,
      priority: task.priority,
      status: task.status,
      comments: task.comments,
      logs: task.logs,
      mentionUsers: users,
      subtaskCreateUsers: canManageTask ? users : undefined
    };

    return <TaskDetailModal task={taskDetail} />;
  };

  const renderSubtaskDetail = (subtask: SubtaskListItemData, projectName: string) => {
    const subtaskDetail = {
      id: subtask.id,
      projectId: subtask.projectId,
      taskId: subtask.taskId,
      type: "subtask" as const,
      title: subtask.title,
      projectName,
      assignedTo: subtask.assignedTo,
      startDate: subtask.startLabel,
      dueDate: subtask.dueLabel,
      priority: subtask.priority,
      status: subtask.status,
      comments: subtask.comments,
      logs: subtask.logs,
      mentionUsers: users
    };

    return <TaskDetailModal task={subtaskDetail} />;
  };

  const getRowStartDate = (row: ProjectTaskTableRow) => (row.kind === "task" ? row.task.startDate : row.subtask.startDate);
  const getRowDueDate = (row: ProjectTaskTableRow) => (row.kind === "task" ? row.task.dueDate : row.subtask.dueDate);
  const getRowPriority = (row: ProjectTaskTableRow) => (row.kind === "task" ? row.task.priority : row.subtask.priority);
  const getRowStatus = (row: ProjectTaskTableRow) => (row.kind === "task" ? row.task.status : row.subtask.status);

  const getSortRank = (row: ProjectTaskTableRow) => {
    if (sortedInfo.columnKey === "startDate") {
      return taskDateRank(getRowStartDate(row));
    }

    if (sortedInfo.columnKey === "dueDate") {
      return taskDateRank(getRowDueDate(row));
    }

    if (sortedInfo.columnKey === "priority") {
      return taskPriorityRank(getRowPriority(row));
    }

    if (sortedInfo.columnKey === "status") {
      return taskStatusRank(getRowStatus(row));
    }

    return 0;
  };

  const sortRows = <T extends ProjectTaskTableRow>(items: T[]) => {
    if (!sortedInfo.order) {
      return items;
    }

    const sortedRows = [...items].sort((left, right) => getSortRank(left) - getSortRank(right));

    return sortedInfo.order === "descend" ? sortedRows.reverse() : sortedRows;
  };

  const tableRows = sortRows(
    rows.map((row) => ({
      ...row,
      kind: "task" as const
    }))
  ).flatMap((row) => {
    if (!expandedTaskIds.has(row.task.id)) {
      return [row];
    }

    const childRows = sortRows(
      row.subtasks.map((subtask) => ({
        key: `${row.task.id}-${subtask.id}`,
        kind: "subtask" as const,
        parentTask: row.task,
        subtask
      }))
    );

    return [row, ...childRows];
  });

  const baseColumns: TableColumnsType<ProjectTaskTableRow> = [
    {
      title: "",
      key: "expand",
      render: (_value, row) =>
        row.kind === "task" ? (
          <Button
            aria-label={expandedTaskIds.has(row.task.id) ? "Collapse sub-tasks" : "Expand sub-tasks"}
            className="task-expand-button"
            disabled={!row.subtasks.length}
            onClick={() => toggleTaskExpanded(row.task.id)}
            size="small"
            type="text"
          >
            {row.subtasks.length ? (expandedTaskIds.has(row.task.id) ? "-" : "+") : ""}
          </Button>
        ) : null,
      width: 48
    },
    {
      title: "Task",
      key: "title",
      width: 260,
      render: (_value, row) =>
        row.kind === "task" ? renderTaskDetail(row.task) : renderSubtaskDetail(row.subtask, row.parentTask.projectName)
    },
    {
      title: "Assigned To",
      key: "assignedTo",
      width: 180,
      render: (_value, row) => (row.kind === "task" ? row.task.assignedTo : row.subtask.assignedTo)
    },
    {
      title: "Start",
      key: "startDate",
      render: (_value, row) => (row.kind === "task" ? row.task.startLabel : row.subtask.startLabel),
      sorter: true,
      sortOrder: sortedInfo.columnKey === "startDate" ? sortedInfo.order : null,
      width: 120
    },
    {
      title: "Due Date",
      key: "dueDate",
      render: (_value, row) => (row.kind === "task" ? row.task.dueLabel : row.subtask.dueLabel),
      sorter: true,
      sortOrder: sortedInfo.columnKey === "dueDate" ? sortedInfo.order : null,
      width: 130
    },
    {
      title: "Priority",
      key: "priority",
      render: (_value, row) => (
        row.kind === "task" ? (
          <InlinePicker
            kind="priority"
            type="task"
            current={row.task.priority}
            projectId={row.task.projectId}
            taskId={row.task.id}
            title={row.task.title}
            assignedToId={row.task.assignedToId}
            startDate={row.task.startDate}
            dueDate={row.task.dueDate}
            status={row.task.status}
          />
        ) : (
          <InlinePicker
            kind="priority"
            type="subtask"
            current={row.subtask.priority}
            projectId={row.subtask.projectId}
            taskId={row.subtask.taskId}
            subtaskId={row.subtask.id}
            title={row.subtask.title}
            assignedToId={row.subtask.assignedToId}
            startDate={row.subtask.startDate}
            dueDate={row.subtask.dueDate}
            status={row.subtask.status}
          />
        )
      ),
      sorter: true,
      sortOrder: sortedInfo.columnKey === "priority" ? sortedInfo.order : null,
      width: 130
    },
    {
      title: "Status",
      key: "status",
      render: (_value, row) => (
        row.kind === "task" ? (
          <InlinePicker kind="status" type="task" current={row.task.status} projectId={row.task.projectId} taskId={row.task.id} />
        ) : (
          <InlinePicker
            kind="status"
            type="subtask"
            current={row.subtask.status}
            projectId={row.subtask.projectId}
            taskId={row.subtask.taskId}
            subtaskId={row.subtask.id}
          />
        )
      ),
      sorter: true,
      sortOrder: sortedInfo.columnKey === "status" ? sortedInfo.order : null,
      width: 150
    },
    ...(showActions
      ? [
          {
            title: "Actions",
            key: "actions",
            render: (_value: unknown, row: ProjectTaskTableRow) =>
              canManageTask ? (
                <span className="table-actions">
                  {row.kind === "task" ? (
                    <EditTaskModal projectId={row.task.projectId} users={users} task={row.task} />
                  ) : (
                    <EditSubtaskModal projectId={row.subtask.projectId} taskId={row.subtask.taskId} users={users} subtask={row.subtask} />
                  )}
                </span>
              ) : null,
            width: 110
          }
        ]
      : [])
  ];

  const { columns, scrollX } = useResizableAntColumns(baseColumns, "project-task-ant-table-widths", 92);

  return (
    <div className="ant-data-table-shell">
      <div className="ant-data-table-toolbar">
        <strong>Tasks ({rows.length})</strong>
        <Space wrap>
          <Button onClick={clearAll}>Reset sorter</Button>
        </Space>
      </div>
      <Table<ProjectTaskTableRow>
        bordered
        columns={columns}
        dataSource={tableRows}
        locale={{ emptyText: "No tasks yet." }}
        onChange={handleChange}
        pagination={false}
        rowClassName={(row) => `project-task-ant-row ${row.kind === "subtask" ? "project-subtask-ant-row" : ""}`}
        rowKey="key"
        scroll={{ x: scrollX }}
        size="middle"
        tableLayout="fixed"
      />
    </div>
  );
}
