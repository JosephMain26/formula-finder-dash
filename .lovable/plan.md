
# Make the Job Form fully manageable from Settings

Today the Settings → "Job Form & Statuses" tab only manages **custom fields** and **statuses**. The core built-in fields (Job Date, Marketer, Technician, Phone, Address, Price, Parts, Payment, Notes, Installer, etc.) are still hardcoded inside the Add Job dialog, the Parse Message review form, and the `/upload` remote link form.

This plan extends the existing builder so admins can also reorder, rename, hide, or mark-required the **core** fields. The same definition then drives every entry point that opens a job form, with no extra DB migration.

## What you'll be able to do in Settings

In the existing **Settings → Job Form & Statuses** tab, the "Job Form Builder" card is upgraded:

1. A new **"Built-in fields"** section lists every core field (Date, Marketer, Tech, Phone, Address, Comp Type, Job Type, Status, Price, Co Parts, Office Parts, Parts, Payment, Check #, Tip, Cost, CC Fee, Created By, Installer, Notes, Paid).
2. Per core field you can:
   - Rename the **label** shown in the form
   - Toggle **Visible in form** (hidden = not rendered, default value used on save)
   - Toggle **Required**
   - Reorder with up/down arrows
   - Toggle **Visible in Parse Message review** and **Visible in Remote Upload form** (so the public/tech-facing forms can be slimmer than the office form)
3. The existing **Custom fields** section keeps working unchanged.
4. A **"Reset built-in fields to defaults"** button restores the original list/labels/order.

Locked fields (cannot be hidden or made non-required without breaking calculations): `price`, `company_id`, `status`. They can still be relabeled and reordered. The UI shows a small lock icon on these.

## What changes in each entry point

- **Add Job button** (`AddJobDialog`) — fields render in the configured order with the configured labels; hidden fields are skipped; required toggles affect the HTML `required` attribute. Custom fields section keeps appearing at the end as today.
- **Edit Job** (same dialog from `JobsTable`) — identical behavior.
- **Parse Message dialog** (`ParseMessageDialog`) — opens the same `JobDialog` after parsing, so it inherits all schema changes automatically.
- **Remote Upload `/upload`** — both the **Manual Entry** tab and the **Parse review** dialog render core fields from the schema (filtered by "Visible in Remote Upload"). Tech name stays locked to the pincode identity. Custom fields marked "Show in form" also appear here.
- **Parse Message AI** (`supabase/functions/parse-job-message`) — reads schema (passed in by the client) so it only tries to extract fields that are visible/enabled. Hidden fields are dropped from the JSON schema sent to the model — saves tokens and stops the AI from guessing fields you removed.

## Technical details

### Storage (no DB changes)
Reuse the existing `app_settings` row with key `job_form_schema`. Today its `value` is `{ fields: CustomField[] }`. Extend to:
```ts
{
  fields: CustomField[];      // existing custom fields
  core: CoreFieldOverride[];  // NEW
}

type CoreFieldOverride = {
  key: CoreFieldKey;          // 'job_date' | 'company_id' | 'tech_name' | ...
  label?: string;             // override default label
  visibleInForm: boolean;
  visibleInRemote: boolean;   // /upload form
  visibleInParseReview: boolean;
  required?: boolean;
  order: number;
};
```
Backward compatible: if `core` is missing, code falls back to a hardcoded `CORE_FIELDS_DEFAULT` registry — the form looks identical to today.

### New file
- `src/lib/coreFields.ts` — `CORE_FIELDS_DEFAULT` registry (key, default label, type, locked flag, default order, default `visibleIn*` flags), plus helpers `getCoreFieldsResolved(overrides)` and `isVisibleInForm(key, schema)`.

### Files to update
- `src/lib/jobSchema.ts` — extend `loadCustomFields`/`saveCustomFields` to also read/write the `core` array (new `loadFormSchema`/`saveFormSchema` returning `{ fields, core }`). Old callers keep working.
- `src/components/settings/JobFormBuilder.tsx` — add the "Built-in fields" section above the existing custom fields section, with label edit, visibility toggles, required, and up/down reorder. Add reset button.
- `src/components/AddJobDialog.tsx` — replace the hand-written field grid with a small renderer that loops over `getCoreFieldsResolved(schema.core)` in order, calling per-field render functions (kept inside the file as a `Record<CoreFieldKey, () => JSX>` map) so all the existing logic — company auto-fill, tech auto-percent, payment-method CC fee, manual percentage panels, status select from `statuses`, etc. — is preserved one-for-one. Hidden fields are skipped; their values default to `null`/`0`/`false` on save.
- `src/routes/upload.tsx` — `JobFields` becomes schema-driven the same way, filtered by `visibleInRemote`. Tech-name stays force-locked. Custom fields marked `visibleInForm` are appended via the existing `DynamicField` component.
- `src/components/ParseMessageDialog.tsx` — passes the schema (just visible-form keys) into the edge call so the AI only extracts what's needed.
- `supabase/functions/parse-job-message/index.ts` — accepts a new optional `enabledFields: string[]` and dynamically builds the JSON output schema from it (default = all). No behavior change when not provided.

### Calculation safety
All revenue/profit/percentage math in `handleSubmit` keeps reading the same form variables. When a field is hidden it just falls back to its default (`""` → `0` for numeric, `""` for text) so totals stay correct. Locked fields (`price`, `company_id`, `status`) can never be hidden, guaranteeing the math always has its inputs.

### Realtime propagation
`loadFormSchema()` is called once on form open (already how custom fields/statuses load today). No extra refetching needed — saving in Settings and re-opening the dialog shows the new layout. Cheap and consistent with current behavior.

## Why this is the cheapest path

- **Zero database migrations** — reuses the `app_settings.job_form_schema` row already created last turn.
- **Zero new components** for entry points — `ParseMessageDialog`, `JobsTable` edit, and the DataBoard already open the same `JobDialog`, so refactoring it once propagates everywhere.
- **One tiny edge-function tweak** (optional schema filter) instead of a rewrite.
- Touches 6 files total; no new routes, tables, or RLS policies.

## Out of scope (to keep credits low)

- Per-role field visibility (existing role gates on marketer % stay as-is).
- Drag-and-drop reorder (uses up/down arrows like the custom-fields UI).
- Section grouping headers in the form (kept as a single grid, like today).
- Field validation rules beyond `required` (e.g. min/max, regex).

## Deliverable

After approval:
1. Settings → Job Form Builder gains a "Built-in fields" panel with rename / hide / require / reorder / per-surface visibility.
2. Add/Edit Job dialog, Parse Message review dialog, and `/upload` Manual + Parse review forms all render from that same schema.
3. AI parser receives only the fields you've kept enabled.
4. No DB migration, no breaking changes — existing jobs and saved settings keep working.

Reply **Approved** to build it.
