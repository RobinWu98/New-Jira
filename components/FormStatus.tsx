"use client";

import { useFormStatus } from "react-dom";
import { UiButton } from "./UiControls";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <UiButton type="submit" disabled={pending}>
      {pending ? "Working..." : children}
    </UiButton>
  );
}
