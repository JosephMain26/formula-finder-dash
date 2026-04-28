# Job Form Builder & Status Manager

A single source of truth in **Settings** that controls the job form, the jobs list columns, and the DataBoard widget options. Designed to be cheap: no per-field DB migrations.

## How it works (concept)

- **Core fields** (`price`, `tech_name`, `status`, `job_date`, etc.) stay as real columns on `jobs`. The form builder only controls their **label, visibility, required, order, and section**.
- **Custom fields** you add (e.g. "Warranty months", "Source URL", "Crew size") are stored in **one new JSONB column `jobs.extra_fields`**. Add/remove unlimited fields with zero DB changes.
- The same schema definition is read by:
  - Add/Edit Job dialog → renders inputs dynamically
  - Jobs list table → adds columns for visible custom fields
  - DataBoard "Add widget" menu → exposes numeric custom fields as KPI/chart options
  - Filters bar → exposes select/text custom fields as filters
- **Statuses** become a managed list (name + color + order). Replaces today's hardcoded `["Pending","Completed","Cancelled","In Progress"]` and the hardcoded color logic in `StatusBadge`.

## What you'll be able to do in Settings

New tab **"Job Form & Statuses"** (admin-only, alongside Payment Methods, Templates, AI):

1. **Job Form Builder**
   - List of all fields (core + custom) shown in form order with drag-to-reorder.
   - Per field: toggle Visible, toggle Required, edit Label, choose Section (Basics / Money / Notes / Custom).
   - Add custom field: name, type (`text`, `number`, `select`, `date`, `checkbox`, `textarea`), options (for select), default value.
   - Edit / delete custom fields. Deleting only removes the definition; existing data in `extra_fields` is preserved (shown as "orphan" with a one-click cleanup).
   - "Show in jobs table" toggle per field.
   - "Show in DataBoard" toggle per numeric field (auto-creates available KPI/chart metric).

2. **Statuses Manager**
   - Add / rename / reorder / delete statuses.
   - Pick color (preset palette: gray/yellow/blue/green/red/purple/orange).
   - Mark one as default for new jobs.
   - Used everywhere: form select, table badge, filters, kanban-style insights.

## Technical implementation

### Database (one migration only)
```sql
-- 1. Custom field bag on jobs
ALTER TABLE public.jobs ADD COLUMN extra_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Schema + statuses live in existing app_settings table (no new tables)
--    keys: 'job_form_schema', 'job_statuses'
```

### Settings shape (stored in `app_settings`)
```ts
// key: 'job_form_schema'
type FieldDef = {
  id: string;
  key: string;                 // for core: 'price','tech_name'… for custom: 'x_warranty_months'
  source: 'core' | 'custom';
  label: string;
  type: 'text'|'number'|'select'|'date'|'checkbox'|'textarea';
  options?: string[];          // for select
  required?: boolean;
  visibleInForm: boolean;
  visibleInTable: boolean;
  visibleInDataboard?: boolean;// numeric only
  section: 'basics'|'money'|'notes'|'custom';
  order: number;
  default?: string|number|boolean;
};

// key: 'job_statuses'
type StatusDef = { id: string; name: string; color: string; order: number; isDefault?: boolean };
```

### New files
- `src/lib/jobSchema.ts` — load/save schema + statuses, plus `CORE_FIELDS` registry (mirrors today's columns), default seeding, helpers (`getVisibleFormFields`, `getTableColumns`, `getNumericFields`).
- `src/components/settings/JobFormBuilder.tsx` — drag-to-reorder list, add/edit/delete custom fields.
- `src/components/settings/StatusesManager.tsx` — add/rename/recolor/reorder statuses.
- `src/components/DynamicField.tsx` — single component that renders any field type (used by AddJobDialog).
- `src/components/StatusBadge.tsx` — extracted, color from `job_statuses` (no more hardcoded map).

### Files to refactor
- `src/components/AddJobDialog.tsx` — render fields from schema. Core fields keep their existing handlers; custom fields read/write `form.extra_fields[key]`. Save writes both top-level columns and `extra_fields` jsonb.
- `src/components/JobsTable.tsx` — append columns for `visibleInTable` custom fields; use `<StatusBadge>` reading from settings.
- `src/components/ColumnToggle.tsx` — `ALL_COLUMNS` becomes derived from schema (core columns + custom).
- `src/components/JobFilters.tsx` — status select uses managed statuses; add filters for select-type custom fields.
- `src/routes/settings.tsx` — new `<TabsTrigger value="form">` tab with the two managers.
- `src/components/databoard/AddWidgetMenu.tsx` + `KpiWidget` / `InsightWidget` / `ChartWidget` — extend metric options to include numeric custom fields (read via `extra_fields[key]` using `jobMetric` helper).
- `src/lib/databoard/metrics.ts` — add `customMetric(job, key)` so widgets can chart custom numeric fields.
- `src/integrations/supabase/types.ts` — auto-regenerated after the migration adds `extra_fields`.

### Backward compatibility
- On first load, if `job_form_schema` is missing, seed it from `CORE_FIELDS` so the form & table look identical to today.
- If `job_statuses` is missing, seed `[Pending(yellow), In Progress(blue), Completed(green), Cancelled(red)]` matching today's colors. Existing job rows keep working.
- `extra_fields` defaults to `{}` so existing jobs are untouched.

### Security
- Schema/statuses live in `app_settings` which already has admin-only write RLS. Reads are public (already configured).
- `extra_fields` inherits the existing `jobs` RLS — no new policies needed.

## Out of scope (to keep credits low)
- Conditional-show logic (e.g. "show field X only if status = Y").
- Per-role field permissions (fields are global; existing role gates remain).
- Drag-and-drop **between sections** with animations — using simple up/down arrows + section dropdown.
- Migrating existing custom data already living in `notes`. New fields start empty.

## Deliverable check
After approval you'll get:
1. One DB migration (add `extra_fields`).
2. New Settings → "Job Form & Statuses" tab.
3. Dynamic Add/Edit Job dialog.
4. Jobs table + filters + DataBoard widgets all driven from the schema.
5. Status badge & dropdowns powered by the managed status list.

Reply **Approved** to build it.
