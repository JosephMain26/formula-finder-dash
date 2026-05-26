
## Goal
Make the Add/Edit Job dialog comfortable to use on phones (≤640px). No logic changes, no new features — just layout/visibility fixes.

## Issues found in `src/components/AddJobDialog.tsx`

1. **Dialog padding & width** — `p-4 sm:p-6` + `w-[calc(100vw-1rem)]` leaves only ~340px of content; long Select values get clipped and labels feel cramped.
2. **Time row** — uses fixed `grid-cols-2 gap-2` (not responsive). The right cell holds the "Time range" label + Switch and gets squeezed next to the time input.
3. **Tech / Marketer override panels** — `flex flex-wrap` with the % toggle + input on one line wraps awkwardly; the "Using tech default %" hint sits on the same row as the checkbox and overflows.
4. **Linked Client row (edit mode)** — Select + "+ New" + "View" use `flex-wrap` with a `min-w-[10rem]` select; on a 360px viewport the button drops to its own line with weird gaps.
5. **Pickup location + Installations header** — fine, but the inner Installation editor cards use `grid-cols-1 sm:grid-cols-3` which is OK; just the Select triggers need `truncate` so long door-center names don't break the row.
6. **Deposit panel** — already `grid-cols-1 sm:grid-cols-2`, fine, but the "Paid deposit" checkbox + heading spacing is tight.
7. **Footer buttons** — already stack correctly; no change.

## Changes (single file: `src/components/AddJobDialog.tsx`)

1. **DialogContent**: change to `w-[calc(100vw-0.5rem)] sm:w-[calc(100%-2rem)] p-3 sm:p-6 max-h-[92vh]` and add `gap-3` cleanup. Gives ~8px extra usable width on mobile.
2. **Time row (line 472)**: replace `grid grid-cols-2 gap-2` with a stacked layout on mobile:
   - Row 1: Time input (full width) with the "Time range" Switch absolutely aligned to the label, e.g. `flex items-center justify-between` for the label row, then full-width input below.
   - End time stays full width below when toggled on.
3. **Override panels (tech & marketer)**:
   - Move the "Using … default %" hint to a new line under the checkbox (`block text-xs` instead of inline `sm:ml-auto`).
   - When override is on, stack the mode toggle and input vertically on mobile: wrap them in `flex flex-col sm:flex-row sm:items-center gap-2`.
4. **Linked Client row (edit mode)**: change to `flex flex-col sm:flex-row gap-2` so the Select takes full width on mobile and the "+ New" / "View" actions sit in their own row beneath.
5. **Select triggers with long values**: add `truncate` and `min-w-0` to the SelectTrigger/SelectValue for company, technician, installer, pickup location, payment, client selects, so options don't push width past the column.
6. **Deposit panel header**: tighten to `p-3 space-y-2` and put the section title on the same line as the "Paid deposit" checkbox row spacing-wise; keep current grid.
7. **Optional micro-fix**: form root `gap-3 sm:gap-4` is fine — leave alone.

## Out of scope
- No changes to validation, state, server functions, schema, or any other component.
- No redesign of `JobInstallationsEditor` beyond `truncate` on its Select triggers (separate file, 1-line patches).

## Validation
- Open Add Job dialog at 360–414px width: every field full-width, no horizontal scroll, no clipped labels, time + range toggle readable, override panels stack cleanly, footer buttons stacked.
- At ≥640px the layout is unchanged from today.

Files touched: `src/components/AddJobDialog.tsx` (+ optionally 1-line `truncate` adds in `JobInstallationsEditor.tsx`).
