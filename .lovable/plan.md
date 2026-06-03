# Merge Balances into Reports — one "Reports" screen

## Goal
Reduce the number of screens. Both `/reports` and `/balances` are admin-only and overlap (Reports already computes a marketer balance summary). Combine them into a single page with tabs so the user has one place for everything reporting-related.

## Result for the user
The "Reports" page becomes the single hub with three tabs:
- **Report Builder** — existing custom PDF report builder (unchanged).
- **Marketer Balances** — the full weekly balance view (date presets, filters, per-marketer balance table, per-marketer PDF) moved here as-is.
- **Automation Center** — existing scheduled report delivery (unchanged).

The separate "Balances" button/link is removed from the top bar and mobile menu. Visiting `/balances` directly still works — it redirects to the Balances tab so old bookmarks don't break.

## What changes

### 1. Extract the Balances UI into a reusable panel
- Move the body of `src/routes/balances.tsx` (the whole `BalancesPage` content: period card, filters card, balances table, PDF download) into a new component `src/components/BalancesPanel.tsx`.
- It keeps its own data fetch and state — no logic changes, just relocated so it can render inside a tab without its own page header.

### 2. Add the tab to the Reports page
- In `src/routes/reports.tsx`, add a third `TabsTrigger`/`TabsContent` labeled **Marketer Balances** that renders `<BalancesPanel />`.
- Rename the page heading to something neutral like "Reports & Balances" so the title reflects the combined scope.

### 3. Turn `/balances` into a redirect
- Replace `src/routes/balances.tsx` content with a small route that redirects to `/reports` (defaulting to the Balances tab via a query param or hash). This preserves the existing URL and any bookmarks.

### 4. Clean up navigation
- Remove the standalone **Balances** link from `src/components/MobileNav.tsx` and the **Balances** button from `src/routes/index.tsx` top bar (the Reports entry now covers both).

## Technical notes
- The Reports `Tabs` component already supports multiple tabs; we just add one more `TabsContent`.
- `BalancesPanel` reuses the existing `summarizeByMarketer`, `jsPDF`/`autoTable`, and filter logic verbatim — nothing in `src/lib/marketerBalance.ts` changes.
- Tab selection from the redirect can be driven by reading a `?tab=balances` search param in `reports.tsx` and passing it as the `Tabs` `defaultValue`.
- No database, RLS, or server-function changes. This is purely a frontend/navigation reorganization, which keeps credit usage minimal.

## Out of scope
- No change to how balances or reports are calculated.
- No change to automation scheduling or the report PDF format.
