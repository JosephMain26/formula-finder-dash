## Plan

Fix DataBoard so it is truly driven by the jobs database, shows complete results by default, and updates immediately when jobs change.

### What I will change

1. Replace the current client-only fetch flow with a server-backed DataBoard data loader
- Move the jobs fetch into a server function so the board reads from the same backend data source as the rest of the app.
- Return both the filtered job rows and summary metadata from one place.
- Keep existing role/scope rules intact so tech users still see only their own jobs while managers/admins can see all.

2. Fix the “half information” issue at the source
- Remove the hard `limit(2000)` cap from the DataBoard jobs query and implement safe pagination/batching so the board can load the full matching result set.
- Preserve the `company` / `company_1` normalization so marketer data is counted correctly everywhere.
- Reuse the same filtering logic for widgets, tables, export, and visible counts so all sections stay consistent.

3. Make the board feel dynamically connected
- Add live refresh behavior tied to jobs changes instead of relying only on the current 30-second poll.
- Keep a lightweight fallback refresh for resilience, but stop treating “today only + polling” as the main sync path.
- Refresh DataBoard immediately after job edits from the board dialog.

4. Fix the misleading default state
- Change the initial time range behavior so the first board load does not look empty when there are no jobs today.
- Add clearer empty-state messaging that explains whether the current range/filters are hiding results.
- Show total matched jobs for the current range so users can verify the board is reading the database.

5. Audit widget calculations against the same dataset
- Ensure KPI, insight, activity, calendar, map, and export all consume the exact same filtered jobs array.
- Check “completed only” widgets, job type widgets, and marketer/company widgets against the live backend result.
- Keep export aligned with the same dataset so the PDF matches what the board shows.

### Files likely involved
- `src/routes/databoard.tsx`
- `src/lib/databoard/queries.ts`
- `src/components/databoard/FiltersBar.tsx`
- `src/components/databoard/WidgetGrid.tsx`
- `src/components/databoard/widgets/InsightWidget.tsx`
- `src/components/databoard/widgets/KpiWidget.tsx`
- `src/components/databoard/ExportBoardDialog.tsx`
- possibly a new server function file under `src/lib/databoard/`

### Technical details
- Current database data confirms the main confusion: there are jobs in the database, but none are dated today, while the DataBoard defaults to `Live (Today)`. That makes the page look disconnected even when the backend is returning data.
- The current query also uses `limit(2000)`, which can silently truncate results for larger datasets.
- The board currently refreshes mainly through a manual refetch / 30s timer path. I will switch it to a backend-driven fetch flow plus live invalidation so updates appear reliably.
- No unsafe schema change is required for this fix unless, during implementation, I confirm a backend-side optimization is needed for performance.

### Result
After this change, DataBoard will read the complete jobs dataset for the selected range, stay in sync with the backend, and stop appearing empty or partial when the database actually contains matching jobs.