
## Goal

Make the connection between jobs and clients visible and navigable from both sides:
- **From a client** → see linked jobs and click to open (already done)
- **From a job** → see linked client name and click to open client details (missing)

## Changes

### 1. Job Dialog — Clickable Client Link (`src/components/AddJobDialog.tsx`)

In edit mode, next to the "Linked Client" dropdown, show the linked client's name as a clickable link/button. Clicking it navigates to `/clients` (or opens the client detail in-place if feasible). This gives a quick way to jump from a job to its client record.

Simple approach: add a small "View" button next to the client select that links to `/clients` with a highlight/search param for the linked client.

### 2. Jobs Table — Client Name Column (`src/components/JobsTable.tsx`)

- Fetch client names for jobs that have a `client_id` (single query joining on loaded jobs).
- Show a "Client" column (togglable via ColumnToggle) displaying the client name.
- Clicking the client name navigates to `/clients`.

### 3. Column Toggle — Add "Client" option (`src/components/ColumnToggle.tsx`)

Add `"client"` to the available column keys so users can show/hide the client column.

### Files Touched

- `src/components/AddJobDialog.tsx` — add clickable client link button in edit mode
- `src/components/JobsTable.tsx` — fetch + display client name column, link to clients page
- `src/components/ColumnToggle.tsx` — add "client" column key

No database changes needed.
