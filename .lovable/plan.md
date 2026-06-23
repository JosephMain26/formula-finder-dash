# Multiple payments per job

Let jobs record several payments instead of one. Each payment captures **amount**, **who received it** (Marketer / Office / Tech), **payment method**, and — when the method is a check — a **check number** plus **front/back photos**. The existing single payment fields stay as-is; the new list is added below them. Marketer-collected payments feed into the balances math.

## Where data lives (no new table)

Payments are stored as a JSON array on the job record, inside the existing `extra_fields` JSON column (`extra_fields.payments`). No database migration, no new access rules — fastest and lowest-credit path. Check photos reuse the existing private `check-photos` storage bucket and the current `CheckPhotoField` uploader.

Each payment entry:

```text
{
  id, amount, recipient ("Marketer" | "Office" | "Tech"),
  method, check_no, check_front_url, check_back_url, date
}
```

## 1. Job dialog — new "Payments" section

In `src/components/AddJobDialog.tsx`, below the current Payment Method / check / "Marketer received the payment" fields, add an **Additional payments** block:

- "Add payment" button appends a row.
- Each row: amount input, recipient dropdown (Marketer / Office / Tech), method dropdown (same `paymentMethods` list as the main field), and a remove (trash) button.
- When the chosen method contains "check", the row reveals a check-number input and two `CheckPhotoField` uploaders (front/back), exactly like the existing check UI.
- The array is seeded from `job.extra_fields.payments` when editing, empty when adding.
- On save, the payments array is written into the `extra_fields` payload (alongside the existing `check_front_url` / `check_back_url` handling) so nothing else in the form changes.

Recipient options are fixed to Marketer / Office / Tech per the request.

## 2. Feed marketer-collected payments into balances

In `src/lib/marketerBalance.ts`, generalize "collected by marketer":

- Today: if `marketer_collected` is true, the marketer is treated as holding the **full price**, so `net = total_marketer - price`.
- New: compute `collectedByMarketer` = sum of `extra_fields.payments` amounts where `recipient === "Marketer"`. Then `net = total_marketer - collectedByMarketer`.
- **Backward compatible:** if a job has no payments array, fall back to the current behavior (`marketer_collected ? price : 0`). So existing jobs and the existing checkbox keep working unchanged.

This flows automatically into `summarizeByMarketer`, the Balances table ("Collected by marketer" column and Net balance), and the PDF statement, since they all read from the same summary.

Office- and Tech-recipient payments are recorded on the job for reference. (The app currently only has a *marketer* balances view, so those amounts are stored but don't change any existing payout screen — there's no tech/office balance page to feed today.)

## Technical notes

- `extra_fields` is already a JSON column read/written by the dialog, so no migration tool call is needed.
- Money math stays in `marketerBalance.ts`; `computeJobTotals` (job totals) is untouched — totals already come from price/percentages, and payments only affect who-holds-the-cash (the balance), not earnings.
- Validation: amounts parsed as numbers, blank rows ignored on save; check photo requirement mirrors the existing check rule.

## Files touched

- `src/components/AddJobDialog.tsx` — payments state, UI section, save payload.
- `src/lib/marketerBalance.ts` — `collectedByMarketer` from payments with fallback.

No backend, schema, or access-rule changes.