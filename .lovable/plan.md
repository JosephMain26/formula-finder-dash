## Schedule & Reminders

A new `/schedule` page to view, reschedule, and control reminders for every job in one place.

### 1. Database (one migration)

Add to `jobs`:
- `job_time time` — scheduled time of day (nullable)
- `notify_enabled boolean default true` — master per-job toggle
- `notify_channels text[] default '{}'` — any of `in_app`, `email_tech`, `email_client`, `sms_tech`, `sms_client`
- `notify_lead_minutes integer default 60` — how far ahead to remind
- `notified_at timestamptz` — last reminder sent (prevents duplicates)

New table `notification_log` (job_id, channel, sent_at, status, error) for auditing + de-duping. RLS: authenticated read; insert via service role only.

### 2. Schedule page (`src/routes/schedule.tsx`)

Layout: left = month calendar, right = list of jobs for selected day (or upcoming if no day selected).

- Calendar reuses the existing `CalendarWidget` pattern with dots for job density.
- **Drag-to-reschedule**: drag a job from the list onto a different calendar day → updates `job_date` via Supabase.
- **Quick reschedule dialog**: click a job → date/time picker + reminder controls + Save.
- Filters bar at top: tech, status, company (mirrors dashboard filters, persisted via `userPrefs`).
- Time-of-day shown next to each job; sorted by `job_date, job_time`.
- Empty/loading states; mobile = stacked (calendar on top, list below).

### 3. Reminder controls (per job)

Inside the reschedule dialog and as a compact popover from each list row:
- Toggle: notifications on/off
- Checkboxes: in-app, email tech, email client, SMS tech, SMS client (channels only shown if contact info exists)
- Lead time select: 15m / 1h / 3h / 24h / custom

### 4. Notification delivery

- **In-app**: on app load, query upcoming jobs within their lead window and show a toast + badge on the nav item; mark seen in `localStorage`.
- **Email**: use existing Lovable Emails queue (`enqueue_email` RPC) with a new `job_reminder` template (tech variant + client variant).
- **SMS**: Twilio connector already linked (`TWILIO_API_KEY` present). Send via the gateway pattern.

### 5. Scheduled dispatcher

New public TanStack route `src/routes/api/public/hooks/dispatch-job-reminders.ts`:
- Selects jobs where `notify_enabled`, `job_date`+`job_time` is within now + max lead window, not yet `notified_at`.
- For each, sends the configured channels, writes `notification_log`, sets `notified_at`.
- Validates Supabase anon `apikey` header.

`pg_cron` job runs every 5 minutes calling that route.

### 6. Navigation

- Add a "Schedule" link with calendar icon to `MobileNav` and the desktop header (next to DataBoard).
- New `schedule.view` permission key (admins + technicians can view their own jobs).

### Files

New: `src/routes/schedule.tsx`, `src/components/schedule/ScheduleCalendar.tsx`, `src/components/schedule/JobReminderControls.tsx`, `src/components/schedule/RescheduleDialog.tsx`, `src/routes/api/public/hooks/dispatch-job-reminders.ts`, `src/lib/notifications.ts`.

Modified: `src/components/MobileNav.tsx`, `src/routes/index.tsx` (header link), `src/components/AddJobDialog.tsx` (add job_time field + reminder defaults), `src/lib/jobSchema.ts`.

DB: 1 migration (jobs columns + notification_log). 1 insert (pg_cron job).

### Notes

- Reuses existing email queue, Twilio connector, and userPrefs — no new secrets.
- Drag-to-reschedule uses native HTML5 DnD (no new dependency).
- SMS sending is opt-in per job; channels with no contact info are hidden so users can't accidentally enable them.
