"use client";

import { useEffect } from "react";

function clamp(width: number, min = 72, max = 560) {
  return Math.min(max, Math.max(min, Math.round(width)));
}

function parseGridTemplate(grid: string) {
  // grid: "100px 200px 150px"
  return grid
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (v.endsWith("px") ? Number(v.slice(0, -2)) : NaN));
}

function applyWidthsToElement(el: HTMLElement, widths: number[]) {
  el.style.setProperty("--task-table-grid", widths.map((w) => `${w}px`).join(" "));
  el.style.setProperty("--task-table-width", `${widths.reduce((s, w) => s + w, 0)}px`);
}

export default function MakeTablesResizable() {
  useEffect(() => {
    const tableSelectors = [".resizable-task-table", ".users-table", ".projects-table", ".table-like", ".tasks-table"];
    const tables: HTMLElement[] = [];
    tableSelectors.forEach((sel) => tables.push(...Array.from(document.querySelectorAll<HTMLElement>(sel))));

    tables.forEach((table, tableIndex) => {
      try {
        const head = table.querySelector<HTMLElement>(".users-table-row.users-table-head, .tasks-table-row.tasks-table-head, .tasks-table-head, .users-table-row.users-table-head, .users-table-row.users-table-head");
        const headerRow = table.querySelector<HTMLElement>(".users-table-row.users-table-head, .tasks-table-row.tasks-table-head, .tasks-table-head, .users-table-row.users-table-head");
        const headerCells = headerRow ? Array.from(headerRow.querySelectorAll<HTMLElement>("[role=columnheader], strong, .resizable-task-column-header")) : [];

        if (!headerCells.length) return;

        // determine default widths
        const storageKey = table.dataset.storageKey ?? `resizable-table-widths-${tableIndex}`;
        let widths: number[] = [];
        const cssGrid = getComputedStyle(table).getPropertyValue("--task-table-grid").trim();
        if (cssGrid) {
          const parsed = parseGridTemplate(cssGrid);
          if (parsed.length === headerCells.length) widths = parsed.map((w) => clamp(w));
        }

        if (!widths.length) {
          // fallback: equal widths based on bounding box
          const total = table.clientWidth || Array.from(table.children).reduce((s, c) => s + (c as HTMLElement).clientWidth, 0) || 800;
          const equal = Math.floor(total / headerCells.length);
          widths = new Array(headerCells.length).fill(clamp(equal));
        }

        // load saved
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length === widths.length) {
              widths = parsed.map((v: any, i: number) => (Number.isFinite(v) ? clamp(Number(v)) : widths[i]));
            }
          } catch {}
        }

        applyWidthsToElement(table, widths);

        // attach handles to header cells
        headerCells.forEach((cell, index) => {
          if (cell.querySelector('.task-column-resize-handle')) return;
          const handle = document.createElement('button');
          handle.className = 'task-column-resize-handle';
          handle.setAttribute('aria-label', `Resize column ${index + 1}`);
          handle.type = 'button';
          handle.style.position = 'absolute';
          handle.style.top = '0';
          handle.style.right = '-5px';
          handle.style.width = '10px';
          handle.style.height = '100%';
          handle.style.background = 'transparent';
          handle.style.border = '0';
          handle.style.padding = '0';
          handle.style.zIndex = '3';
          handle.style.cursor = 'col-resize';

          // ensure cell is positioned
          const cellStyle = getComputedStyle(cell);
          if (cellStyle.position === 'static') (cell as HTMLElement).style.position = 'relative';

          cell.appendChild(handle);

          let pointerId: number | null = null;
          let startX = 0;
          let startWidth = 0;
          let neighborIndex = index < widths.length - 1 ? index + 1 : index - 1;

          function onPointerDown(e: PointerEvent) {
            if (e.button !== 0) return;
            (e.target as Element).setPointerCapture((e as any).pointerId);
            pointerId = (e as any).pointerId;
            startX = (e as any).clientX;
            startWidth = widths[index];
            neighborIndex = index < widths.length - 1 ? index + 1 : index - 1;
          }

          function onPointerMove(e: PointerEvent) {
            if (pointerId === null) return;
            const delta = (e as any).clientX - startX;
            const target = clamp(startWidth + delta);
            const neighbor = clamp(widths[neighborIndex] - (target - startWidth));
            // enforce total width fixed
            widths[index] = target;
            widths[neighborIndex] = neighbor;
            applyWidthsToElement(table, widths);
          }

          function onPointerUp(e: PointerEvent) {
            if (pointerId === null) return;
            try {
              (e.target as Element).releasePointerCapture(pointerId);
            } catch {}
            pointerId = null;
            localStorage.setItem(storageKey, JSON.stringify(widths));
          }

          handle.addEventListener('pointerdown', onPointerDown as any);
          handle.addEventListener('pointermove', onPointerMove as any);
          handle.addEventListener('pointerup', onPointerUp as any);
          handle.addEventListener('pointercancel', onPointerUp as any);
        });
      } catch (err) {
        // fail silently per table
        console.error('MakeTablesResizable error', err);
      }
    });

    // cleanup not implemented: enhancement is idempotent and harmless on reload
  }, []);

  return null;
}
