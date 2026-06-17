"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  type AuthActionState,
  updateTaskAction,
  updateTaskStatusAction,
  updateSubtaskAction,
  updateSubtaskStatusAction
} from "@/lib/actions";
import { formatUiLabel, PickerOptionButton } from "./UiControls";

type Props = {
  kind: "priority" | "status";
  type: "task" | "subtask";
  current: string;
  projectId: string;
  taskId: string;
  subtaskId?: string;
  title?: string;
  description?: string;
  assignedToId?: string;
  startDate?: string;
  dueDate?: string;
  status?: string;
};

const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
const STATUS_OPTIONS = ["todo", "in_progress", "overdue", "done"] as const;
const initialState: AuthActionState = {};

export default function InlinePicker(props: Props) {
  const { kind, type, current, projectId, taskId, subtaskId, title = "", description = "", assignedToId = "", startDate = "", dueDate = "", status = "todo" } = props;
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ right: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open || !rootRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const dropdownHeight = (kind === "priority" ? PRIORITY_OPTIONS.length : STATUS_OPTIONS.length) * 36 + 12;
      const hasRoomBelow = rect.bottom + 6 + dropdownHeight <= window.innerHeight - 8;

      setDropdownPosition({
        right: Math.max(8, window.innerWidth - rect.right),
        top: hasRoomBelow ? rect.bottom + 6 : Math.max(8, rect.top - dropdownHeight - 6)
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

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
        {formatUiLabel(current)}
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={dropdownRef}
          className="picker-dropdown"
          role="menu"
          style={dropdownPosition ? { position: "fixed", right: dropdownPosition.right, top: dropdownPosition.top } : undefined}
        >
          {options.map((opt) => (
            <form key={opt} action={formAction} className="inline-picker-form">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="taskId" type="hidden" value={taskId} />
              {subtaskId ? <input name="subtaskId" type="hidden" value={subtaskId} /> : null}
              {kind === "priority" && type === "task" ? (
                <>
                  <input name="title" type="hidden" value={title} />
                  <input name="description" type="hidden" value={description} />
                  <input name="assignedToId" type="hidden" value={assignedToId} />
                  <input name="startDate" type="hidden" value={startDate} />
                  <input name="dueDate" type="hidden" value={dueDate} />
                  <input name="status" type="hidden" value={status} />
                </>
              ) : null}
              {kind === "priority" && type === "subtask" ? (
                <>
                  <input name="title" type="hidden" value={title} />
                  <input name="description" type="hidden" value={description} />
                  <input name="assignedToId" type="hidden" value={assignedToId} />
                  <input name="startDate" type="hidden" value={startDate} />
                  <input name="dueDate" type="hidden" value={dueDate} />
                  <input name="status" type="hidden" value={status} />
                </>
              ) : null}
              <input name={kind === "priority" ? "priority" : "status"} type="hidden" value={opt} />
              <PickerOptionButton active={opt === current} kind={kind} value={opt} />
            </form>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}
