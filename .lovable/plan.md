# Scheduled-installation flow

Goal: a single status drives the whole "got the job → send to installer → completed → counted as revenue" flow, reusing the fields and UI we already built (installer, date/time window, pickup location, deposit, send-message dialog).

## 1. New status

Seed `"Scheduled installation"` (color: purple) into `app_settings.job_statuses` so it shows up in the status dropdown, filters, and badges automatically. Existing `StatusesManager` lets the user rename/recolor it later.

## 2. Database

Add 2 nullable columns to `jobs` for deposit payment details (deposit amount/date/received already exist):
- `deposit_payment_method text`
- `deposit_check_no text`

No other schema changes — `installer_id`, `job_time` / `job_time_end` (2-hour window), `pickup_door_center_id`, `client_id`, `deposit_received`, `deposit_amount`, `deposit_date` all already exist.

## 3. AddJobDialog — conditional UI when status = "Scheduled installation"

In `src/components/AddJobDialog.tsx` (no new components needed):

- **Always-visible block when this status is selected** (regardless of core-field visibility settings):
  - Installer select + installer-name fallback
  - Date + Start time + End time (default end = start + 2h on first pick)
  - Pickup location select (door centers)
  - Installations editor (already in the dialog)
- **Deposit panel** (checkbox "Paid deposit"):
  - When checked: amount, date (DatePickerField), payment method (reuse `paymentMethods`), and if method is Check → check number input
- **Client requirement**: on submit, if `status === "Scheduled installation"` and neither `client_id` is set nor a non-empty client name is provided (link existing OR create new with name), block the save with a toast: "Client name is required for door installation jobs." This only gates this status; other statuses are unchanged.
- **Send-to-installer button**: the existing `SendMessageDialog` button stays in the footer; user can hit it once the job is saved.

## 4. Revenue rule — only count completed jobs

In `src/lib/databoard/metrics.ts`, gate revenue/profit/avg-ticket helpers so non-completed jobs return 0:

```ts
revenue: (j) => isCompleted(j) ? num(j.price) : 0,
profit:  (j) => isCompleted(j) ? num(j.total_office) : 0,
techPay: (j) => isCompleted(j) ? num(j.total_tech) : 0,
marketerPay: (j) => isCompleted(j) ? num(j.total_marketer) : 0,
```

Deposit columns are already separate from `price`, so they were never in revenue — no extra exclusion needed. Scheduled-installation jobs will show up in pipeline/count widgets but contribute $0 to revenue/profit until status flips to Completed. This makes the existing "Completed only" KPI toggle effectively the default everywhere.

## 5. Files touched

- migration: add 2 columns + seed status row in `app_settings`
- `src/components/AddJobDialog.tsx`: form state for `deposit_payment_method` / `deposit_check_no`, conditional block, client-required guard, payload mapping
- `src/lib/databoard/metrics.ts`: gate money metrics by `isCompleted`
- `src/lib/messageTemplates.ts` (tiny): expose `{{deposit_amount}}` / `{{deposit_method}}` for installer messages (optional, only if you want them in the SMS)

No new routes, no new server functions, no new components — least credits.

## 6. Validation

1. Add a job, pick status "Scheduled installation" with no client → save blocked with toast.
2. Add client + installer + date + 8:00 start (end auto-fills 10:00) + pickup center → save succeeds.
3. Tick "Paid deposit" → enter $200, today's date, method Check, check #1234 → saved.
4. Open job in DataBoard → revenue KPI shows $0; pipeline count includes the job.
5. Flip status to Completed → revenue KPI now includes the job's price; deposit amount is not double-counted.
6. Hit "Send" → installer SMS preview includes pickup link, installations, date/time window.