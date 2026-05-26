## Goal
Add a "Parts PO / Order PO" field to each installation entry inside the job form, save it on the job, and make it available as a message template variable when texting installers.

## Changes

### 1. Database migration
- Add `parts_po text` (nullable) column to the `job_installations` table.

### 2. `src/lib/installCatalog.ts`
- Add `parts_po: string | null` to the `JobInstallation` type.
- Include `parts_po` in the `saveJobInstallations` upsert row mapping.
- Update `renderInstallVariables` to:
  - Return `install_parts_pos` (comma-separated POs across all installations).
  - Append the PO value into each installation block under `install_items` so installers see it in the checklist output.

### 3. `src/components/JobInstallationsEditor.tsx`
- Add a free-text input labeled "Parts PO / Order PO" inside each installation card, placed near the existing Notes field.
- Wire it to `update(idx, { parts_po: value })`.

### 4. `src/lib/messageTemplates.ts`
- Add `{ key: "install_parts_pos", label: "Installation Parts POs" }` to `TEMPLATE_VARIABLES` so it appears in the template builder.

## Result
When creating/editing a job, each installation gets its own Parts PO field. When composing a message to an installer via Send Message, `{{install_parts_pos}}` renders the PO numbers, and `{{install_items}}` includes them in the per-installation checklist.