"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import {
  type AuthActionState,
  createProjectAction,
  createSubtaskAction,
  createTaskAction,
  deleteProjectAction,
  deleteSubtaskAction,
  deleteTaskAction,
  updateProjectAction,
  updateSubtaskAction,
  updateTaskAction
} from "@/lib/actions";
import { SubmitButton } from "./FormStatus";

type UserOption = {
  id: string;
  label: string;
};

export type ProjectFormData = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  ddl: string;
  ownerId: string;
  status: string;
};

export type TaskFormData = {
  id: string;
  projectId: string;
  title: string;
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
};

export type SubtaskListItemData = SubtaskFormData & {
  assignedTo: string;
  startLabel: string;
  dueLabel: string;
};

export type TaskDetailData = {
  title: string;
  projectName?: string;
  assignedTo: string;
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
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
  children
}: {
  title: string;
  trigger: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button className={triggerClassName} type="button" onClick={() => setIsOpen(true)}>
        {trigger}
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="modal-header">
              <h2 id={titleId}>{title}</h2>
              <button className="button secondary" type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function TaskDetailModal({ task }: { task: TaskDetailData }) {
  return (
    <Modal title={task.title} trigger={task.title} triggerClassName="task-title-trigger">
      <div className="task-detail-modal">
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
            <span className={`task-pill priority-${task.priority}`}>{formatTaskLabel(task.priority)}</span>
          </div>
          <div>
            <strong>Status</strong>
            <span className={`task-pill task-status-${task.status}`}>{formatTaskLabel(task.status)}</span>
          </div>
        </div>
        <div className="task-message-shell">
          <textarea aria-label="Task messages" />
        </div>
      </div>
    </Modal>
  );
}

function formatTaskLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function ProjectForm({
  users,
  currentUserId,
  project
}: {
  users: UserOption[];
  currentUserId: string;
  project?: ProjectFormData;
}) {
  const [state, action] = useActionState(project ? updateProjectAction : createProjectAction, initialState);
  const ownerId = project?.ownerId || currentUserId;

  return (
    <form action={action}>
      <Feedback state={state} />
      {project ? <input name="projectId" type="hidden" value={project.id} /> : null}
      <div className="form-row">
        <label htmlFor={`${project?.id ?? "new"}-project-name`}>Project Name</label>
        <input
          id={`${project?.id ?? "new"}-project-name`}
          name="name"
          type="text"
          defaultValue={project?.name}
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
            required
          />
        </div>
      </div>
      <div className="form-grid two-columns">
        <div className="form-row">
          <label htmlFor={`${project?.id ?? "new"}-project-owner`}>Creator</label>
          <select id={`${project?.id ?? "new"}-project-owner`} name="ownerId" defaultValue={ownerId}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor={`${project?.id ?? "new"}-project-status`}>Status</label>
          <select id={`${project?.id ?? "new"}-project-status`} name="status" defaultValue={project?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      <div className="button-row">
        <SubmitButton>{project ? "Update Project" : "Create Project"}</SubmitButton>
      </div>
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
  project
}: {
  users: UserOption[];
  currentUserId: string;
  project: ProjectFormData;
}) {
  return (
    <Modal title="Edit Project" trigger="Edit">
      <ProjectForm users={users} currentUserId={currentUserId} project={project} />
    </Modal>
  );
}

export function DeleteProjectForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(deleteProjectAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <button className="button secondary" type="submit">
        Delete
      </button>
    </form>
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
      <TaskForm projectId={projectId} users={users} task={task} />
    </Modal>
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

export function CreateSubtaskModal({ projectId, taskId, users }: { projectId: string; taskId: string; users: UserOption[] }) {
  return (
    <Modal title="Create Sub-task" trigger="Create Sub-task">
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
      <SubtaskForm projectId={projectId} taskId={taskId} users={users} subtask={subtask} />
    </Modal>
  );
}

export function DeleteSubtaskForm({ projectId, taskId, subtaskId }: { projectId: string; taskId: string; subtaskId: string }) {
  const [state, action] = useActionState(deleteSubtaskAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="taskId" type="hidden" value={taskId} />
      <input name="subtaskId" type="hidden" value={subtaskId} />
      <button className="button secondary" type="submit">
        Delete
      </button>
    </form>
  );
}

export function DeleteTaskForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [state, action] = useActionState(deleteTaskAction, initialState);

  return (
    <form action={action}>
      <Feedback state={state} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="taskId" type="hidden" value={taskId} />
      <button className="button secondary" type="submit">
        Delete
      </button>
    </form>
  );
}

export function TaskWithSubtasks({
  task,
  subtasks,
  users,
  canModify
}: {
  task: TaskListItemData;
  subtasks: SubtaskListItemData[];
  users: UserOption[];
  canModify: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const taskDetail = {
    title: task.title,
    projectName: task.projectName,
    assignedTo: task.assignedTo,
    startDate: task.startLabel,
    dueDate: task.dueLabel,
    priority: task.priority,
    status: task.status
  };

  return (
    <>
      <div className={`tasks-table-row task-detail-row${canModify ? "" : " task-detail-row-readonly"}`} role="row">
        <span className="task-title-cell" role="cell">
          <button
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} sub-tasks for ${task.title}`}
            className="task-expand-trigger"
            type="button"
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? "v" : ">"}
          </button>
          <TaskDetailModal task={taskDetail} />
          <span className="subtask-count">{subtasks.length}</span>
        </span>
        <span role="cell">{task.assignedTo}</span>
        <span role="cell">{task.startLabel}</span>
        <span role="cell">{task.dueLabel}</span>
        <span role="cell">
          <span className={`task-pill priority-${task.priority}`}>{formatTaskLabel(task.priority)}</span>
        </span>
        <span role="cell">
          <span className={`task-pill task-status-${task.status}`}>{formatTaskLabel(task.status)}</span>
        </span>
        {canModify ? (
          <span role="cell" className="table-actions">
            <EditTaskModal projectId={task.projectId} users={users} task={task} />
            <DeleteTaskForm projectId={task.projectId} taskId={task.id} />
          </span>
        ) : null}
      </div>
      {isOpen ? (
        <div className="subtasks-panel" role="row">
          <div className="subtasks-panel-header">
            <strong>Sub-tasks</strong>
            <CreateSubtaskModal projectId={task.projectId} taskId={task.id} users={users} />
          </div>
          {subtasks.length ? (
            <div className="subtasks-list">
              {subtasks.map((subtask) => {
                const subtaskDetail = {
                  title: subtask.title,
                  projectName: task.projectName,
                  assignedTo: subtask.assignedTo,
                  startDate: subtask.startLabel,
                  dueDate: subtask.dueLabel,
                  priority: subtask.priority,
                  status: subtask.status
                };

                return (
                  <div className={`subtask-row${canModify ? "" : " subtask-row-readonly"}`} key={subtask.id}>
                    <span className="subtask-title-cell">
                      <TaskDetailModal task={subtaskDetail} />
                    </span>
                    <span>{subtask.assignedTo}</span>
                    <span>{subtask.startLabel}</span>
                    <span>{subtask.dueLabel}</span>
                    <span>
                      <span className={`task-pill priority-${subtask.priority}`}>{formatTaskLabel(subtask.priority)}</span>
                    </span>
                    <span>
                      <span className={`task-pill task-status-${subtask.status}`}>{formatTaskLabel(subtask.status)}</span>
                    </span>
                    {canModify ? (
                      <span className="table-actions">
                        <EditSubtaskModal projectId={task.projectId} taskId={task.id} users={users} subtask={subtask} />
                        <DeleteSubtaskForm projectId={task.projectId} taskId={task.id} subtaskId={subtask.id} />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="subtasks-empty">No sub-tasks yet.</div>
          )}
        </div>
      ) : null}
    </>
  );
}
