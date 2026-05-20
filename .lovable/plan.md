## Plan

**1. Add time + time-range to the Create/Edit Job form (`AddJobDialog.tsx`)**

- Add `job_time` and `job_time_end` to `emptyForm` and to the edit-prefill block (line ~113).
- Render a small Time block right under the Date field (`job_date` core renderer at line ~409): a Start time input + a "Time range" Switch + a conditional End time input. When the toggle flips on with no end time, auto-suggest start + 2h (same UX as `RescheduleDialog`).
- Include `job_time` and `job_time_end` in the save payload (line ~279).

**2. Auto-set status to "Scheduled" when a job is scheduled**

Apply in three places, only when a date is set:
- `AddJobDialog` save: if `form.job_date` is set, write `status: "Scheduled"` instead of the current default (still respect explicit user changes — only override when status is the seeded default "Pending").
- `RescheduleDialog.save`: include `status: "Scheduled"` in the update.
- `schedule.tsx` `onDropToDay`: include `status: "Scheduled"` in the update.

Note: "Scheduled" is written as a plain string. If the user's Statuses list doesn't include it, the dropdown will still display the value but won't have a matching color/option until they add it in Settings → Statuses. I'll mention this once after shipping; no DB seeding to keep credits minimal.

**3. Files touched**
- `src/components/AddJobDialog.tsx` (form fields + payload + status logic)
- `src/components/schedule/RescheduleDialog.tsx` (status in update)
- `src/routes/schedule.tsx` (status in drag-drop update)

No migration needed — `job_time_end` already exists on `jobs`.