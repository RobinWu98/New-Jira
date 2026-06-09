"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  type AuthActionState,
  createProjectAction,
  createTaskAction,
  deleteProjectAction,
  deleteTaskAction,
  updateProjectAction,
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
  children
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="button" type="button" onClick={() => setIsOpen(true)}>
        {trigger}
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={`${title}-title`}>
            <div className="modal-header">
              <h2 id={`${title}-title`}>{title}</h2>
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
