"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode
} from "react";
import { DraggableScroll } from "./DraggableScroll";

type ResizableTaskTableContextValue = {
  sizes: number[];
  resizeColumn: (index: number, width: number) => void;
};

const ResizableTaskTableContext = createContext<ResizableTaskTableContextValue | null>(null);

const MIN_COLUMN_WIDTH = 72;
const MAX_COLUMN_WIDTH = 560;

function clampWidth(width: number) {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

function getSavedWidths(storageKey: string, fallback: number[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      return fallback;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length !== fallback.length) {
      return fallback;
    }

    return parsed.map((value, index) => (Number.isFinite(value) ? clampWidth(Number(value)) : fallback[index]));
  } catch {
    return fallback;
  }
}

function normalizeWidths(saved: number[], fallback: number[]) {
  const total = fallback.reduce((sum, width) => sum + width, 0);
  const widths = saved.map((value, index) => (Number.isFinite(value) ? clampWidth(Number(value)) : fallback[index]));
  const currentTotal = widths.reduce((sum, width) => sum + width, 0);
  if (currentTotal === total) {
    return widths;
  }

  const delta = total - currentTotal;
  const lastIndex = widths.length - 1;
  widths[lastIndex] = clampWidth(widths[lastIndex] + delta);
  return widths;
}

export function ResizableTaskTable({
  ariaLabel,
  children,
  className = "",
  defaultWidths,
  storageKey
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  defaultWidths: number[];
  storageKey: string;
}) {
  const [sizes, setSizes] = useState(defaultWidths);
  const [hasLoadedSavedWidths, setHasLoadedSavedWidths] = useState(false);

  useEffect(() => {
    setSizes(normalizeWidths(getSavedWidths(storageKey, defaultWidths), defaultWidths));
    setHasLoadedSavedWidths(true);
  }, [defaultWidths, storageKey]);

  useEffect(() => {
    if (!hasLoadedSavedWidths) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(sizes));
  }, [hasLoadedSavedWidths, sizes, storageKey]);

  const value = useMemo(
    () => ({
      sizes,
      resizeColumn: (index: number, width: number) => {
        setSizes((current) => {
          const neighborIndex = index < current.length - 1 ? index + 1 : index - 1;
          if (neighborIndex < 0) {
            return current;
          }

          const startWidth = current[index];
          const neighborWidth = current[neighborIndex];
          const targetWidth = clampWidth(width);
          const delta = targetWidth - startWidth;
          const adjustedNeighborWidth = clampWidth(neighborWidth - delta);

          if (adjustedNeighborWidth !== neighborWidth - delta) {
            const actualDelta = neighborWidth - adjustedNeighborWidth;
            const adjustedTargetWidth = clampWidth(startWidth + actualDelta);
            return current.map((size, currentIndex) =>
              currentIndex === index ? adjustedTargetWidth : currentIndex === neighborIndex ? adjustedNeighborWidth : size
            );
          }

          return current.map((size, currentIndex) =>
            currentIndex === index ? targetWidth : currentIndex === neighborIndex ? adjustedNeighborWidth : size
          );
        });
      }
    }),
    [sizes]
  );
  const style = {
    "--task-table-grid": sizes.map((size) => `${size}px`).join(" "),
    "--task-table-width": `${sizes.reduce((sum, size) => sum + size, 0)}px`
  } as CSSProperties;

  return (
    <ResizableTaskTableContext.Provider value={value}>
      <DraggableScroll>
        <div
          aria-label={ariaLabel}
          className={`tasks-table resizable-task-table ${className}`.trim()}
          role="table"
          style={style}
        >
          {children}
        </div>
      </DraggableScroll>
    </ResizableTaskTableContext.Provider>
  );
}

export function ResizableTaskColumnHeader({ children, index }: { children: ReactNode; index: number }) {
  const context = useContext(ResizableTaskTableContext);
  const dragState = useRef({ startX: 0, startWidth: 0 });

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (!context || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragState.current = {
      startX: event.clientX,
      startWidth: context.sizes[index] ?? MIN_COLUMN_WIDTH
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resize(event: PointerEvent<HTMLButtonElement>) {
    if (!context || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const delta = event.clientX - dragState.current.startX;
    context.resizeColumn(index, dragState.current.startWidth + delta);
  }

  return (
    <strong className="resizable-task-column-header" role="columnheader">
      <span>{children}</span>
      <button
        aria-label={`Resize ${children} column`}
        className="task-column-resize-handle"
        onPointerDown={startResize}
        onPointerMove={resize}
        type="button"
      />
    </strong>
  );
}
