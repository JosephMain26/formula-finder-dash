## Goal
Allow setting a fixed $ amount (instead of %) for marketer, technician, and office on the job form. Fixed amounts apply to revenue net of parts (price − all parts − tip − cc fee if card). Tech keeps its existing add-on of parts + tip on top of the fixed amount.

## Changes

### 1. Database migration
Add to `jobs`:
- `marketer_pay_mode text not null default 'percent'` (`percent` | `fixed`)
- `marketer_fixed_amount numeric not null default 0`
- `office_pay_mode text not null default 'percent'` (`percent` | `fixed`)
- `office_fixed_amount numeric not null default 0`

(Tech already has `tech_pay_mode` / `tech_fixed_amount`.)

### 2. `src/components/AddJobDialog.tsx`
- Extend form state with `marketer_pay_mode`, `marketer_fixed_amount`, `office_pay_mode`, `office_fixed_amount` and hydrate them when editing.
- Add a percent/fixed toggle next to the existing marketer % input and add a new office row with the same toggle (mirroring the current tech UI in the Pay section).
- Update `completeSubmit` calculation so each of the three roles is independent:
  - `revenue = price − co_parts − office_parts − parts − tip − (card ? cc_fee : 0)`
  - `totalMarketer = (marketer fixed ? marketerFixed : revenue * marketerPct) + coParts`
  - `totalTech = (tech fixed ? techFixed : revenue * techPct) + parts + tip`  *(unchanged add-on)*
  - `totalOffice = (office fixed ? officeFixed : revenue * officePct) + officeParts`, where `officePct = max(0, 1 − marketerPct − techPct)` is only used when office is on percent.
- Persist the four new fields in the insert/update payload.

### 3. `src/components/BulkEditBar.tsx` (optional, small)
No change — bulk edit keeps current % field; fixed amounts are per-job only.

## Result
Each job lets you independently choose % or a fixed $ amount for marketer, tech, and office. Fixed amounts are applied to net revenue (parts already excluded), matching the request. Existing jobs continue to behave exactly as before because all new columns default to `percent` / `0`.