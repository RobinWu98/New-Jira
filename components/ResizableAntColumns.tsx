"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { TableColumnsType } from "antd";

type ResizableColumn = TableColumnsType<any>[number] & {
  width?: number;
};

function clampWidth(width: number, minWidth: number) {
  return Math.max(minWidth, Math.round(width));
}

function getColumnKey(column: ResizableColumn, index: number) {
  return String(column.key ?? ("dataIndex" in column ? column.dataIndex : "") ?? index);
}

function getColumnWidth(column: ResizableColumn, index: number) {
  if (typeof column.width === "number") {
    return column.width;
  }

  return index === 0 ? 260 : 150;
}

export function useResizableAntColumns<T extends object>(
  columns: TableColumnsType<T>,
  storageKey: string,
  minWidth = 96
) {
  const columnSignature = columns
    .map((column, index) => `${getColumnKey(column as ResizableColumn, index)}:${getColumnWidth(column as ResizableColumn, index)}`)
    .join("|");
  const widthKeys = useMemo(
    () => columns.map((column, index) => getColumnKey(column as ResizableColumn, index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnSignature]
  );
  const defaultWidths = useMemo(
    () => columns.map((column, index) => getColumnWidth(column as ResizableColumn, index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnSignature]
  );
  const [widths, setWidths] = useState(defaultWidths);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);

    if (!saved) {
      setWidths(defaultWidths);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Record<string, number>;
      setWidths(widthKeys.map((key, index) => clampWidth(Number(parsed[key]) || defaultWidths[index], minWidth)));
    } catch {
      setWidths(defaultWidths);
    }
  }, [defaultWidths, minWidth, storageKey, widthKeys]);

  const updateWidth = useCallback(
    (index: number, nextWidth: number) => {
      setWidths((currentWidths) => {
        const nextWidths = [...currentWidths];
        const neighborIndex = index < nextWidths.length - 1 ? index + 1 : index - 1;

        if (neighborIndex < 0) {
          nextWidths[index] = clampWidth(nextWidth, minWidth);
        } else {
          const currentWidth = nextWidths[index];
          const requestedDelta = Math.round(nextWidth - currentWidth);
          const maxGrow = nextWidths[neighborIndex] - minWidth;
          const maxShrink = currentWidth - minWidth;
          const delta = Math.max(-maxShrink, Math.min(maxGrow, requestedDelta));

          nextWidths[index] = currentWidth + delta;
          nextWidths[neighborIndex] -= delta;
        }

        window.localStorage.setItem(
          storageKey,
          JSON.stringify(Object.fromEntries(widthKeys.map((key, widthIndex) => [key, nextWidths[widthIndex]])))
        );
        return nextWidths;
      });
    },
    [minWidth, storageKey, widthKeys]
  );

  const resizableColumns = useMemo(
    () =>
      columns.map((column, index) => {
        const title = column.title as ReactNode;
        const width = widths[index] ?? defaultWidths[index];

        return {
          ...column,
          width,
          title: (
            <span className="resizable-ant-title">
              <span className="resizable-ant-title-text">{title}</span>
              <span
                aria-label={`Resize ${typeof title === "string" ? title : "column"}`}
                className="resizable-ant-column-handle"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const startX = event.clientX;
                  const startWidth = width;
                  const target = event.currentTarget;

                  target.setPointerCapture(event.pointerId);

                  const handlePointerMove = (moveEvent: PointerEvent) => {
                    updateWidth(index, startWidth + moveEvent.clientX - startX);
                  };
                  const handlePointerUp = (upEvent: PointerEvent) => {
                    target.releasePointerCapture(upEvent.pointerId);
                    window.removeEventListener("pointermove", handlePointerMove);
                    window.removeEventListener("pointerup", handlePointerUp);
                    window.removeEventListener("pointercancel", handlePointerUp);
                  };

                  window.addEventListener("pointermove", handlePointerMove);
                  window.addEventListener("pointerup", handlePointerUp);
                  window.addEventListener("pointercancel", handlePointerUp);
                }}
                role="separator"
              />
            </span>
          )
        };
      }),
    [columns, defaultWidths, updateWidth, widths]
  );

  const scrollX = widths.reduce((sum, width) => sum + width, 0);

  return { columns: resizableColumns, scrollX };
}
