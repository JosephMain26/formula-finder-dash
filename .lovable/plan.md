## Why the form still shows 2 columns on the user's phone

The form root and inner grids use `sm:grid-cols-2`. The `sm` breakpoint kicks in at **640px**, which on the user's device (Chrome Android, likely in "Desktop site" mode or a wide-CSS-pixel phone like the screenshot they sent) is below the viewport width. Result: Job Date + Marketer, Technician + PO, Phone + Address, Status + Price etc. all squeeze into two tiny columns and labels/values overlap.

## Fix (single file: `src/components/AddJobDialog.tsx`)

Push the 2-column layout up to the `md` breakpoint (**768px**), so phones — including desktop-site mode — always get one field per row. Tablets and desktops are unaffected.

1. **Form root grid (line 454)** — `grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4` → `grid-cols-1 md:grid-cols-2 gap-3 md:gap-4`.
2. **All `col-span-2` children** (lines 521, 557, 810, 816, 827, 887, 944, 1005, 1019, 1046) → `md:col-span-2`. In a 1-col grid `col-span-2` is harmless but `md:col-span-2` makes intent explicit and avoids edge cases.
3. **Inner deposit grid (line 838)** — `sm:grid-cols-2` → `md:grid-cols-2`.
4. **Inner installation-systems grid (line 1007)** — `sm:grid-cols-2` → `md:grid-cols-2`.
5. **Override-panel inner rows** (tech + marketer, lines ~530 and ~566): change `sm:flex-row sm:items-center` → `md:flex-row md:items-center` so the mode toggle + amount input stack vertically on phones too.
6. **Footer (line 1046)** — `sm:flex-row sm:justify-end` → `md:flex-row md:justify-end` so Cancel/Save stack on phones.
7. **DatePickerField & Inputs** — verify each renders `w-full` inside its grid cell; add `w-full` to the time inputs if missing so they fill the column.

No logic, state, schema, or other components change. Only Tailwind class names in `AddJobDialog.tsx`.

## Validation

Open Add Job on the user's phone (or desktop-site-mode browser at ~700–1000px CSS width): every field full-width, labels above inputs not overlapping, time/range toggle readable, override panels and deposit grid stack cleanly, footer buttons stack. At ≥768px the dialog looks unchanged from current desktop view.

## Out of scope

`JobInstallationsEditor` internal grids, validation rules, server functions, schema.
