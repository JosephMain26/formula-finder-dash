Three precise fixes to DataBoard. No new dependencies, minimal surface area.

## 1. Map widget drags when board is locked — root cause + fix

**Cause:** In `WidgetGrid.tsx`, when `editing=false` we currently pass `draggableHandle={undefined}`. With `undefined`, react-grid-layout falls back to its default behavior of treating the **whole grid item as draggable** by checking `isDraggable={false}` only at the item level. For most widgets the chart fills the body and intercepts pointer events, so the bug isn't visible. **Leaflet's MapContainer aggressively swallows pointer events on the body**, but the header strip (no `.drag-handle` class outside edit) still has bare `div` space that lets RGL initiate a drag in some pointer paths — combined with the `undefined` handle, RGL falls back to body-level drag.

**Fix in `src/components/databoard/WidgetGrid.tsx`:**
- Always pass `draggableHandle=".drag-handle"` (not `undefined`). Since the `.drag-handle` class is only added to the header in edit mode, when not editing there is **no** matching element → no drag possible, regardless of `isDraggable`.
- Keep `isDraggable={editing}` and `isResizable={editing}` as belt-and-suspenders.
- Keep the `key={editing ? "edit" : "view"}` remount.

**Fix in `src/components/databoard/widgets/MapWidget.tsx`:**
- Add `dragging={true}` only when allowed; expose a small wrapper that disables map interactions when its parent is in non-edit mode is **not needed** once the handle fix above lands. But to be defensive against any future RGL behavior, wrap `<MapContainer>` in `<div className="h-full w-full" onMouseDownCapture={(e)=>e.stopPropagation()}>` so map pointer events never bubble to RGL. This guarantees the map itself can pan/zoom while the surrounding grid item can't be picked up.

## 2. More breakpoints & sizes for widgets

**File `src/components/databoard/WidgetGrid.tsx`:**
- Increase column counts for finer granularity:
  ```ts
  const COLS = { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 };
  const BREAKPOINTS = { lg: 1400, md: 1100, sm: 800, xs: 520, xxs: 0 };
  ```
- Halve `rowHeight` from `50` → `30` (more vertical granularity).
- Lower min sizes per widget so users can shrink them more aggressively. Updated `defaultSize` map (w / h / minW / minH on the new 24-col grid):
  - kpi: `{ w: 6, h: 4, minW: 3, minH: 3 }`
  - chart: `{ w: 12, h: 8, minW: 5, minH: 5 }`
  - table: `{ w: 8, h: 8, minW: 4, minH: 4 }`
  - goal: `{ w: 8, h: 5, minW: 4, minH: 3 }`
  - activity: `{ w: 8, h: 10, minW: 4, minH: 5 }`
  - calendar: `{ w: 12, h: 12, minW: 6, minH: 8 }`
  - map: `{ w: 12, h: 12, minW: 6, minH: 8 }`
  - insight: `{ w: 12, h: 8, minW: 4, minH: 4 }`
- Enable all 8 resize handles when editing: `resizeHandles: ["s","w","e","n","sw","nw","se","ne"]` so users can resize from any edge/corner.

**Migration of existing saved layouts:** Existing per-user layouts were stored against the old 12-col grid. To avoid broken positions on first load after the change, in `WidgetGrid.tsx`'s `computedLayouts` memo, detect when a stored layout's max `x+w` is `<= 12` and the new grid is 24-cols → multiply `x` and `w` by 2 (and `y`,`h` stay; rowHeight halving doubles them visually, but to keep the same on-screen height we also multiply `y` and `h` by ~1.66). Simpler & safer: when an item's stored size is below the new `minW/minH`, clamp up to the new minimums. No data migration to Supabase needed; the fix runs client-side at render time.

## 3. Per-widget viz selector for chart widgets (pie/bar/line/area/donut)

The Insight widget already supports this. The user wants **every chart widget** to have it. Approach: **route all "Chart" menu items through the configurable Insight engine** so users get the gear icon + viz/dimension/metric switcher for free. This is the smallest-credit fix and removes the duplication between `ChartWidget` and `InsightWidget`.

**File `src/components/databoard/AddWidgetMenu.tsx`:**
- Replace each `type: "chart"` menu entry with `type: "insight"` pre-seeded for the same intent. Examples:
  - "Revenue over time" → `{ type:"insight", title:"Revenue over time", settings:{ dimension:"day", metric:"revenue", viz:"area", limit:0, sort:"desc" } }`
  - "Top techs" → `{ dimension:"tech_name", metric:"revenue", viz:"bar", limit:8 }`
  - "Top marketers" → `{ dimension:"company", metric:"revenue", viz:"bar", limit:8 }`
  - "Status breakdown" → `{ dimension:"status", metric:"count", viz:"pie", limit:10 }`
  - "Payment split" → `{ dimension:"payment", metric:"revenue", viz:"donut", limit:10 }`
  - "Job types" → `{ dimension:"job_type", metric:"count", viz:"bar", limit:10 }`
- Same treatment for the two Table menu items (already configurable via Insight `viz:"table"`):
  - "Top techs (table)" → `{ dimension:"tech_name", metric:"revenue", viz:"table", limit:15 }`
  - "Top job types" → `{ dimension:"job_type", metric:"count", viz:"table", limit:15 }`
- Keep `kpi`, `goal`, `activity`, `calendar`, `map` as-is (they aren't viz-switchable by nature; KPI already has size variants and Goal has a target).

**File `src/components/databoard/WidgetGrid.tsx`:**
- Expand the `onConfigure` gating: show the gear icon for `insight` AND `kpi` AND `goal` widget types so any preset can be re-tuned later. Reuse `InsightSettingsDialog` for `insight`. (KPI/goal can keep their existing edit affordances; no new dialog needed in this iteration.)

**Backwards compatibility:** Existing user-saved widgets of `type:"chart"` and `type:"table"` continue to render via the existing `ChartWidget`/`TableWidget` code paths (we are NOT deleting them). Only newly-added widgets from the menu will be Insight-powered. No migration risk.

## Files touched (3)

1. `src/components/databoard/WidgetGrid.tsx` — handle fix, new COLS/BREAKPOINTS/rowHeight, new defaultSize, all 8 resize handles, expanded `onConfigure` gating, layout-clamp safety.
2. `src/components/databoard/widgets/MapWidget.tsx` — defensive `onMouseDownCapture` stopPropagation wrapper.
3. `src/components/databoard/AddWidgetMenu.tsx` — chart/table presets re-routed through `type:"insight"`.

No DB migrations, no new packages, no edge functions.