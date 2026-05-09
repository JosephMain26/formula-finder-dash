## Goal

In the job edit dialog, allow linking a brand-new client (not yet in the system) directly from the "Linked Client" section — without leaving the job dialog.

## Current State

- **New job mode** already supports three client modes: `skip` / `link existing` / `new` (with a popup to fill details after saving).
- **Edit mode** (`AddJobDialog.tsx`, ~lines 702–740) only has a Select dropdown of existing clients + a "View Client" link. There is no way to create a new client if it doesn't exist.

## Change

### `src/components/AddJobDialog.tsx` — Edit mode "Linked Client" section

Add a small **"+ New"** button next to the existing Select dropdown. Clicking it opens the existing `showNewClientPopup` dialog (already built into this file) prefilled with the job's phone / address.

On save in that popup:
- Insert into `clients` table (reuses existing insert logic).
- Set `form.client_id` to the new client's id.
- Update the job row with `client_id` so the link persists immediately.
- Refresh the local `clients` list so the new entry shows in the Select.
- Toast success.

No new component, no schema change — reuses the popup, query, and insert path that already exist for the "new" mode in create flow.

### Files Touched

- `src/components/AddJobDialog.tsx` — add "+ New" button in edit-mode Linked Client row; extend the popup save handler to also work in edit mode (link to current job).

No database changes.