## Plan

### 1. Job Form — single-select Comp Type (`src/components/AddJobDialog.tsx`)
- Replace the current free-text input + datalist for "Comp Type" with a `<Select>` populated from the `marketer_types` table.
- If a saved job has a legacy comp_type not in the list, render it as a `"{value} (missing)"` selectable option so editing doesn't lose data.
- Single-selection only (no multi-select, no free text).

### 2. AI Training — make General Rules actually apply (`supabase/functions/parse-job-message/index.ts`)
- Reorganize the system prompt so `generalRules` are placed at the TOP under a "HIGH-PRIORITY ADMIN RULES — ALWAYS FOLLOW" header instead of being appended at the bottom (currently they get diluted by mapping/correction context).
- Send `generalRules` as a second dedicated system message right before the user message to reinforce them.
- No schema changes.

### 3. Marketer Mapping dropdown (`src/routes/settings.tsx`)
- Replace the free-text "Marketer name" `<Input>` in AI Training mapping rules with a `<Select>` sourced from the `companies` table (`company_name`).
- Stale rule values shown as `"{name} (missing)"`.
- If no companies exist, show a link to `/companies` and disable the select.
- Saved value remains a string — no edge function or schema changes needed.

### 4. User Profile — split name + new contact fields
**Database migration** — add columns to `profiles`:
- `first_name text`, `last_name text`
- `phone text` (work)
- `mobile_phone text` (personal/SMS)
- `job_title text`
- `timezone text`
- `avatar_url text`
- `notes text` (admin-only visibility)

Backfill: split existing `display_name` into `first_name` / `last_name` on best-effort basis (first token = first_name, rest = last_name). Keep `display_name` in sync going forward.

**New component `src/components/MyProfileCard.tsx`**:
- Lets the signed-in user edit their own: first_name, last_name, phone, mobile_phone, job_title, timezone, avatar_url.
- `notes` is hidden from self-edit (admin-only field).
- Saves via Supabase update on `profiles` where `id = auth.uid()`.

**Update `src/components/UsersManager.tsx`**:
- Show first/last name as separate columns.
- Add an "Edit" action per user (admin only) opening a dialog to edit all profile fields including `notes`.
- Existing role assignment UI remains unchanged.

**Mount `MyProfileCard`** at the top of `src/routes/settings.tsx` so every signed-in user can manage their own contact info.

### Files touched
- `src/components/AddJobDialog.tsx`
- `supabase/functions/parse-job-message/index.ts`
- `src/routes/settings.tsx`
- `src/components/UsersManager.tsx`
- `src/components/MyProfileCard.tsx` (new)
- One migration adding columns to `profiles`

### Out of scope / notes
- No changes to RLS (existing "Users update own profile" + "Admins update any profile" policies cover all new columns).
- No changes to auth flow.
- `display_name` retained for backwards compatibility; computed as `${first_name} ${last_name}` on save.