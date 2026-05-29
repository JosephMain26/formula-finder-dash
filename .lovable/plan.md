# Marketer-Collected Payments & Weekly Balance Reports

## Goal
Let you mark on each job whether the **marketer** received the customer's payment instead of the office/tech. When they did, the balance flips: the marketer is holding the full job price, so they owe us everything except their own earned share. Then produce a clear weekly balance report per marketer — viewable on-screen and downloadable as a PDF to send them.

## The balance math
For each **completed** job (matching how money is already counted across the app):

```text
marketer earned share   = total_marketer   (already stored per job)
full price collected     = price

If office/tech collected (default):
    we owe marketer = + total_marketer
If marketer collected:
    marketer owes us = total_marketer - price   (a negative number)
```

Weekly net for a marketer = sum of the per-job values above over the selected date range.
- **Positive total** → office owes the marketer.
- **Negative total** → marketer owes the office.

Deposits are intentionally excluded (per your choice). Only completed jobs contribute, so scheduled/pending jobs show $0 — same rule the dashboard already uses.

## What gets built

### 1. Database (one small migration)
- Add `marketer_collected boolean NOT NULL DEFAULT false` to `jobs`.
- No new RLS needed (existing job policies/grants cover it).

### 2. Mark the job (Add/Edit dialog only)
- Add a checkbox **"Marketer received the payment"** in `AddJobDialog.tsx`, placed near the Payment Method field.
- Wire it into `emptyForm`, the edit prefill, and the insert/update payload.
- Register it in `coreFields.ts` so it can be relabeled/hidden via the Job Form Builder (kept consistent with other fields).

### 3. Balance logic (new shared helper)
- New `src/lib/marketerBalance.ts` with a `jobMarketerBalance(job)` function implementing the math above and a `summarizeByMarketer(jobs, fromDate, toDate)` helper that groups completed jobs by marketer and returns net balance + supporting rows.

### 4. Weekly balance report (on-screen + PDF)
- New route `src/routes/balances.tsx` — "Marketer Balances" page:
  - Week range selector (reusing the existing date-range presets, defaulting to last Mon–Sun).
  - A table of marketers with: jobs count, total earned, amount marketer collected, and **net balance due** (color-coded "we owe" vs "they owe").
  - A **Download PDF** button per marketer that generates a clean statement (using the same `jsPDF`/`autoTable` approach as `ExportReportDialog.tsx`): header, week range, per-job line items (date, job type, price, marketer share, who collected), and the net balance line.
- Add a nav link to this page (alongside Settings/DataBoard in the dashboard header + `MobileNav`).

## Technical notes
- PDF generation stays client-side with the already-installed `jspdf` + `jspdf-autotable` (no new dependencies, no server calls — minimal cost).
- `marketerBalance.ts` reuses the existing `isCompleted` convention so totals match the rest of the app.
- No changes to how `total_marketer`/`total_office`/`total_tech` are computed — only a new flag and a new read-only report consume them.

## Out of scope
- Deposits in the balance (excluded per your choice).
- Bulk-marking from the table (per-job toggle only).
- Emailing the PDF automatically (you download and send it yourself).
