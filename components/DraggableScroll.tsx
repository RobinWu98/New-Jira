"use client";

import { useRef, useState, type ReactNode } from "react";

export function DraggableScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  return (
    <div
      className={`draggable-scroll${isDragging ? " is-dragging" : ""}`}
      ref={ref}
      onPointerDown={(event) => {
        if (!ref.current || event.button !== 0) {
          return;
        }

        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, select, textarea, summary, [role='button']")) {
          return;
        }

        setIsDragging(true);
        dragState.current = {
          startX: event.clientX,
          scrollLeft: ref.current.scrollLeft
        };
        ref.current.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!isDragging || !ref.current) {
          return;
        }

        const delta = event.clientX - dragState.current.startX;
        ref.current.scrollLeft = dragState.current.scrollLeft - delta;
      }}
      onPointerUp={(event) => {
        setIsDragging(false);
        ref.current?.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => setIsDragging(false)}
    >
      {children}
    </div>
  );
}
