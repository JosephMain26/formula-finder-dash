## Goal

Add a one-click "Import Clients" flow on the Clients page that accepts a spreadsheet exported from any CRM (CSV or Excel), auto-detects which columns map to client fields, lets the user confirm/adjust, and bulk-inserts into the `clients` table.

## Flow

1. **Clients page header** → new **"Import"** button next to "Add Client".
2. Clicking opens an **Import dialog** with three steps:
   - **Step 1 — Upload**: drop / pick a `.csv`, `.xlsx`, or `.xls` file. Parsed in-browser.
   - **Step 2 — Map fields**: shows detected source columns on the left, target client fields on the right (`name`, `phone`, `email`, `address`, `notes`). Auto-suggested mapping is prefilled from header heuristics (see below). User can change any mapping or set "Ignore". Preview table shows first 5 rows with the chosen mapping.
   - **Step 3 — Import**: insert rows into `clients` in batches. Skip rows with empty `name`. Detect duplicates by phone (DB has `clients_phone_unique`) — show count of skipped duplicates. Toast summary: "Imported X, skipped Y duplicates, Z errors".

## Auto-mapping (heuristic, no AI = no credits)

Lowercase + strip non-alphanumerics on each source header, then match against keyword sets:

- **name** ← `name`, `fullname`, `clientname`, `customername`, `contact`, `contactname`, `firstname`+`lastname` (concatenate)
- **phone** ← `phone`, `phonenumber`, `mobile`, `cell`, `tel`, `telephone`, `phone1`
- **email** ← `email`, `emailaddress`, `mail`, `e-mail`
- **address** ← `address`, `street`, `streetaddress`, `addr`, `location`, `address1` (+ optionally append `city`, `state`, `zip` if present)
- **notes** ← `notes`, `note`, `comments`, `description`, `remarks`

Anything not matched defaults to "Ignore" but is selectable in the dropdown.

## Files Touched

- `src/routes/clients.tsx` — add "Import" button + render new dialog.
- `src/components/ImportClientsDialog.tsx` — new component (upload, parse, map, preview, insert).
- `package.json` — add `papaparse` (CSV) and `xlsx` (Excel) via `bun add`.

## Technical Notes

- Parsing runs **client-side** (no edge function, no AI) → zero credit cost beyond the small DB inserts.
- Inserts use existing `clients` insert RLS policy (`Authenticated insert clients`) — no schema or policy changes needed.
- Batches of ~200 rows per `.insert([...])` call to stay safe.
- Duplicate phone errors caught per-batch; on conflict the batch is retried row-by-row so one bad row doesn't lose the rest.

No database changes. No backend changes.
