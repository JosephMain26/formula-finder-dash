## Goal
Make the DataBoard a true business-performance hub: any data source rendered as the chart type the user picks, full control over the report's KPI/table columns, and per-user views that survive logout.

## 1. Configurable "Insights" widget (replaces fixed chart/table types)

Add a new generic widget type `insight` in `src/components/databoard/widgets/InsightWidget.tsx`. Settings:
- `dimension`: `tech_name | company | job_type | status | payment | installer_name | city | day | week | month`
- `metric`: `revenue | profit | count | avg_ticket | tech_pay | marketer_pay | parts_cost | tip`
- `viz`: `bar | line | area | pie | donut | table | number`
- `limit`: number (top‑N for categorical dimensions)
- `sort`: `desc | asc`

The widget aggregates `jobs` by `dimension` (using `job_date` bucketed for day/week/month, and parsed city for `city`) and renders with the chosen `viz` (recharts for bar/line/area/pie/donut, a small table for `table`, a big single number for `number`). Existing `ChartWidget` / `TableWidget` stay for backward compat — we just stop creating new ones from the menu.

### Edit-in-place
Add a small "⚙" button on `WidgetCard` (only when `editing` is true) that opens an `InsightSettingsDialog` (`src/components/databoard/InsightSettingsDialog.tsx`). It edits the widget's `title`, `dimension`, `metric`, `viz`, `limit`, `sort` and calls `onUpdate(widgetId, patch)` propagated from `WidgetGrid` → `databoard.tsx`. This means each user can fully build their own widgets — pick "Job type" + "Revenue" + "Pie", or "Tech" + "Tech pay" + "Bar", etc.

### Add menu rewrite (`AddWidgetMenu.tsx`)
Replace the long list with three groups:
- **KPI tile** — opens a tiny picker for `metric` + `label`.
- **Insight** — adds a default Insight widget (`dimension=tech_name, metric=revenue, viz=bar`); user then clicks ⚙ to tune it.
- **Special** — Calendar, Map, Activity, Goal (these stay as-is).

## 2. Export — full KPI + table column control

In `src/components/databoard/ExportBoardDialog.tsx`:
- Add a **KPI columns** section (checkbox grid) controlling which KPI cells appear in the "Snapshot" table. Options: `revenue, profit, jobs, avg_ticket, tech_pay, marketer_pay, parts, tip, paid_count`. Replaces the hard-coded 4-column row at lines 159-164. Dynamic `head`/`body` arrays built from the selected keys, so excluding "Tech pay" (the user's example) just drops that column.
- Persist `kpiColumns: string[]` on `ExportTemplate` (extend the type in `src/lib/databoard/templates.ts` — backward compatible: missing field defaults to all enabled).
- Existing table-columns picker already works; keep it. Existing template save/load already works; just include the new `kpiColumns` field.

## 3. Per-user view that survives logout

Already partially in place via `loadUserPrefs/saveUserPrefs` (stored in `user_preferences.prefs` table, keyed to `auth.uid()` with RLS). What's missing:

- **Auto-save the active view as "Last view"**: in `databoard.tsx`, whenever `widgets`, `layouts`, `filters`, `rangeKey`, or `customRange` changes, persist them under `prefs.databoard.lastView` (already done for widgets/layouts; we add filters + range to the same auto-save and ensure it's restored on hydrate). On mount, if no saved templates apply, restore `lastView` so logging out and back in shows the exact same board.
- **Remove the "cache" reset on logout side-effect on remote data**: confirm `resetUserPrefsCache()` only clears the in-memory cache (it does — see `src/lib/userPrefs.ts:94`). Remote prefs in Supabase persist, so re-login rehydrates them.
- **Sign-out hook**: ensure `auth-context` calls `resetUserPrefsCache()` on sign-out so the next user doesn't inherit the previous user's cached view (verify and add if missing).

## 4. Files touched

**Created**
- `src/components/databoard/widgets/InsightWidget.tsx` — generic configurable widget.
- `src/components/databoard/InsightSettingsDialog.tsx` — settings UI for an insight widget.

**Edited**
- `src/components/databoard/WidgetGrid.tsx` — register `insight` type, add `onUpdate` prop, pass to `WidgetCard`.
- `src/components/databoard/WidgetCard.tsx` — add ⚙ settings button when editing.
- `src/components/databoard/AddWidgetMenu.tsx` — slim menu (KPI / Insight / Special).
- `src/components/databoard/ExportBoardDialog.tsx` — KPI-column picker, dynamic snapshot table.
- `src/lib/databoard/templates.ts` — add `kpiColumns` to `ExportTemplate`.
- `src/routes/databoard.tsx` — persist & restore filters + range as part of `lastView`; wire `onUpdate` for insight widgets.
- `src/lib/auth-context.tsx` — call `resetUserPrefsCache()` on sign-out (only if not already wired).

## Notes
- No new npm packages, no DB migrations — `user_preferences` already exists with proper RLS.
- Existing widgets keep working; nothing breaks.
- Keeping diffs tight to minimize credit use.