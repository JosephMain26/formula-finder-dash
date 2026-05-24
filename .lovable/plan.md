## Goal
Manage Comp Types and Job Types from Settings, with a mapping so that selecting a Company/Comp Type in the Job form filters the Job Type dropdown to only the relevant options.

## Approach (minimal credits — no schema change)
- Reuse existing tables: `marketer_types` (= comp types) and `job_types`.
- Store the mapping in `app_settings` under key `job_type_groups` as JSON:
  ```json
  { "groups": { "<compTypeName>": ["JobTypeName1", "JobTypeName2"] } }
  ```
- No migration needed.

## Changes

### 1. New settings section: `src/components/settings/TypeGroupsManager.tsx`
One panel with two columns:
- **Comp Types** list (from `marketer_types`): add / rename / delete.
- **Job Types** list (from `job_types`): add / rename / delete.
- For each Comp Type row: a multi-select (checkbox popover) of Job Types that belong to it. Persisted to `app_settings.job_type_groups`.
- "Unassigned" job types remain available globally (fallback so nothing breaks).

### 2. Wire into `src/routes/settings.tsx`
Add a new tab/section "Job & Comp Types" rendering `TypeGroupsManager`.

### 3. `src/components/AddJobDialog.tsx`
- Load `job_type_groups` mapping alongside job types.
- When rendering the `job_type` Select, filter `jobTypes` to those mapped to current `form.comp_type`. If comp_type empty or has no mapping, show all job types (current behavior).
- If current `form.job_type` no longer matches the filtered list, keep showing it as "(other)" item so edits don't lose data.

### 4. Helper `src/lib/typeGroups.ts`
`loadTypeGroups()` / `saveTypeGroups(groups)` using the existing `app_settings` pattern (mirrors `loadStatuses` in `jobSchema.ts`).

## Out of scope
- No DB migration.
- No changes to Companies page or the comp_type field schema.
- Filtering job_type in reports/filters can be added later if needed.