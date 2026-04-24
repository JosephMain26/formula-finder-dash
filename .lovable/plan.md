## Plan: Sorting, Responsive Layout, Tech Role & Permissions

### 1. Jobs table sorting (default newest → oldest + user choice)
**Files:** `src/routes/index.tsx`, `src/components/JobsTable.tsx`
- Add a `sortBy` state on the dashboard with options: `job_date_desc` (default), `job_date_asc`, `created_desc`, `created_asc`, `price_desc`, `price_asc`.
- Default the Supabase fetch order to `job_date desc, created_at desc` (currently only `job_date desc`, which is fine but ties get random order).
- Apply the selected sort client-side on the `filtered` list before rendering.
- Persist selection via `userPrefs` under `dashboard.sortBy` (already wired pattern).
- Add a small `<Select>` next to "Showing X of Y jobs".

### 2. Analytics widgets — collapsible / dynamic stretch
**Files:** `src/routes/index.tsx`, `src/components/AnalyticsPanel.tsx`
- When `charts.length === 0`, do **not** reserve the right-hand 320–360px column. Conditionally render the side panel only if charts exist.
- Add a "Hide analytics" toggle button in the panel header (and a "Show analytics" button placed next to ColumnToggle when hidden). Persist `analytics.hidden: boolean` in user prefs.
- Layout change: replace the fixed `lg:w-[320px]` with a wrapper that becomes `display: none` when hidden/empty, letting the table flex container fill the full width naturally (already `flex-1`).

### 3. New "tech" role + per-user job-creation scope permission
**Files:** new migration, `src/lib/auth-context.tsx`, `src/components/UsersManager.tsx`, `src/components/AddJobDialog.tsx`, `src/routes/index.tsx`

**Migration (schema only):**
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tech';

INSERT INTO public.permissions (key, label, description) VALUES
  ('jobs.add_for_others', 'Add jobs for other techs',
   'When OFF, the user may only create jobs assigned to themselves'),
  ('marketer.view_percentage', 'View marketer percentage',
   'Allows seeing & overriding the marketer % field in job form / table')
ON CONFLICT (key) DO NOTHING;

-- Default tech role: can add/view their own jobs only
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('tech', 'jobs.view'),
  ('tech', 'jobs.add'),
  ('tech', 'jobs.edit')
ON CONFLICT DO NOTHING;
```

**App changes:**
- `BUILT_IN_ROLES` in `UsersManager.tsx` → add `"tech"`. The two new permissions automatically appear in the Roles & Permissions matrix (it iterates `permissions` table).
- `AddJobDialog.tsx`:
  - If `!can("jobs.add_for_others")` and not editing, lock the technician selector to the current user's matching technician (match by `displayName` against `technicians.tech_name`, fallback to disabled select with a notice "You can only add jobs for yourself").
  - Hide the "Override marketer percentage" block and the company `(percentage%)` suffix when `!can("marketer.view_percentage")`. The default marketer % still applies behind the scenes — only the UI is hidden.
- `JobsTable.tsx`: hide `total_marketer` column header/cell when `!can("marketer.view_percentage")` (column toggle filtered out as well).

### 4. Hide marketer percentage option
Covered by the new `marketer.view_percentage` permission above. Admins can toggle it per role in **Settings → Roles & Permissions**. By default:
- admin / manager → enabled
- user / tech → disabled

### Files to be edited / created
- **New migration**: `supabase/migrations/<ts>_tech_role_permissions.sql`
- **Edited**: `src/routes/index.tsx`, `src/components/JobsTable.tsx`, `src/components/AnalyticsPanel.tsx`, `src/components/UsersManager.tsx`, `src/components/AddJobDialog.tsx`

### Notes
- No `ColumnToggle` change needed beyond filtering out hidden-by-permission columns.
- All persistence reuses existing `userPrefs` infra (zero new tables).
- Reply **Approved** to implement, or tell me which items to skip.