## Schedule page improvements

### 1. Create / Edit / Delete jobs from Schedule

- Add a "New job" button in the Schedule header that opens the existing `AddJobDialog` pre-filled with the currently selected day (and no time). On save, refresh the list.
- In the day list, each job row gets two new icon buttons (next to the bell):
  - **Edit** — opens the existing `RescheduleDialog` (already wired to click). Keep the row-click behavior too.
  - **Delete** — opens an `AlertDialog` confirm; on confirm, `DELETE` the job row and refresh. Only shown to users with delete permission (admin/manager — matches existing RLS).
- No new dialog components; reuse `AddJobDialog` and `RescheduleDialog`.

### 2. Wider, more usable calendar

- Change the layout from `grid-cols-[auto,1fr]` to `grid-cols-1 lg:grid-cols-2` so the calendar takes ~half the width on desktop instead of the minimum needed.
- Bump cell size: pass `className="[--cell-size:3rem] w-full"` to `<Calendar>` and wrap in a container that lets it stretch (`w-full`).
- Keep the scheduled-day dot indicator. Mobile stays single column.

### 3. Multiple reminders per job

Replace the single "lead minutes" with an array of lead times so a job can ping e.g. 1 day before AND 1 hour before.

**Schema migration** (jobs table):
- Add `notify_lead_minutes_list integer[] not null default '{60}'`.
- Add `notified_lead_minutes integer[] not null default '{}'` (replaces single `notified_at` tracking; we keep `notified_at` column untouched to avoid breaking anything but stop using it).
- Backfill: `update jobs set notify_lead_minutes_list = array[notify_lead_minutes] where notify_lead_minutes is not null;`

**RescheduleDialog**: swap the single `<Select>` for a checkbox group of presets (15 min, 30 min, 1 h, 2 h, 1 day, 2 days) bound to `notify_lead_minutes_list`. Reset `notified_lead_minutes` to `[]` on save so reminders fire fresh for new timing.

**Dispatcher** (`src/routes/api/public/hooks/dispatch-job-reminders.ts`): for each job, iterate `notify_lead_minutes_list`; for any lead where `now >= job_datetime - lead` AND lead not in `notified_lead_minutes`, send the notifications and append the lead to `notified_lead_minutes`. Cron schedule unchanged.

### Files touched

- `supabase/migrations/...` — new columns + backfill
- `src/routes/schedule.tsx` — header "New job" button, list row edit/delete buttons, wider calendar grid
- `src/components/schedule/RescheduleDialog.tsx` — multi-lead checkboxes
- `src/lib/notifications.ts` — export `LEAD_PRESETS` already there; add type for list
- `src/routes/api/public/hooks/dispatch-job-reminders.ts` — multi-lead dispatch logic

No new dependencies, no new secrets.