# Tech Report Templates + Payment Collection Defaults

Three connected additions: saved templates for technician reports, a settings screen for who is assumed to collect each job's payment, and an explicit "Office" choice on the job form.

## 1. Tech report templates

On the Tech Reports tab:

- A template bar with a dropdown of saved templates, plus **Save**, **Save as new**, **Rename**, **Delete**.
- Picking a template instantly applies it and refreshes the reports below.
- A template remembers: chosen technician (or "All technicians"), date range (preset or custom dates), selected job statuses, report title, which summary boxes to show (tech cut / owed to office / revenue) and which table columns to show (date, marketer, type, status, price, tech cut, office cut).
- The chosen title and visible boxes/columns carry into the PDF download and the emailed report.
- Column and box choices are edited in the settings card, so they can be tuned before saving a template.

## 2. Payment collection defaults (Settings)

New "Payment Collection" screen under Settings > Jobs:

- **Default collector** for every new job: Marketer, Office or Tech.
- **Per-marketer rules**: pick a marketer, pick their default collector. Add, edit and delete rows.
- **Per-technician rules**: same, per technician.
- Priority when a new job is created: marketer rule, then technician rule, then the global default.

## 3. Office as collector on the job form

The current "Collected by marketer" checkbox becomes a three-way choice: **Marketer / Office / Tech**. It is pre-filled from the rules above once a marketer or technician is chosen, and can still be changed per job. Additional payment rows keep their own recipient choice and are pre-filled the same way.

Balances keep working exactly as today: only amounts collected by the marketer count against a marketer's balance; Office and Tech behave as the current unchecked state.

## Technical notes

- `src/lib/settings.ts`: add `tech_report_templates` (list of `{id, name, spec}` where spec = tech, dateMode, dateFrom/To, statuses, title, boxes[], columns[]) and `payment_defaults` (`{default: "Marketer"|"Office"|"Tech", byMarketer: Record<string,Recipient>, byTech: Record<string,Recipient>}`) with load/save helpers on `app_settings`. No migration needed.
- `src/lib/techReport.ts`: extend `renderTechReportHtml` to accept title + visible boxes/columns; summary math unchanged.
- `src/components/TechReportsPanel.tsx`: template bar, title input, box/column toggles, apply-template state; PDF and HTML honour the visible sets.
- New `src/components/settings/PaymentDefaultsManager.tsx` + a `payment-defaults` entry in the Settings sidebar group "Jobs".
- `src/components/AddJobDialog.tsx`: replace the `marketer_collected` checkbox renderer with a Select writing `extra_fields.collected_by` and keeping `marketer_collected` in sync (true only for "Marketer") so existing balance logic and filters stay correct; prefill from `payment_defaults` on new jobs and default new payment rows to the resolved recipient.
- `src/lib/jobPayments.ts`: add a `resolveDefaultRecipient(settings, marketer, tech)` helper used by both the job form and payment rows.
