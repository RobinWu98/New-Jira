"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import {
  type AuthActionState,
  updateTaskAction,
  updateTaskStatusAction,
  updateSubtaskAction,
  updateSubtaskStatusAction
} from "@/lib/actions";

type Props = {
  kind: "priority" | "status";
  type: "task" | "subtask";
  current: string;
  projectId: string;
  taskId: string;
  subtaskId?: string;
  title?: string;
  assignedToId?: string;
  startDate?: string;
  dueDate?: string;
  status?: string;
};

const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
const STATUS_OPTIONS = ["todo", "in_progress", "overdue", "done"] as const;
const initialState: AuthActionState = {};

export default function InlinePicker(props: Props) {
  const { kind, type, current, projectId, taskId, subtaskId, title = "", assignedToId = "", startDate = "", dueDate = "", status = "todo" } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = kind === "priority" ? Array.from(PRIORITY_OPTIONS) : Array.from(STATUS_OPTIONS);

  function getAction() {
    if (type === "task") {
      return kind === "priority" ? updateTaskAction : updateTaskStatusAction;
    }

    return kind === "priority" ? updateSubtaskAction : updateSubtaskStatusAction;
  }
  const [, formAction] = useActionState(getAction(), initialState);

  return (
    <div className="inline-picker" ref={rootRef}>
      <button
        type="button"
        className={`inline-picker-button ${kind === "priority" ? `priority-${current}` : `task-status-${current}`}`}
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        {current.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
      </button>
      {open ? (
        <div className="picker-dropdown" role="menu">
          {options.map((opt) => (
            <form key={opt} action={formAction} className="inline-picker-form">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="taskId" type="hidden" value={taskId} />
              {subtaskId ? <input name="subtaskId" type="hidden" value={subtaskId} /> : null}
              {kind === "priority" && type === "task" ? (
                <>
                  <input name="title" type="hidden" value={title} />
                  <input name="assignedToId" type="hidden" value={assignedToId} />
                  <input name="startDate" type="hidden" value={startDate} />
                  <input name="dueDate" type="hidden" value={dueDate} />
                  <input name="status" type="hidden" value={status} />
                </>
              ) : null}
              {kind === "priority" && type === "subtask" ? (
                <>
                  <input name="title" type="hidden" value={title} />
                  <input name="assignedToId" type="hidden" value={assignedToId} />
                  <input name="startDate" type="hidden" value={startDate} />
                  <input name="dueDate" type="hidden" value={dueDate} />
                  <input name="status" type="hidden" value={status} />
                </>
              ) : null}
              <input name={kind === "priority" ? "priority" : "status"} type="hidden" value={opt} />
              <button className={`picker-item ${opt === current ? "is-active" : ""} ${kind === "priority" ? `priority-${opt}` : `task-status-${opt}`}`} type="submit">
                {opt.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
