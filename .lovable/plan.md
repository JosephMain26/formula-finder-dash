# Lock widget drag/resize unless "Edit layout" is active

## Root cause
`WidgetGrid` already passes `isDraggable={editing}` and `isResizable={editing}`, but `react-grid-layout` does not always re-evaluate these flags reliably when toggled at runtime, so dragging can still occur in view mode. The `draggableHandle=".drag-handle"` is also set unconditionally, leaving stale handler bindings.

## Fix — single file: `src/components/databoard/WidgetGrid.tsx`
1. Force the responsive grid to re-mount when `editing` toggles by adding `key={editing ? "edit" : "view"}` to the `ResponsiveGridLayout` — guarantees clean drag/resize handler state.
2. Set `draggableHandle={editing ? ".drag-handle" : undefined}` so no handle is registered in view mode.
3. Set `resizeHandles={editing ? ["se", "e", "s"] : []}` to remove resize affordances entirely when not editing.

No other files change. `WidgetCard` already applies the `drag-handle`/`cursor-move` classes only when `editing`, so styling is already correct.

Minimal change, lowest credit cost.