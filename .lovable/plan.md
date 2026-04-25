## DataBoard upgrade — widgets, filters, exports, templates

To keep credit usage low I'll reuse existing components (`JobDialog`, `ExportReportDialog` patterns, `DateRangePresets`, `DatePickerField`, `ColumnToggle`) and persist everything in the existing `user_preferences.prefs.databoard` JSONB blob — **no DB migration needed**.

### 1. Friendly header (`src/routes/databoard.tsx`)
- Replace the plain "DataBoard" title with a time-aware greeting using the user's first name from `auth-context`'s `displayName` (split on space, fall back to email local-part).
- Subtitle: *"Let's see how everything looks today."*
- Keep the role badge style consistent with the dashboard memory rule (`Good morning/afternoon/evening, {first} 👋`).

### 2. New widgets

**`CalendarWidget` (`src/components/databoard/widgets/CalendarWidget.tsx`)**
- Month grid built on the existing shadcn `Calendar` (react-day-picker) with custom `DayContent` showing a colored dot + job count per day.
- Click a day → opens a popover/sheet listing that day's jobs; clicking a job opens the existing `JobDialog` in edit mode (reused, not rebuilt).
- Aggregates from the already-fetched `jobs` prop — zero extra queries.

**`MapWidget` (`src/components/databoard/widgets/MapWidget.tsx`)**
- **Leaflet + OpenStreetMap** (free, no API key). Add deps: `leaflet`, `react-leaflet`, `@types/leaflet`.
- Geocode `job.address` via Nominatim (free) with localStorage cache keyed by address (so re-renders cost nothing). Throttle to 1 req/sec to respect Nominatim's policy; show a small "geocoding…" indicator.
- Pins clustered with simple offset jitter (skip clustering plugin to keep bundle small). Click pin → popup with job summary + "Open ticket" button → opens `JobDialog` in edit mode.
- Default tile layer: OSM standard. Container respects grid resize via the existing `ResizeObserver` in `WidgetGrid`.

Both widgets registered in `WidgetGrid.tsx` (`renderWidget` switch) and `AddWidgetMenu.tsx` (new entries with sensible default sizes — calendar `w:6 h:7`, map `w:6 h:7`).

### 3. Filters bar (`src/components/databoard/FiltersBar.tsx`)
A new collapsible bar above the grid. All filter values live in component state, persisted in `user_preferences.prefs.databoard.filters`, and applied to the `jobs` array client-side before passing to widgets (no extra fetches).

Filters:
- **Tech** (multi-select from distinct `tech_name`)
- **Marketer / Company** (multi-select from `companies`)
- **Installer** (multi-select)
- **Job type** + **Status** (multi-select)
- **Payment method** (multi-select from `loadPaymentMethods()`)
- **Paid / Unpaid** (tri-state: any/paid/unpaid)
- **Price range** (min–max numeric inputs)
- **City** (free-text contains, parsed from address)

A "Clear all" button + active-filter chip count.

### 4. Export with attached data (`src/components/databoard/ExportBoardDialog.tsx`)
Builds on the existing `jspdf` + `jspdf-autotable` already in the project (no new deps).

Options in the dialog:
- **Sections to include** (drag-orderable like existing ExportReportDialog): Greeting, Active filters summary, KPI cards snapshot, each chart (rendered to PNG via `html-to-image` — small dep, ~10kB), Calendar summary, Map snapshot, Jobs table, **Appendix: raw jobs data**.
- **Table column picker** — reuse `ALL_COLUMNS` from `ColumnToggle`; user toggles which fields appear in the jobs table inside the report.
- **"Attach jobs as CSV"** checkbox — when on, also generate a CSV of the filtered jobs and bundle it with the PDF in a ZIP (`jszip` — already common, will add if not present).
- File name + page size (A4/Letter, portrait/landscape).

### 5. Templates (both view and export)

Stored under `user_preferences.prefs.databoard.templates`:
```ts
{
  views: [{ id, name, widgets, layouts, filters, rangeKey, customRange }],
  exports: [{ id, name, sections, columns, attachJobs, pageSize, orientation }]
}
```

UI:
- **View templates dropdown** in the header (next to Edit layout): Save current view, Apply, Rename, Delete, Set default.
- **Export templates dropdown** inside `ExportBoardDialog`: Save as template, Apply, Delete.

Helpers added to `src/lib/databoard/templates.ts` (pure functions, no DB calls beyond the existing `saveUserPrefs`).

### 6. Files

**Create**
- `src/components/databoard/widgets/CalendarWidget.tsx`
- `src/components/databoard/widgets/MapWidget.tsx`
- `src/components/databoard/FiltersBar.tsx`
- `src/components/databoard/ExportBoardDialog.tsx`
- `src/components/databoard/ViewTemplatesMenu.tsx`
- `src/lib/databoard/templates.ts`
- `src/lib/databoard/geocode.ts` (Nominatim client + localStorage cache)

**Edit**
- `src/routes/databoard.tsx` — friendly header, mount FiltersBar/ExportBoardDialog/ViewTemplatesMenu, apply filters, pass `onOpenJob` handler.
- `src/components/databoard/WidgetGrid.tsx` — render new widget types, accept `onOpenJob` callback.
- `src/components/databoard/AddWidgetMenu.tsx` — add Calendar + Map entries.
- `src/styles.css` — `@import "leaflet/dist/leaflet.css";`

**Dependencies to add**
- `leaflet`, `react-leaflet`, `@types/leaflet`
- `html-to-image` (chart → PNG for PDF)
- `jszip` (only if not already in lockfile; ZIP bundling for PDF + CSV)

### 7. Defaults chosen to save credits / avoid back-and-forth
- **Map**: free Leaflet + OSM (no API key needed from you).
- **Ticket open**: reuse existing `JobDialog` in edit mode — same UX as the main jobs page.
- **View templates**: full snapshot (widgets + layout + filters + time range) — most useful.
- **Filters**: implementing the broad set listed above so you don't need to ask for more later.

If you want a different map provider (Google/Mapbox), read-only ticket previews instead of the full edit dialog, or a narrower template scope, say so before approving and I'll adjust.