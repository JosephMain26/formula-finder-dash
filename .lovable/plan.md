# Technician Reports

Add a "Tech Reports" tab on the Reports page so you can produce a per-technician statement showing what the tech earns and what they owe the office, download it as PDF, or email it to the tech.

## What you'll get

A new tab next to Report Builder / Marketer Balances / Parts Charges:

- Pick one technician, or "All technicians" to get a separate report per tech.
- Pick a date range (same presets you already use: today, this week, last week, this month, custom dates).
- Optional job-status filter (defaults to Completed only, since money only counts on completed jobs).

For each technician the report shows:

- Header: tech name, date range, number of jobs.
- Summary boxes:
  - Tech cut — the tech's earnings for the period.
  - Office cut (owed to office) — marketer share + office share combined; this is what the tech turns in at week's end.
  - Total revenue for reference.
- Jobs table: date, marketer, job type, status, price, tech cut, office cut per job.

Actions per report:

- Download PDF — same look and feel as your existing report PDFs.
- Email to technician — sends the report in the email body to the email on the tech's linked login account. If a tech has no linked account, the button is disabled with a short note, and you can type an address instead.

## Automation

The Automation Center gets a "Technician reports" option so the same statement can be scheduled (for example every Sunday 11 PM in your timezone), with a per-technician mode that mirrors the existing per-marketer behavior. Manual use works without setting up any automation.

## Note on PDF by email

Emails will carry the report formatted in the message body; PDF file attachments aren't supported by the current email setup. Attachment support is left as a separate future task.

## Technical outline

- `src/lib/techReport.ts` (new): pure calculation + HTML rendering, no React, so both the browser and the scheduled server route can use it.
  - Per job (completed only, reusing `isCompleted` from `src/lib/databoard/metrics.ts`): tech cut = `total_tech`; office cut = `total_marketer` + `total_office`; revenue = `price`.
  - `summarizeByTech(jobs, { from, to, statuses, techNames })` groups by `jobs.tech_name`, returns totals + rows.
  - `renderTechReportHtml(summary)` for email bodies.
- `src/components/TechReportsPanel.tsx` (new): tab UI, loads `technicians` joined to `profiles.email` via `technicians.user_id`, date range via existing `DatePickerField`, jsPDF + jspdf-autotable for download (same pattern as `pdfFromSpec` in `src/routes/reports.tsx`), and `sendAutomationEmail` from `src/lib/automationEmail.functions.ts` for sending.
- `src/routes/reports.tsx`: add the tab trigger/content; no changes to existing tabs.
- `src/lib/reportAutomations.ts` + `src/routes/api/public/hooks/dispatch-report-automations.ts`: add an automation `kind: "tech"` (default `"jobs"` for existing rows) that builds tech summaries and emails them, reusing the existing due-time/timezone logic and `enqueue_email`.
- No database migration needed.
