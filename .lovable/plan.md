## Tech Profit: Percentage or Fixed Amount

### Database
Add two columns to `jobs`:
- `tech_pay_mode` text default `'percent'` (allowed: `'percent'` | `'fixed'`)
- `tech_fixed_amount` numeric default `0`

No backfill needed — existing rows default to `'percent'`, preserving current behavior.

### Calculation change (`AddJobDialog.tsx` `handleSubmit`)

Today (percent mode, unchanged):
```
totalTech    = revenue * techPct + parts + tip
totalOffice  = revenue * (1 - marketerPct - techPct) + officeParts
totalMarketer= revenue * marketerPct + coParts
```

When `tech_pay_mode === 'fixed'`:
```
totalTech    = techFixed + parts + tip                 // tech gets a flat $ off revenue
totalOffice  = revenue - marketerShare - techFixed + officeParts
totalMarketer= revenue * marketerPct + coParts         // unchanged
```
Office is correctly reduced by the fixed tech amount. `manual_percentage` is still saved (for display continuity) but ignored by the math when mode is `fixed`.

### UI — `AddJobDialog` tech_percentage_panel

Replace the single % input with a compact toggle:
- Radio/segmented control: **% Percent** | **$ Fixed**
- Percent → existing `manual_percentage` input (now `step="0.001"`, allowing 3 decimals like `52.125`)
- Fixed → `tech_fixed_amount` input with `$` prefix, `step="0.01"`

Override checkbox still gates the whole panel for percent mode. Fixed mode is always an explicit override (auto-disables the "use tech default %" path while active).

### Other places to update for 3 decimals

- `JobsTable.tsx` Tech % cell: display `manual_percentage` to up to 3 decimals (trim trailing zeros), and the inline `EditableCell` for `manual_percentage` → `step="0.001"`.
- `BulkEditBar.tsx` `TechPercentInput` → `step="0.001"`.
- Show Tech Pay column hint: when `tech_pay_mode='fixed'`, render `$XX.XX` in the Tech % column instead of `—`/percent (small, low-effort).

### Files touched
- New migration adding the two columns.
- `src/components/AddJobDialog.tsx` (UI panel + math + form state).
- `src/components/JobsTable.tsx` (display + editable step).
- `src/components/BulkEditBar.tsx` (step).

No new dependencies. No backend functions. RLS unchanged.
