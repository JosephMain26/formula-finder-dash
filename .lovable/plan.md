## Goal

Add a dedicated **Reports** page (the quick "Export PDF" dialog stays as-is) that gives you:
1. A drag-and-drop report builder with finer control than the dialog.
2. Individual on/off switches for each total (Revenue, Tech, Office, Marketer) — so you can hide "Total Office" alone.
3. An optional **Balance summary** section (per-marketer net balance, reusing the existing balances math).
4. An **Automation Center** to schedule reports: set the cycle (when), pick recipients (manager/marketer/other roles, specific marketers, and/or custom emails), and choose what the report shows. Scheduled reports are emailed automatically using the existing email system.

Keep it lean to minimize credits: reuse existing template storage, the existing email queue, and one shared report-building module for both the PDF (client) and the emailed HTML (server).

## What gets built

### 1. Shared report spec + builder (`src/lib/reportSpec.ts`)
- A single `ReportSpec` type: ordered sections, enabled flags, selected columns, **per-total toggles** (`revenue/tech/office/marketer`), `includeBalance`, marketer filter, and a date-range mode (custom or relative like "last week"/"this month").
- Pure helpers `computeReportData(jobs, spec)` → `{ totals, balanceSummaries, tableRows, rangeText }`, reusing `summarizeByMarketer` from `marketerBalance.ts` and the existing `fmt`/column logic. Used by both the page (PDF) and the server route (HTML email), so the math lives in one place.

### 2. Reports page (`src/routes/reports.tsx`)
- Drag-and-drop section ordering (same `@dnd-kit` setup the dialog already uses). Sections: Title, Date Range, **Totals** (expands to 4 individual total checkboxes), **Balance summary**, Jobs Table.
- Field/column picker, marketer filter, date-range presets — mirroring the dialog but on a full page.
- "Generate PDF" using `jsPDF`/`autoTable` (no new deps).
- Save/load named templates via the existing `templates` setting (the `ExportTemplate` type gets new optional fields: `totals`, `includeBalance`, `dateMode` — backward compatible, the dialog ignores them).
- Add nav links to `/reports` in `src/routes/index.tsx` header and `src/components/MobileNav.tsx` (next to the existing Balances link).

### 3. Automation Center (on the same Reports page, second tab)
- List + create/edit/delete report automations, each with:
  - **Name** and enabled toggle.
  - **What to show**: pick a saved report template.
  - **When (cycle)**: Daily / Weekly (weekday) / Monthly (day-of-month) + time-of-day.
  - **To who**: any combination of roles (admin/manager/marketer/etc.), specific marketers (from companies), and custom email addresses. Optional "send each marketer their own filtered report" toggle.
- Stored in a new `report_automations` table.

### 4. Backend — schedule + delivery
- New table `report_automations` (migration). Admins/managers manage; cron reads it server-side.
- New server route `src/routes/api/public/hooks/dispatch-report-automations.ts` (same `apikey`-header auth pattern as `dispatch-job-reminders`). It:
  1. Loads enabled automations, determines which are **due** (based on cycle + `last_run_at`).
  2. Pulls jobs, runs `computeReportData`, renders an inline **HTML** report (totals + optional balance + table) — no PDF attachment, to keep it light.
  3. Resolves recipients: roles → `user_roles` joined to `profiles.email`; marketers → `companies.email`; plus custom emails.
  4. Sends via the existing `enqueue_email` RPC (`transactional_emails` queue), logs to `notification_log`, and stamps `last_run_at`.
- A `pg_cron` job (inserted via the insert tool, not a migration, since it carries the project URL + anon key) calls this route every 15 minutes.

## Data model

```text
report_automations
  id            uuid pk
  name          text
  enabled       boolean default true
  template      jsonb     -- a ReportSpec snapshot (what to show)
  schedule      jsonb     -- { freq: 'daily'|'weekly'|'monthly', weekday, monthDay, time }
  recipients    jsonb     -- { roles: [], marketers: [], emails: [], perMarketer: bool }
  last_run_at   timestamptz
  created_by    uuid
  created_at / updated_at timestamptz
```
RLS: select/insert/update/delete for admins & managers; full access to service_role (cron). GRANTs for authenticated + service_role.

## Out of scope
- PDF attachments in automated emails (inline HTML only — cheaper and Worker-safe). The on-page builder still produces downloadable PDFs.
- Editing the existing Export PDF dialog (left untouched).
- New totals beyond the four you selected.

## Technical notes
- No new npm packages: reuses `jspdf`, `jspdf-autotable`, `@dnd-kit`, and the existing email queue.
- Cron auth uses the existing `apikey` header + `SUPABASE_ANON_KEY` check (same as the reminders hook) — no new secret.
- One migration (create table) + one data insert (cron schedule). The migration runs first and needs your approval before I write code.
