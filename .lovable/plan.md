## Goal
Add the ability to delete users from Settings → Users, gated by a new `users.delete` permission (admins always allowed).

## Changes

### 1. Database migration (one migration)
- Insert a new permission row:
  - `key = 'users.delete'`, `label = 'Delete users'`, `description = 'Permanently remove a user account and their role assignments'`.
- No other schema changes — `has_permission()` and the existing `permissions` / `role_permissions` tables already drive everything.

### 2. New server function — `src/lib/invites.functions.ts`
Add `deleteUser` (kept in this file to avoid creating new modules, since it shares the same admin-token pattern):
- Input: `{ accessToken, userId }` (zod-validated, `userId` as UUID).
- Auth check: reuse `supabaseAdmin.auth.getUser(accessToken)` to resolve caller, then verify caller has `users.delete` via `has_permission(caller_id, 'users.delete')` RPC OR is admin (the existing `has_permission` SQL function already short-circuits for admins, so a single RPC call covers both).
- Refuse self-delete (`userId === caller.id`).
- Refuse deleting the last remaining admin (count `user_roles` where role='admin'; if target is admin and count <= 1 → error).
- Steps:
  1. `supabaseAdmin.from('user_roles').delete().eq('user_id', userId)`
  2. `supabaseAdmin.from('user_preferences').delete().eq('user_id', userId)` (best-effort)
  3. `supabaseAdmin.auth.admin.deleteUser(userId)` — this cascades to `profiles` via the existing FK on `profiles.id → auth.users.id`.

### 3. UI — `src/components/UsersManager.tsx`
- Pull `can` from `useAuth()`; compute `canDeleteUsers = can('users.delete')`.
- In each user row, when `canDeleteUsers && profile.id !== currentUser.id`, render a destructive trash icon button next to the existing Edit button.
- Wrap delete in an `AlertDialog` confirmation ("Delete {name}? This cannot be undone.").
- On confirm: call `deleteUser` server fn with `accessToken` + `userId`, toast result, `load()` to refresh.
- Permissions matrix: no code changes needed — the new `users.delete` row appears automatically from the `permissions` table query. Admin row stays locked-on as today.

### Why minimal credits
- One small migration (single insert).
- One new server function in an existing file.
- Localized UI edit in one component (add button + confirm dialog + handler).
- Zero changes to RLS, schema, or other components.

## Files touched
- `supabase/migrations/<new>.sql` (insert one permission row, idempotent with `ON CONFLICT DO NOTHING`)
- `src/lib/invites.functions.ts` (add `deleteUser`)
- `src/components/UsersManager.tsx` (delete button + confirm dialog + handler)
