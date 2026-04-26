Update DataBoard so widgets use the full filtered dataset by default, and only use completed-only logic when a widget is explicitly meant to do that.

Plan
1. Normalize widget settings on load in `src/routes/databoard.tsx` so previously saved widgets no longer stay stuck on `completedOnly: true`.
   - Strip `completedOnly` from regular KPI and insight widgets during hydration.
   - Preserve the dedicated `Completed jobs` metric/card.

2. Remove completed-only defaults from DataBoard presets.
   - Update `DEFAULT_WIDGETS` in `src/routes/databoard.tsx` so revenue, profit, avg ticket, revenue-over-time, and tech ranking widgets use all jobs.
   - Update `AddWidgetMenu.tsx` so newly added widgets also default to all jobs.
   - Update legacy chart adapters in `WidgetGrid.tsx` so old chart/table widgets no longer inherit completed-only behavior.

3. Keep filtering behavior consistent with the filters bar.
   - Ensure KPI and insight widgets continue to read from `filteredJobs`, so status filtering is controlled by the main filters the user asked for.
   - Leave the explicit `Completed jobs` KPI available as a separate metric.

Technical details
- Root cause: the board currently has multiple hardcoded `completedOnly: true` defaults in `databoard.tsx`, `AddWidgetMenu.tsx`, and `WidgetGrid.tsx`. Because widgets are also persisted in user preferences, changing defaults alone will not fix existing boards.
- Minimal implementation: add a small widget-settings normalizer during prefs load, then remove the hardcoded completed-only defaults from new presets.
- Expected result: cards like `Job count` show all jobs in the current range and current filters, and status-specific views are controlled by the filters bar instead of hidden per-widget defaults.