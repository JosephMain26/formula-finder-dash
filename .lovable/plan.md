# Plan

## What I’ll fix
1. Make the shared job form usable on mobile across every place it appears.
2. Restore the post-submit “Add Client” popup after saving a job.
3. Verify both flows in the preview so this does not regress again.

## Changes

### 1) Tighten the mobile layout in the shared add-job dialog
Update `src/components/AddJobDialog.tsx` so the form behaves properly on small screens:
- Stack cramped inline controls vertically on mobile instead of forcing them into one row.
- Make narrow fixed-width inputs expand to full width on small screens.
- Wrap the client-mode radio controls and footer actions cleanly.
- Keep two-column layout only from small/desktop breakpoints upward.
- Improve dialog sizing/spacing so fields are readable and tappable on phone widths.

This will fix the mobile issue everywhere the same dialog is used: dashboard, clients, schedule, databoard, and parse-message follow-up.

### 2) Fix the post-submit client popup flow
In `src/components/AddJobDialog.tsx`, repair the logic that opens the follow-up client dialog after creating a job with “Add new” selected.
- Remove the fragile open/close timing path that can fail when one dialog closes and another opens.
- Ensure the saved job ID and seeded client data are preserved before the parent dialog closes.
- Open the client popup in a deterministic way after submit success.
- Keep the job list refresh and client linking behavior intact.

### 3) Improve the remote/mobile submit form where needed
Update `src/routes/upload.tsx` only if needed for the phone layout issues that also appear there:
- Convert hard-coded two-column mobile grids to single-column on phones.
- Keep parse/review dialogs readable and scrollable on small screens.

## Validation
- Check the job form on the current mobile-sized preview.
- Confirm the “Add new” client flow opens the popup after saving a new job.
- Confirm the popup can save and link the client back to the created job.
- Check for any remaining dialog warnings relevant to this flow and clean up obvious accessibility issues if they are part of the same components.

## Technical notes
- Primary files: `src/components/AddJobDialog.tsx`, possibly `src/routes/upload.tsx`.
- No backend schema changes are needed.
- The fix stays scoped to the two issues you reported: mobile layout and missing popup.