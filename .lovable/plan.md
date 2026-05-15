## Problem

After submitting a new job with "New client" mode selected, the follow-up "Save Client Details" popup does not appear on mobile devices. On desktop it works because the dialog open/close timing is more forgiving.

Root cause in `src/components/AddJobDialog.tsx` (lines 329–344): when the job save succeeds we call `setOpen(false)` (closes the parent Add Job dialog) and then synchronously `setShowNewClientPopup(true)` in the same tick. Radix Dialog applies a body scroll/pointer-events lock on close that, on mobile, is still active when the second dialog tries to mount — so the second dialog either never gets focus/pointer events or its overlay is suppressed. The second `DialogContent` is also missing a mobile-safe width.

## Fix (frontend only, single file)

Edit `src/components/AddJobDialog.tsx`:

1. **Defer opening the new-client popup until the parent dialog has finished closing.** In the success branch (around line 333), replace the synchronous `setShowNewClientPopup(true)` with a short `setTimeout(..., 250)` after `setOpen(false)`. This lets Radix release its body lock on the parent dialog before the child dialog mounts. Set `setSavedJobId` and `setNewClientForm` outside the timeout (state can be prepared early); only the visibility flag is delayed.

2. **Make the new-client popup mobile-safe.** On the `<DialogContent className="max-w-sm">` for the new-client popup (line 825), add `w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto` so it fits inside phone viewports with safe margins and scrolls if the keyboard pushes content.

3. **Make the parent Add Job dialog mobile-safe** while we're in this file (line 355): add `w-[calc(100%-2rem)]` to the existing `max-w-2xl max-h-[85vh] overflow-y-auto` so the parent dialog also respects phone margins (prevents the parent from clipping behind the screen edge, which can also contribute to perceived "popup not appearing").

## Out of scope

- No DB, RLS, auth, or business-logic changes.
- No changes to other dialogs or the rest of the form layout.
- The "New client" submission flow itself (insert into `clients`, link `client_id` on the job) is unchanged.

## Verification

- Open the preview on mobile viewport, add a job with client mode = "New", submit, and confirm the "Save Client Details" popup appears, is fully visible, and submits/links the client to the saved job.
- Repeat on desktop to confirm no regression.
