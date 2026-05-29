## Goal

Make the **Automation Center** on the Reports page do three things you asked for:

1. **Set the report's time range inside the automation itself** — e.g. "the past week" — without having to bake it into a saved template.
2. **Schedule in your local timezone** — when you pick "Sunday 11:00 PM", that means 11 PM where you are, not UTC.
3. **One automation, every marketer individually** — this already exists (the "Send each marketer their own individual report" toggle); we'll make it clearer and make sure it respects the chosen time range.

No database migration is needed (schedule data is stored as flexible JSON), so this stays cheap on credits.

## What changes

### 1. Automation form — add a Date range selector (`src/routes/reports.tsx`)
In `AutomationForm`, add a "Report time range" dropdown bound to `editing.template.dateMode` (All dates, Today, This week, **Last week**, This month, Last month, This year, Custom). For "Custom" show the two date pickers writing to `template.dateFrom`/`dateTo`. This reuses the existing `DATE_MODES` list and `ReportSpec` fields, so the relative range (e.g. "last-week") is recomputed each time the report runs.

Example: pick **Weekly → Sunday → 11:00 PM** + range **Last week** + toggle **Send each marketer their own report** → every Sunday night each marketer gets their own report for the previous week.

### 2. Local timezone scheduling
- **Schedule type** (`src/lib/reportAutomations.ts`): add `tz?: string` to `AutomationSchedule`.
- **Form default**: new automations capture the browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. The time field label changes from "Time (UTC)" to "Time" with a small note showing the detected timezone (e.g. "Times are in America/New_York").
- **Dispatch hook** (`src/routes/api/public/hooks/dispatch-report-automations.ts`): rewrite `isDue` so the current hour / weekday / day-of-month are evaluated in the automation's `tz` (using `Intl.DateTimeFormat(..., { timeZone })`), falling back to UTC if absent. The relative date range ("last week", etc.) is also resolved against the automation's local calendar date so "past week" is correct for the recipient's timezone.

### 3. Per-marketer (already works — minor polish)
The `perMarketer` toggle and the dispatch logic that sends each marketer their own filtered report already exist. We'll keep it and confirm it combines with the new time-range setting (the per-marketer path already preserves `dateMode`). No structural change.

## Out of scope
- No new table / migration (reuses the existing `report_automations.schedule` JSON).
- The cron job already runs every 15 minutes; no scheduling infra change.
- The on-page PDF builder and saved templates are untouched.

## Technical notes
- The dispatch runs in a Worker; `Intl.DateTimeFormat` with `timeZone` is supported there, so timezone math needs no extra dependency.
- `isDue` keeps its "don't re-run the same occurrence" guard via `last_run_at`, now compared against the tz-local occurrence time.
- Files touched: `src/routes/reports.tsx`, `src/lib/reportAutomations.ts`, `src/routes/api/public/hooks/dispatch-report-automations.ts`.
