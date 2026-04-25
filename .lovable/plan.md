# Build DataBoard

Implement the previously approved plan. Minimal-credit execution: one route, one grid wrapper, one widget shell, a small set of widgets, and a time-range bar — all reusing existing infra (`userPrefs`, `DateRangePresets`, `recharts`, permissions).

## Steps

1. **Install deps**: `bun add react-grid-layout` + `bun add -d @types/react-grid-layout`. Import its CSS in `src/styles.css`.

2. **Migration**: insert `databoard.view`, `databoard.view_all`, `databoard.edit_layout` into `permissions`, and grant `view`+`edit_layout` to admin/manager and `view` to tech/marketer/user via `role_permissions`.

3. **New files**:
   - `src/routes/databoard.tsx` — page with TimeRangeBar + WidgetGrid + Edit toggle + Add-widget menu. Gated by `databoard.view`.
   - `src/components/databoard/WidgetCard.tsx` — universal shell with `.drag-handle` header, remove/configure menu.
   - `src/components/databoard/WidgetGrid.tsx` — `react-grid-layout` ResponsiveGridLayout; persists layout to `user_preferences.prefs.databoard.layouts` (debounced).
   - `src/components/databoard/TimeRangeBar.tsx` — Live(Today)/Yesterday/This+Last Week/Month/Year/Custom + saved presets (system + per-user) + "Save current range".
   - `src/components/databoard/AddWidgetMenu.tsx` — picker.
   - `src/components/databoard/widgets/{KpiWidget,ChartWidget,TableWidget,GoalWidget,ActivityWidget}.tsx`.
   - `src/lib/databoard/queries.ts` — single Supabase query builder (applies date range + tech/marketer scope).

4. **Scoping**: in `queries.ts`, if user lacks `databoard.view_all`, look up `technicians.tech_name where user_id = auth.uid()` and filter `jobs.tech_name`. Marketer scope mirrors existing marketer logic.

5. **Live mode**: when range = Today/Live, set 30s `setInterval` to refetch.

6. **Nav**: add "DataBoard" entry to `src/components/MobileNav.tsx` (and any desktop nav) gated by `databoard.view`.

7. **Persistence**: extend `userPrefs` with `databoard: { layouts, widgets, savedRanges }` namespace (no schema change, just a new key inside `prefs` jsonb).

## Outcome
A `/databoard` route where any user with permission gets a draggable/resizable widget grid, full time-range controls (incl. Live + custom + saved), auto-scoped data per role, and per-user persisted layouts.