import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type UiButtonVariant = "primary" | "secondary" | "danger";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatUiLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getButtonClassName(variant: UiButtonVariant, className?: string) {
  return joinClasses("button", variant !== "primary" && variant, className);
}

export function UiButton({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
}) {
  return (
    <button className={getButtonClassName(variant, className)} {...props}>
      {children}
    </button>
  );
}

export function UiButtonLink({
  children,
  className,
  variant = "primary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: UiButtonVariant;
}) {
  return (
    <a className={getButtonClassName(variant, className)} {...props}>
      {children}
    </a>
  );
}

export function StatusPill({ children, status }: { children?: ReactNode; status: string }) {
  return <span className={`status-pill status-${status}`}>{children ?? formatUiLabel(status)}</span>;
}

export function TaskStatusPill({ children, status }: { children?: ReactNode; status: string }) {
  return <span className={`task-pill task-status-${status}`}>{children ?? formatUiLabel(status)}</span>;
}

export function PriorityPill({ children, priority }: { children?: ReactNode; priority: string }) {
  return <span className={`task-pill priority-${priority}`}>{children ?? formatUiLabel(priority)}</span>;
}

export function PickerOptionButton({
  active,
  children,
  kind,
  value
}: {
  active?: boolean;
  children?: ReactNode;
  kind: "priority" | "status";
  value: string;
}) {
  return (
    <button
      className={joinClasses("picker-item", active && "is-active", kind === "priority" ? `priority-${value}` : `task-status-${value}`)}
      type="submit"
    >
      {children ?? formatUiLabel(value)}
    </button>
  );
}
