## Goal
Restrict every authenticated user to only their own data by default, with admin controls to relax that restriction either globally or per role.

## Current state (root cause)
- `jobs` table RLS allows any authenticated user to see every row (`USING (true)`).
- The main dashboard (`/`), `JobsTable`, `AnalyticsPanel`, `ExportReportDialog`, and tech/installer/company pages all fetch unscoped data straight from the client.
- DataBoard already scopes by `tech_name` via the `databoard.view_all` permission — but the `user` role currently has that permission, defeating the restriction.
- No admin UI exists to toggle "share data across users."

## Plan

### 1. New permission + global setting (DB migration)
- Add permission `jobs.view_all` (label: "View all users' jobs"). This becomes the single source of truth for cross-user visibility across the whole app (dashboard, jobs table, analytics, exports, DataBoard).
- Keep `databoard.view_all` as an alias that resolves to `jobs.view_all` for backward compatibility (DataBoard server fn checks both).
- Seed `jobs.view_all` for `admin` and `manager` only. **Remove** `databoard.view_all` from the `user` role (current bug — every user role gets full visibility).
- Add row to `app_settings` with key `data_visibility` and value `{ "shareAcrossUsers": false }` — the global switch.

### 2. Effective-permission helper (server-side)
- New SQL function `public.can_view_all_jobs(_user_id uuid)` → returns true if:
  - User is admin, OR
  - `app_settings.data_visibility.shareAcrossUsers = true`, OR
  - User has role with `jobs.view_all` permission (per-role override).
- New view `public.jobs_scoped` (security_invoker) that returns all jobs when `can_view_all_jobs(auth.uid())` is true, otherwise only rows where `tech_name` matches the caller's linked technician.

### 3. Tighten RLS on `jobs`
- Replace the permissive `Authenticated view jobs` SELECT policy with one that uses `can_view_all_jobs(auth.uid()) OR tech_name = (SELECT tech_name FROM technicians WHERE user_id = auth.uid() LIMIT 1)`.
- This means every existing client query (`supabase.from("jobs").select(...)`) is automatically scoped — no client code changes required for correctness, only for UX (counts, filters, etc. will naturally show only what the user is allowed to see).
- INSERT/UPDATE/DELETE policies stay as-is (managers/admins keep write access; techs already restricted by `jobs.add_for_others`).

### 4. Frontend wiring
- **`src/lib/auth-context.tsx`**: expose `canViewAll` derived from `permissions.has("jobs.view_all") || isAdmin`. Components use this to hide irrelevant filters (e.g., the "Tech" filter on `/` is meaningless for a tech viewing only their own jobs).
- **`src/routes/index.tsx`**: hide the tech filter and tech column when `!canViewAll`; the underlying query already filters via RLS so no logic change needed.
- **`src/lib/databoard/queries.functions.ts`**: switch the `databoard.view_all` check to also accept `jobs.view_all` and honor the global `app_settings.data_visibility.shareAcrossUsers` flag.
- **`src/components/AnalyticsPanel.tsx`** and **`src/components/ExportReportDialog.tsx`**: no logic change — they consume the already-scoped `jobs` array from the parent.

### 5. Admin UI in Settings → Roles & Permissions
- **`src/components/UsersManager.tsx`**: add a "Data visibility" card at the top with:
  - **Global toggle**: "Allow all users to see each other's data" (writes `app_settings.data_visibility.shareAcrossUsers`).
  - **Per-role override note** explaining: when global is OFF, you can still grant `jobs.view_all` to specific roles below in the existing permission matrix.
- The existing permission matrix already lets the admin tick `jobs.view_all` per role — no new UI needed there beyond surfacing the new permission row.

### 6. Edge cases handled
- A user with no linked technician record sees zero jobs (safe default — they only see what's explicitly theirs).
- Admin always sees everything regardless of toggles.
- The DataBoard's existing `scopeTechName` UI hint ("Showing data for: …") continues to work, driven by the same effective-permission check.
- Inserts/updates by techs continue to work; the tighter RLS only affects SELECT.

## Files to change
- **DB migration** (new): permission + role_permissions seed + `can_view_all_jobs()` function + updated `jobs` SELECT policy + `app_settings` default row.
- `src/lib/auth-context.tsx` — add `canViewAll` flag.
- `src/lib/databoard/queries.functions.ts` — honor new permission + global setting.
- `src/routes/index.tsx` — hide tech filter/column for scoped users.
- `src/components/UsersManager.tsx` — add "Data visibility" card with global toggle.
- `src/lib/settings.ts` — add helpers to read/write the `data_visibility` setting.

## Out of scope (no changes)
- Technicians/installers/companies/marketers lists — these are reference data needed to add a job; they stay readable to all authenticated users.
- Write permissions on jobs (already governed by existing `jobs.add_for_others`, `jobs.edit`, `jobs.delete`).