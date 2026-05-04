
## Changes

### 1. Client Dialog — Show Linked Jobs

In `src/routes/clients.tsx`, update the `ClientDialog` component:

- When editing a client (dialog opens), fetch jobs where `client_id = client.id` from the `jobs` table.
- Display a "Linked Jobs" section below the form fields showing a compact list (date, address, status, price).
- Each job row is clickable and opens the `JobDialog` in edit mode for that job (reuse existing `JobDialog` component).

### 2. Job Form — Three-Option Client Flow

In `src/components/AddJobDialog.tsx`, replace the current client picker with a radio group (only for non-tech users):

- **Link existing client** — shows the current Select dropdown to pick from saved clients.
- **Add new client** — no picker shown; after job submit, a small popup opens to let the user fill in client details (name, phone, email, address, notes) and save. The phone/address from the job form are pre-filled.
- **Skip** — no client linked (default).

This replaces the current auto-save-by-phone logic with explicit user choice.

### 3. Post-Submit Client Edit Popup

In `src/components/AddJobDialog.tsx`:

- After successful job submission, if the user chose "Add new client", show a small `Dialog` pre-filled with phone and address from the job form.
- On save, insert into `clients` table and update the just-created job's `client_id`.
- On skip/close, do nothing.

### Files Touched

- `src/routes/clients.tsx` — add linked jobs query + display + JobDialog import
- `src/components/AddJobDialog.tsx` — radio group for client mode, post-submit client popup

No database changes needed. No new dependencies.
