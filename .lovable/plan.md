
## 1. Send button + send history

- Add a "Send message" action on each row in `JobsTable` (icon button in actions column) that opens the existing `SendMessageDialog` for that job.
- Add the same "Send message" button inside `AddJobDialog` (footer, only when editing an existing job).
- The existing `message_send_log` table already records every send. Surface history:
  - New "Messages" tab inside `AddJobDialog` showing all rows from `message_send_log` for this job (recipient, channel, template, sent_at, status).
  - Small badge on the job row showing the count of sent messages, with a tooltip listing the last one.

## 2. Installation catalog (admin-managed in Settings)

New "Installation Catalog" tab in `/settings` with three nested editors. Backed by three new tables:

- `install_groups` — `id`, `name` (e.g. "Garage Door", "Opener", "Trims")
- `install_sub_items` — `id`, `group_id`, `name` (e.g. "Tracks", "Rollers", "Panels")
- `install_models` — `id`, `group_id`, `name` (e.g. "Lincoln 1000"), `colors` (text[])

RLS: everyone authenticated can read; admins/managers manage.

UI: pick a group on the left, edit its sub-items and models on the right, with a colors chip-list per model.

## 3. Per-job installations (multiple per job)

New table `job_installations`:
- `id`, `job_id`, `group_id`, `model_id` (nullable), `color` (text, nullable), `notes` (text)
- `sub_items` (jsonb) — array of `{ sub_item_id?, name, checked }` so admins can also add custom (per-job override) items not in the catalog.

UI: new "Installation" panel inside `AddJobDialog`:
- "Add installation" button → row with: Group select → Model select (filtered by group) → Color select (filtered by model's colors, free-text fallback) → checklist of that group's sub-items (auto-loaded, all checked by default, can uncheck) + "Add custom item" link.
- Multiple installations stack as collapsible cards.
- Saved alongside the job in the same submit.

RLS: same as `jobs` (any authenticated user can read/write rows tied to a job they can access).

## 4. Message variables for installations

Extend `buildJobVariables` and the variables sidebar with:
- `{{install_types}}` — comma-separated group names ("Garage Door, Opener")
- `{{install_models}}` — comma-separated "Group: Model" pairs
- `{{install_colors}}` — comma-separated colors
- `{{install_items}}` — bullet list of checked sub-items, grouped by installation:
  ```
  Garage Door (Lincoln 2000, White):
  - Tracks
  - Rollers
  Opener:
  - Rail
  ```
- Plus `{{install_count}}` for the number of installations.

`SendMessageDialog` loads `job_installations` (+ joins) when opened and feeds these into `renderTemplate`.

## Technical notes

- All work is frontend + migration + minor changes to `messageTemplates.ts`. No new server functions.
- Migration adds 4 tables (`install_groups`, `install_sub_items`, `install_models`, `job_installations`) with RLS.
- `JobsTable` actions column gets one new icon button; no other table changes.
- `AddJobDialog` gets one new tabbed/collapsible section for installations and one new tab for message history.
- Settings tab list grows by one: "Installation Catalog".

## Validation

- Create groups → sub-items → models → colors in Settings.
- On a job, add 2 installations (Garage Door + Opener), pick model + color, uncheck one sub-item → save.
- Click "Send message" from the job row → installer template using `{{install_items}}` renders the bullet list correctly with the unchecked item omitted.
- Send via WhatsApp and SMS → both appear in the job's "Messages" tab with timestamp, channel, status.
