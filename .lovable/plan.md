## Goal
Make colors global (not per-model), add a System type (Extension/Torsion) per installation, and add a manageable Sizes catalog (height × width) selectable per installation.

## 1. Database changes (single migration)

- New table `install_colors` — global color list: `name` (unique), `sort_order`. RLS: admin/manager manage, authenticated view (same pattern as `install_groups`).
- New table `install_sizes` — global size list: `width` (text, e.g. `16'`), `height` (text, e.g. `7'`), `label` (optional display override), `sort_order`. RLS same as above.
- Seed `install_colors` from any distinct values currently sitting in `install_models.colors[]` so nothing is lost.
- Add columns to `job_installations`:
  - `system_type` text nullable (`extension` | `torsion` | null)
  - `size_id` uuid nullable, `size_label` text nullable (snapshot, like `group_name`/`model_name`)
- Keep `install_models.colors` column for now (ignored by UI). It can be dropped later — keeping it avoids touching `types.ts` regen risks and keeps migration minimal.

## 2. Catalog UI (`InstallationCatalogManager.tsx`)

Restructure into three sections instead of "Models & colors per group":
- **Groups** (unchanged)
- **Sub-items** for active group (unchanged)
- **Models** for active group — name only, no color editor anymore
- **Global Colors** (new top-level section, not group-scoped) — add / rename / delete
- **Global Sizes** (new top-level section) — width + height + optional label, add / edit / delete

## 3. Installation editor (`JobInstallationsEditor.tsx`)

For each installation row, replace the model-specific color dropdown with global lists, and add system + size:
- **Color**: dropdown of all `install_colors` (free-text fallback kept). No longer depends on model.
- **System**: dropdown — `Extension` / `Torsion` / —. Shown only when the active group looks door-related; simplest rule: always show, optional. (Catalog-level "applies to group" flag can come later if needed.)
- **Size**: dropdown of `install_sizes` rendered as `W × H` (e.g. `16' × 7'`). Stores `size_id` + `size_label` snapshot.

`installCatalog.ts` updates:
- `loadCatalog()` also returns `colors` and `sizes`.
- `JobInstallation` type gains `system_type`, `size_id`, `size_label`.
- `saveJobInstallations()` persists the new columns.
- `renderInstallVariables()` includes system + size in the per-installation block, e.g.
  `Garage Door (Lincoln 2000, White) — 16' × 7' — Torsion system:`
- New aggregate variables: `install_systems`, `install_sizes` (comma-joined) for templates.

## 4. Message templates

No required template change. Existing `{{install_items}}` automatically picks up the new lines. Document the two new optional variables in `messageTemplates.ts` variable list so users can reference them.

## Files touched
- 1 new migration (tables, columns, seed)
- `src/components/settings/InstallationCatalogManager.tsx` (restructure)
- `src/components/JobInstallationsEditor.tsx` (color/system/size pickers)
- `src/lib/installCatalog.ts` (types, load, save, render)
- `src/lib/messageTemplates.ts` (variable list only)

No new routes, no new server functions, no new pages — minimum credits.

## Validation
1. Add a color in Settings → it appears in every installation's color dropdown.
2. Add a size `16' × 7'` → selectable in installation; rendered in installer SMS preview.
3. Set System = Torsion on an installation → appears in `{{install_items}}`.
4. Existing jobs/installations still load (new columns nullable).
5. Old per-model colors still readable (column kept) but UI now uses global list.
