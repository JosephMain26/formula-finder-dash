## Root causes found

After reading the code + querying your live data, here's what's actually going on:

### 1. "Best closing tech" — counts all jobs regardless of status
There is no widget literally named "Best closing tech" in the code. The widgets that rank techs (the `insight` "Top techs" preset, the `KpiWidget` "Active techs", and `AnalyticsPanel` "Most jobs / tech" / "Most profit / tech") all aggregate **every** job — including `Cancelled` ones. Your DB currently has `Completed` and `Cancelled` jobs, so cancelled jobs are inflating the rankings.

### 2. Legacy chart widgets aren't configurable
The new `insight` widgets already have the gear icon → choose Bar/Pie/Line/Area/Donut/Table/Number. ✅
But the **default board** still ships `type: "chart"` widgets (`Revenue over time`, `Top techs`, `Status breakdown`) which use the old `ChartWidget` with **hardcoded viz**. So if you didn't add a widget yourself via "Add widget → Job types", you're stuck on the original visualization. Same for any `type: "table"` widgets saved earlier.

### 3. DataBoard data wiring — `company` vs `company_1`
This is the real "DB connection" bug. Querying jobs directly:
- Every row has `company = NULL`
- The marketer name actually lives in `company_1`

But `FiltersBar`, `InsightWidget` (dimension `company`), `queries.ts` (`scope.marketerName`), and `KpiWidget` all read `j.company`. That's why the Marketer filter is empty and any "Top marketers" / marketer-grouped insight shows only "(empty)". `AnalyticsPanel` is the only place that correctly falls back to `company_1`.

Also, jobs with `job_date IS NULL` are silently dropped by the date-range query (`gte/lte` excludes nulls). Worth surfacing.

---

## Proposed fixes (minimal, surgical — no extra credits beyond what's needed)

### A. Restrict "tech ranking" metrics to completed jobs

Add a `completedOnly` toggle to the `insight` widget settings (default **on** for tech-grouped count/revenue presets). In `InsightWidget.tsx`:

```ts
const filtered = settings.completedOnly
  ? jobs.filter((j) => (j.status || "").toLowerCase() === "completed")
  : jobs;
```

Add the toggle to `InsightSettingsDialog.tsx`. Update the "Top techs" preset in `AddWidgetMenu.tsx` to default `completedOnly: true` and rename it **"Best closing techs"**.

Also patch `KpiWidget` `tech_count` / `paid_count` to honor a `completedOnly` flag, and add a "Completed jobs" KPI preset.

### B. Make legacy charts configurable + auto-migrate the defaults

1. In `databoard.tsx`, replace `DEFAULT_WIDGETS` chart entries with `type: "insight"` equivalents (revenue/day → area, top techs → bar w/ completedOnly, status → pie).
2. In `WidgetGrid.renderWidget`, transparently render any old `type: "chart"` or `type: "table"` widget through `InsightWidget` by mapping its old `variant` → `{dimension, metric, viz}`. The gear icon then becomes available for them too.
3. Show the gear icon for `chart`/`table`/`insight` (not just `insight`). On save, rewrite the widget as `type: "insight"` so it's persisted in the new format.

This means **every** existing widget — including your current "Top techs" or any saved chart — instantly gets the Bar/Pie/Line/Area/Donut/Table/Number switcher.

### C. Fix the marketer/company column mismatch (the real "DB not connected" bug)

Three small changes:

1. **`queries.ts`** — fetch both columns and normalize:
   ```ts
   // After fetch, coalesce so the rest of the app only needs `company`.
   return (data || []).map((j: any) => ({ ...j, company: j.company || j.company_1 || null }));
   ```
   And in scope filtering, use `.or("company.eq.X,company_1.eq.X")`.

2. **`InsightWidget.dimKey`** — for `dimension === "company"`, fall back to `company_1`.

3. **`FiltersBar.optionsFromJobs`** — for the marketer column, derive from `company || company_1`. Apply same coalesce in `applyFilters`.

### D. Surface jobs with no `job_date`

Add a tiny "+ N undated jobs not shown" hint under the FiltersBar when the unfiltered fetch returns rows that fall outside the date range only because `job_date` is null. (Pure UI hint, no extra query.)

---

## Files to touch

- `src/components/databoard/widgets/InsightWidget.tsx` — `completedOnly` filter, `company_1` fallback
- `src/components/databoard/widgets/KpiWidget.tsx` — `completedOnly` support, completed-count metric
- `src/components/databoard/InsightSettingsDialog.tsx` — completedOnly switch
- `src/components/databoard/AddWidgetMenu.tsx` — rename "Top techs" → "Best closing techs", default `completedOnly: true`; add "Completed jobs" KPI
- `src/components/databoard/WidgetGrid.tsx` — render legacy `chart`/`table` via `InsightWidget` adapter; expose gear icon for them
- `src/components/databoard/FiltersBar.tsx` — marketer options + matching with `company_1` fallback
- `src/lib/databoard/queries.ts` — coalesce `company`/`company_1`; scope `.or()` filter
- `src/routes/databoard.tsx` — replace legacy `DEFAULT_WIDGETS` chart entries with insight equivalents; add undated-jobs hint

No DB migrations, no new packages, no edge functions.