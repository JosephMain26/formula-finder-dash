# Implementation Plan

## 1. AI Training rules actually applied (no extra credits — fixing prior bug)

**`src/components/ParseMessageDialog.tsx`**
- Import `loadAITraining` and `applyMarketerRules` from `@/lib/aiTraining` and `recordCorrection` is already wired elsewhere.
- Before invoking `parse-job-message`, load the training settings and pass `generalRules`, `marketerRules`, and `corrections` (sliced to last ~25) in the request body — these fields already exist on the edge function but the client never sent them.
- After receiving the AI result, run `applyMarketerRules(extracted, message, training.marketerRules)` locally as a fallback. If a rule matches and the AI didn't already set the same company, override `extracted.company` with the rule's marketer name. This guarantees marketer rules work even if the LLM misses them.

No DB or edge function changes needed (the function already accepts these fields).

## 2. Mobile header — fix button/headline overlap

**`src/routes/index.tsx`** (Dashboard header)
- Restructure header into a stacked layout on small screens: greeting block on top, action buttons on a second row, both inside one container.
  - Outer wrapper: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`.
  - Greeting block keeps `min-w-0 flex-1` and `truncate` on the name.
  - Drop greeting font on mobile to `text-lg` (keep `sm:text-2xl lg:text-3xl`) so long names + emoji never push buttons off-screen.
- Action group (`ParseMessageDialog`, `AddJobDialog`, Settings, Sign out):
  - On mobile, render compact icon-only variants for "Parse Message" and "Add Job" (text hidden via `hidden sm:inline` inside the buttons; icons remain visible). Settings + Sign-out stay in `MobileNav`, no duplication.
  - Action row uses `flex items-center justify-end gap-2 w-full sm:w-auto` so it wraps cleanly under the greeting on phones.

**`src/routes/companies.tsx`, `src/routes/technicians.tsx`, `src/routes/installers.tsx`, `src/routes/settings.tsx`** (light polish only)
- Same `flex-col sm:flex-row` pattern for the header bars where the action button currently squeezes the title. Keeps the visual language consistent without touching internal page logic.

## 3. Marketer types → multi-select tag field with create/edit/delete

### Database migration
- Create `marketer_types` table:
  ```sql
  create table public.marketer_types (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now()
  );
  alter table public.marketer_types enable row level security;
  create policy "Public view marketer_types" on public.marketer_types for select using (true);
  create policy "Authenticated manage marketer_types" on public.marketer_types
    for all to authenticated using (true) with check (true);
  ```
- Convert `companies.company_type` from `text` to `text[]`, preserving existing values:
  ```sql
  alter table public.companies
    alter column company_type type text[]
    using case
      when company_type is null or company_type = '' then '{}'::text[]
      else string_to_array(company_type, ',')
    end;
  alter table public.companies alter column company_type set default '{}'::text[];
  ```
- Seed `marketer_types` with any distinct values currently present on companies so existing data immediately appears as tags.

### New component: `src/components/MarketerTypeSelect.tsx`
- Multi-select using shadcn `Popover` + `Command` (already in project) showing checkable items for every row in `marketer_types`.
- Selected tags render as removable `Badge` chips above the trigger.
- Inline "+ Create tag" input inside the popover when the typed query has no exact match → inserts into `marketer_types` and selects it.
- Inline rename (pencil) and delete (trash) icons per item, restricted to admins (use `useAuth().isAdmin`). Deletion only removes the tag definition — existing companies keep the value in their array unless the admin re-saves.
- Props: `value: string[]`, `onChange: (next: string[]) => void`.

### `src/routes/companies.tsx`
- Replace the single `Input` for `company_type` in `CompanyDialog` with `<MarketerTypeSelect value={form.company_type} onChange={…} />`.
- Update local form state to use `string[]` instead of `string`. Save as `text[]` directly.
- In the table row, render `company.company_type` as a wrapped row of small `Badge`s (fallback "—" when empty).

### `src/components/AddJobDialog.tsx` (minimal compat tweak)
- `comp_type` on jobs stays a `text` column (jobs table is unchanged). When a marketer is selected and its `company_type` is now an array, join with `", "` for the `comp_type` field default, so existing job logic keeps working without a jobs-table migration.
- Lines touched: ~115 and ~144 only (the two places `match.company_type` / `company.company_type` is read).

## Files

**Created:** `src/components/MarketerTypeSelect.tsx`
**Edited:** `src/components/ParseMessageDialog.tsx`, `src/routes/index.tsx`, `src/routes/companies.tsx`, `src/routes/technicians.tsx`, `src/routes/installers.tsx`, `src/routes/settings.tsx`, `src/components/AddJobDialog.tsx`
**Migration:** new `marketer_types` table + alter `companies.company_type` to `text[]` (with data preservation)

## Out of scope
- No edge function redeploy needed (it already accepts the rule fields).
- No changes to jobs schema — `comp_type` remains free text.
- No bulk back-fill of company_type across the rest of the app beyond the companies page rendering.

Reply **Approved** to apply, or **Approved without page-X polish** if you want to skip the secondary header tweaks.