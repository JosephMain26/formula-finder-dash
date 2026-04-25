# DataBoard — Draggable & Resizable Widget Dashboard

A new `/databoard` section where users build a live, customizable dashboard of KPIs, charts, tables and goals. **Every widget is draggable and resizable** on a grid, and layouts are persisted per user.

---

## 1. Grid & Widget Engine (the core of this update)

**Library**: `react-grid-layout` (small, battle-tested, no heavy deps; works with our Tailwind setup). Added via `bun add react-grid-layout` + `@types/react-grid-layout`.

Why this lib:
- Drag handle on widget header, resize handle on bottom-right corner (and edges).
- Snap-to-grid with collision avoidance.
- Built-in `WidthProvider` for responsive column counts.
- Serializable layout (`{i, x, y, w, h, minW, minH}`) → trivial to save into `user_preferences`.

### Widget shell (`src/components/databoard/WidgetCard.tsx`)
Every widget — **KPI, chart, table, goal, anything we add later** — is wrapped in this shell so they all get the same drag/resize behavior automatically:

```tsx
<div className="group relative h-full rounded-xl border bg-card">
  <div className="drag-handle cursor-move flex items-center justify-between px-3 py-2 border-b">
    <span className="text-sm font-medium">{title}</span>
    <WidgetMenu onRemove={...} onConfigure={...} />
  </div>
  <div className="p-3 h-[calc(100%-40px)] overflow-auto">{children}</div>
  {/* react-grid-layout injects the resize handle in the bottom-right */}
</div>
```

- Drag is restricted to the header (`draggableHandle=".drag-handle"`) so inner controls (filters, dropdowns) stay clickable.
- Resize handles on `["se","e","s"]` (corner + right + bottom edges).
- `minW/minH` defined per widget type (e.g. KPI min 2×2, chart min 4×3).

### Layout persistence
- Stored in `user_preferences.prefs.databoard.layouts` (already have `userPrefs.ts` infra).
- Shape: `{ lg: Layout[], md: Layout[], sm: Layout[] }` for responsive breakpoints.
- Debounced save on every drag/resize stop (reuses existing `saveUserPrefs` debounce).
- Also store `widgets: WidgetConfig[]` (id, type, title, settings like which metric/chart/filter).

### Edit vs View mode
- Toggle button in DataBoard toolbar: **"Edit layout"**.
- When OFF: `isDraggable=false`, `isResizable=false`, drag handle hidden — clean view.
- When ON: handles + dashed grid background appear.
- Prevents accidental layout changes during normal use.

---

## 2. Widget Types (all share the draggable/resizable shell)

1. **KPI Card** — Revenue, Profit, Job count, Avg ticket, Conversion %, Active techs.
2. **Line/Area Chart** — Revenue over time (recharts, already in project).
3. **Bar Chart** — Top techs / marketers / job types by revenue or count.
4. **Pie/Donut** — Job status breakdown, payment method split.
5. **Table widget** — Recent jobs, top customers (compact, sortable).
6. **Goal widget** — Progress bar toward a monthly/weekly revenue target (user sets target, stored in prefs).
7. **Comparison widget** — This period vs previous period (delta + sparkline).
8. **Live activity feed** — Last N jobs added (auto-refresh in Live mode).

User can add any widget via "+ Add widget" menu, configure it (metric + filter), and place it anywhere on the grid.

---

## 3. Time-Range Bar (`src/components/databoard/TimeRangeBar.tsx`)

Sticky toolbar at the top with:
- **Live (Today)** — auto-refresh every 30s, pulsing dot indicator.
- **Yesterday**
- **This week** / **Last week**
- **This month** / **Last month**
- **This year**
- **Custom** — opens date pickers.
- **Saved presets** — loaded from `app_settings.date_range_presets` (existing) + user-personal presets in `user_preferences.prefs.databoard.savedRanges`.
- **"Save current range"** button → prompts for a name, stores in user prefs.

Range is global to the page and applied to every widget's query.

---

## 4. Data Scoping & Permissions

- Add permission keys: `databoard.view`, `databoard.view_all`, `databoard.edit_layout`.
- Default role mapping:
  - **Admin/Manager**: all three.
  - **Tech**: `databoard.view` only — and queries are auto-filtered by `tech_name` (resolved via `technicians.user_id = auth.uid()`, already exists).
  - **Marketer**: `databoard.view` + scoped to their own marketer name (mirrors how marketer % is handled today).
- Marketer-percentage widgets are hidden for users without the existing `marketer.view_percentage` permission (from earlier work).

---

## 5. Extra value-adds I'd recommend

These cost almost nothing on top of the engine above and round the feature out:

- **Period-over-period deltas** on every KPI (e.g. "+12% vs last week") — single SQL with two date windows.
- **Export DataBoard snapshot to PDF** — reuse `ExportReportDialog` infrastructure; renders current widgets to a printable layout.
- **Per-widget filter override** — a widget can pin itself to a different range (e.g. "Always show This Year" on one chart while the page is on Today).
- **Dashboard presets** — save a whole layout+widgets combo as a named view (e.g. "Sales focus", "Tech performance"); switch via dropdown.
- **Empty state** with a "Start from template" picker (Sales, Operations, Tech personal) so users don't face a blank grid.

---

## 6. Files to create / edit

**New**
- `src/routes/databoard.tsx` — page, toolbar, grid, edit-mode toggle.
- `src/components/databoard/WidgetCard.tsx` — universal draggable/resizable shell.
- `src/components/databoard/WidgetGrid.tsx` — `react-grid-layout` wrapper, persists layout.
- `src/components/databoard/TimeRangeBar.tsx` — presets + custom + save preset.
- `src/components/databoard/AddWidgetMenu.tsx` — picker for new widgets.
- `src/components/databoard/widgets/` — `KpiWidget.tsx`, `ChartWidget.tsx`, `TableWidget.tsx`, `GoalWidget.tsx`, `ActivityWidget.tsx`.
- `src/lib/databoard/queries.ts` — single place that builds the scoped Supabase query (applies range + tech/marketer filter).
- New migration: add `databoard.*` permission keys to roles config.

**Edited**
- `src/components/MobileNav.tsx` — add "DataBoard" entry (gated by `databoard.view`).
- `src/lib/userPrefs.ts` — no code change, just new `databoard` namespace inside prefs.
- `src/styles.css` — import `react-grid-layout/css/styles.css` + `react-resizable/css/styles.css` and a small override so handles match our theme.

**Dependencies**
- `bun add react-grid-layout react-resizable`
- `bun add -d @types/react-grid-layout @types/react-resizable`

---

## Outcome

One coherent DataBoard where the user freely drags widgets around, resizes them by dragging the corner/edges, picks a time range (including Live), saves custom ranges, and gets data automatically scoped to their role — with everything persisted per user.
