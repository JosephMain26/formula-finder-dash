## Issues Diagnosed

### 1. Filters return inaccurate / empty data
- **Marketer filter is broken**: `FiltersBar` lists options from the `companies` table (`company_name`) but `applyFilters` compares against `jobs.company`. Inspection of the database shows `jobs.company` is currently NULL for all rows, so selecting any marketer always returns 0 jobs. Same latent risk exists for **Installer** (`installers.name` vs `jobs.installer_name`).
- **Empty / NULL values can't be filtered**: rows where `tech_name`, `job_type`, etc. are empty are silently grouped as "—" by widgets but excluded from the filter option list, so the user can't include or exclude them deliberately.
- **No "(empty)" handling**: if a filter is applied and a job's value is `null`, it's currently dropped (`!f.techs.includes(j.tech_name || "")`).

### 2. PDF export duplicates snapshots across pages
In `ExportBoardDialog.tsx → runExport()`, the loop handles `charts`, `calendar`, and `map` by snapshotting the **same** `boardElementId` DOM root each time:
```ts
} else if (s.id === "charts" || s.id === "calendar" || s.id === "map") {
  const root = document.getElementById(boardElementId);
  ...snapshot root...
}
```
So enabling two of these sections produces the same image twice (often spilling onto a 2nd page). The default config has `charts: true` and a user enabling `calendar` or `map` immediately gets duplicates.

### 3. Widget snapshots show scrollbars
`WidgetCard` uses `overflow-auto` on the body. When captured by `html-to-image`, the live scrollbars appear in the PNG.

---

## Fixes (minimal, no new dependencies)

### A. Filters — make options match data, allow empty values

**`src/components/databoard/FiltersBar.tsx`**
- Build **all** option lists (techs, marketers, installers, job types, statuses, payments) from the **jobs in scope**, not from `companies` / `installers` tables. This guarantees what's offered actually exists in the data and respects the user's scope (tech-only users only see their own data anyway).
- Drop the `useEffect` that fetches `companies`/`installers`/`payments` from Supabase — it adds round-trips and produces a mismatch with the actual `jobs.company` strings.
- Include an "(empty)" option when the field has null/empty rows, mapped to `""` internally.

**`applyFilters` in same file**
- Treat empty selection as "no constraint" (already correct).
- When `""` is in the selection, match jobs whose value is null/empty.

### B. PDF export — snapshot widgets individually, dedupe sections, hide scrollbars

**`src/components/databoard/WidgetGrid.tsx`**
- Add `data-pdf-section` and a `data-widget-type` attribute to each widget wrapper `<div key={w.i} data-pdf-section data-widget-type={w.type}>`. This lets the exporter pick widgets by category instead of capturing the whole grid.

**`src/components/databoard/WidgetCard.tsx`**
- Add a small CSS escape hatch: when ancestor has class `pdf-capturing`, switch the body from `overflow-auto` to `overflow-hidden` and force `min-height` to fit content. Implemented purely with Tailwind utility classes via `[.pdf-capturing_&]:overflow-hidden [.pdf-capturing_&]:min-h-fit`. No JS needed.

**`src/components/databoard/ExportBoardDialog.tsx → runExport()`**
- Replace the per-section "snapshot whole grid" branch with a single grouped step:
  - Build a set `wantedTypes` from enabled sections:
    - `charts` → `kpi`, `chart`, `insight`, `goal`, `table`, `activity`
    - `calendar` → `calendar`
    - `map` → `map`
  - If the set is non-empty, temporarily add the `pdf-capturing` class to the grid root, query `[data-pdf-section]` elements that match a wanted `data-widget-type`, snapshot **each one** with `htmlToImage.toPng`, fit it into the page width, and use the "smart page break" pattern (start a new page when the next image won't fit). Remove the class when done.
- This guarantees:
  - **No duplicates** — each widget is snapshotted at most once even if multiple sections are enabled.
  - **No scrollbars** — `pdf-capturing` class disables overflow during capture.
  - **No arbitrary slicing** — each widget fits cleanly on a page; pages break at widget boundaries.

### C. Small polish
- Add `aria-describedby={undefined}` is harmless — but include `<DialogDescription className="sr-only">…</DialogDescription>` to silence the console warning seen in logs.

---

## Files to Edit

1. `src/components/databoard/FiltersBar.tsx` — options built from jobs; "(empty)" support; remove unnecessary Supabase fetches.
2. `src/components/databoard/WidgetGrid.tsx` — add `data-pdf-section` / `data-widget-type` to each widget wrapper.
3. `src/components/databoard/WidgetCard.tsx` — add `[.pdf-capturing_&]:overflow-hidden [.pdf-capturing_&]:min-h-fit` to the body.
4. `src/components/databoard/ExportBoardDialog.tsx` — rewrite the snapshot branch to iterate per-widget, dedupe by enabled section→type set, smart page breaks, toggle `pdf-capturing` class. Add `DialogDescription`.

No DB migrations, no new packages, no schema changes. Pure client-side fixes.
