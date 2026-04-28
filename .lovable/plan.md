## Plan

1. Correct the DataBoard metric formulas at the source
- Create one shared metrics helper for DataBoard calculations so KPI widgets, insight widgets, and exports all use the same logic.
- Make each metric read from the same database-backed fields the rest of the app already uses.
- Replace ad-hoc profit math with the stored totals from jobs data so the board reflects the actual values saved on each job.

2. Remove stale completed-only behavior from saved DataBoard setups
- Expand the existing widget normalization so old saved widgets and saved view templates cannot silently keep `completedOnly` on generic job-count widgets.
- Keep completed-only behavior only where it is intentional, such as the dedicated “Completed jobs” KPI and “Best closing techs”.
- Ensure the live board and saved templates both reload with the corrected settings.

3. Align DataBoard outputs everywhere
- Update `KpiWidget`, `InsightWidget`, and `ExportBoardDialog` to use the same shared calculations.
- Review DataBoard labels so what is shown matches what is being calculated.
- Keep the change minimal and avoid any database/schema changes unless validation shows one is truly required.

4. Verify against the actual job records
- Cross-check a sample of DataBoard totals against the fetched jobs dataset for the same range and filters.
- Confirm that counts reflect all matched jobs unless a widget explicitly says it is completed-only.
- Confirm filtered results, totals, and exports stay in sync.

## Likely root causes found
- DataBoard still has multiple duplicated calculation formulas, and they are not all consistent with the job values stored by the app.
- Older saved widget/view settings can still reintroduce `completedOnly`, which makes “Job count” and similar widgets look wrong even after the earlier fix.
- Export calculations and widget calculations are not fully aligned, so different parts of DataBoard can disagree.

## Files likely to change
- `src/routes/databoard.tsx`
- `src/components/databoard/widgets/KpiWidget.tsx`
- `src/components/databoard/widgets/InsightWidget.tsx`
- `src/components/databoard/ExportBoardDialog.tsx`
- `src/components/databoard/ViewTemplatesMenu.tsx`
- `src/lib/databoard/templates.ts`
- new shared helper, likely `src/lib/databoard/metrics.ts`

## Technical details
- Use database fields like `total_office`, `total_tech`, `total_marketer`, `parts`, `co_parts`, `office_parts`, `price`, and `cost` consistently instead of recomputing different versions in different widgets.
- Treat `jobs.length` from the already-fetched, already-filtered dataset as the source of truth for generic counts.
- Normalize persisted widget settings on load/apply so legacy saved views cannot keep incorrect completed-only filters alive.

Once approved, I’ll implement the narrowest possible fix focused only on DataBoard accuracy.