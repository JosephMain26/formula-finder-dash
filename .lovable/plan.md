## 1. Door Centers (new feature)

New table `door_centers` (admin-managed):
- `id`, `name`, `address`, `phone`, `contact_name`, `notes`, `sort_order`, timestamps
- RLS: authenticated read; admin/manager manage (same shape as `install_groups`).

New manager component `src/components/settings/DoorCentersManager.tsx`:
- List + add/edit/delete inline (name, address, phone, contact name, notes).
- Mounted as a new tab in `/settings` ("Door Centers").

## 2. Per-job pickup location

Add nullable column `pickup_door_center_id` (uuid) to `jobs`.

In `AddJobDialog`, add a "Pickup location" select inside the Installations panel (top of it, single per job). Loads `door_centers`, saves on submit.

## 3. Installer message variables

Extend `renderInstallVariables` / `buildJobVariables` and the variables sidebar with:
- `{{pickup_name}}` — door center name
- `{{pickup_address}}` — full address
- `{{pickup_phone}}` — contact phone
- `{{pickup_link}}` — `https://www.google.com/maps/search/?api=1&query=<urlencoded address>` (universal — opens in the installer's default maps app on mobile)

Recommended template snippet for installers:
```
Pickup: {{pickup_name}} — {{pickup_link}}
```
The name + link line gives the installer a tappable link that opens navigation to the address.

`SendMessageDialog` loads the job's pickup center alongside installations and feeds these into `renderTemplate`.

## 4. Catalog management entry point (no new code)

The "Installation Catalog" tab in `/settings` (built earlier with `InstallationCatalogManager`) already provides add/edit/delete for groups, sub-items, and models with colors. This plan only adds the Door Centers tab next to it; no extra catalog page is needed. If the previous turn's settings tab wiring is not yet present, this plan also wires up the Installation Catalog tab in `/settings` in the same edit.

## Technical notes

- Migration: 1 new table (`door_centers`) + 1 new column on `jobs`. No new server functions.
- Frontend: 1 new manager component, 2 small edits (`settings.tsx` tabs, `AddJobDialog.tsx` pickup select), and minor changes to `installCatalog.ts` + `SendMessageDialog.tsx` for the new variables.
- "Least credits": no new routes, no new server functions, reuse existing settings shell and existing job dialog.

## Validation

- Create 2 door centers in Settings → Door Centers tab.
- Open a job → choose a pickup location → save.
- Send installer message using `{{pickup_name}}` + `{{pickup_link}}` → preview shows clickable Google Maps link that opens directions in the installer's maps app.
- Sent message logged in `message_send_log` as before.
