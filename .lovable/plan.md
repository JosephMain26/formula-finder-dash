## Goal

Let you record flat fees you charge companies/marketers for parts you buy on their behalf (not jobs). Each charge means **the company owes the office**, so it reduces that marketer's net balance. The charges show up both in the **Marketer Balances** view and in **Reports** (on-screen, PDF, and scheduled email).

## How it behaves

- A charge has: marketer/company name, amount, date, and an optional note.
- In balances, net stays "positive = office owes marketer". A parts charge subtracts from that net (since the marketer now owes the office for parts).
- A marketer who has only parts charges (no jobs) still appears in the balances list.
- You add/edit/delete charges directly on the Reports & Balances page.

## Data

New table `parts_charges`:
- `marketer` (text — matches the company/marketer name used in jobs)
- `amount` (numeric)
- `charge_date` (date)
- `description` (text, optional)
- standard `id`, `created_at`, `updated_at`

RLS mirrors how jobs/companies are handled: authenticated users can view and create; admins/managers can edit/delete. Includes the required GRANTs and an `updated_at` trigger.

## UI / logic changes

```text
Reports & Balances page
 ├─ Marketer Balances tab
 │   ├─ NEW "Parts Charges" card: list + add/edit/delete (name, amount, date, note)
 │   └─ Balances table: net now includes parts charges; new "Parts charged" column
 └─ Report Builder tab
     └─ NEW optional "Parts Charges" section (line-item list + total) in preview, PDF, email
```

### Files

1. **Migration** — create `parts_charges` with grants, RLS policies, and update trigger.

2. **`src/lib/partsCharges.ts`** (new) — `PartsCharge` type, `loadPartsCharges()`, `upsertPartsCharge()`, `deletePartsCharge()`, and a date-range filter helper. Pure-data helper so it can also be imported by the report layer.

3. **`src/lib/marketerBalance.ts`** — extend `summarizeByMarketer` to accept an optional `partsCharges` array. Add `totalPartsCharges` to each summary, subtract it from `net`, and create summary rows for marketers that only have charges. Keeps existing job logic untouched.

4. **`src/components/BalancesPanel.tsx`** — load parts charges; add a "Parts Charges" management card (add/edit/delete dialog reusing existing Dialog/Input/DatePickerField); pass charges into `summarizeByMarketer`; add a "Parts charged" column and include charges in the per-marketer PDF statement.

5. **`src/lib/reportSpec.ts`** — add `"partsCharges"` to `ReportSectionId` + label; thread an optional `partsCharges` argument through `computeReportData` (fold into balance net like above, expose a charges list + total in `ReportData`); render the new section in `renderReportHtml`.

6. **`src/routes/reports.tsx`** — load parts charges alongside jobs; pass them into `computeReportData` and the PDF generator; render the new section in the on-screen preview and add its toggle in the Sections list.

7. **`src/routes/api/public/hooks/dispatch-report-automations.ts`** — fetch `parts_charges` once and pass into `computeReportData`/`renderReportHtml` so scheduled emails include them.

## Notes

- Charges are matched to marketers by name (same string already used for jobs via `company_1`/`company`), consistent with how balances group today.
- No changes to job calculations or existing report templates; the new section defaults to off so saved templates are unaffected.
