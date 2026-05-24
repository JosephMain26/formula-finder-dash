## Goal
Fix the missing post-job client popup, then make the main app flows fully responsive on mobile so content no longer gets cut off.

## What I’ll change

### 1. Fix the missing “add client after job save” popup
- Repair the `AddJobDialog` flow so choosing **Client → Add new** reliably opens the follow-up client dialog after the job is created.
- Verify the parent job dialog and the secondary client dialog do not conflict with each other.
- Add the missing dialog accessibility description wiring while touching this flow, since the current dialogs are logging warnings.

### 2. Make the Add Job / Edit Job experience mobile-safe
- Convert the job form from a fixed 2-column layout to a mobile-first layout that stacks cleanly on phones and expands to multiple columns on larger screens.
- Fix the client section, custom fields section, time range controls, and action buttons so they wrap instead of overflowing.
- Ensure dialog width/height stays within the viewport with no clipped edges or unreachable fields.

### 3. Make the Schedule screen responsive without cut areas
- Rework the calendar + day-jobs layout so it uses space better on tablet/desktop and stacks cleanly on mobile.
- Tighten header/filter wrapping and card internals so action buttons, times, and metadata do not overflow.
- Check the reschedule dialog for the same mobile-safe behavior.

### 4. Make the main data-heavy screens degrade gracefully on phones
- Review and fix the highest-risk mobile overflow points on:
  - dashboard/home
  - jobs table area
  - clients
  - companies
  - technicians
  - installers
  - import/edit dialogs tied to those screens
- Keep large tables horizontally scrollable where necessary, but remove avoidable clipping and make surrounding controls/headers wrap correctly.

## Files I expect to touch
- `src/components/AddJobDialog.tsx`
- `src/components/schedule/RescheduleDialog.tsx`
- `src/routes/schedule.tsx`
- `src/components/JobsTable.tsx`
- `src/components/JobFilters.tsx`
- likely a small set of route/dialog files for clients/companies/technicians/installers where mobile overflow exists

## Technical details
- Root cause likely sits in nested dialog state handling inside `AddJobDialog` (`parentDialogVisible`, `showNewClientPopup`, and close/open sequencing).
- I’ll use the existing design system and keep changes surgical to minimize cost.
- I’ll prioritize responsive fixes in the app’s active operational flows first, rather than redesigning unrelated screens.
- After implementation, I’ll validate the affected screens in mobile-sized layouts and confirm the popup flow works end-to-end.