"use client";

import { useFormStatus } from "react-dom";
import { UiButton } from "./UiControls";

export function SubmitButton({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <UiButton type="submit" disabled={pending || disabled}>
      {pending ? "Working..." : children}
    </UiButton>
  );
}
