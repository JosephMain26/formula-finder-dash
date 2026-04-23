

## Invite Users + Custom Roles & Permissions

Now that the email domain is set up, I'll add three sections to **Settings → Users**: invites, custom roles, and a permissions matrix.

### What you'll see in Settings → Users

```text
┌────────────────────────────────────────────────────────┐
│ INVITES                                                │
│ [email@example.com]  [Role ▾]  [Send invite]           │
│ Pending: bob@x.com — Manager — 2h ago [Resend][Cancel] │
├────────────────────────────────────────────────────────┤
│ USERS                                                  │
│ Jane (jane@…)   [Manager ▾]   [Remove]                 │
├────────────────────────────────────────────────────────┤
│ ROLES & PERMISSIONS         [+ Add role]               │
│ Permission              Admin Manager User Custom1     │
│ View jobs                ✓     ✓     ✓     ☐           │
│ Add jobs                 ✓     ✓     ✓     ☐           │
│ Edit jobs                ✓     ✓     ☐     ☐           │
│ Delete jobs              ✓     ✓     ☐     ☐           │
│ Manage marketers/techs   ✓     ☐     ☐     ☐           │
│ View AI training         ✓     ☐     ☐     ☐           │
│ Manage users & roles     ✓     ☐     ☐     ☐           │
│ Use remote upload link   ✓     ✓     ✓     ✓           │
└────────────────────────────────────────────────────────┘
```

Admin row is locked — admin always has every permission.

### How invites work

- Enter email, pick role, click **Send invite** → recipient gets a branded magic-link email from `notify.gedatajob.com`.
- Clicking the link signs them in and auto-assigns the pre-selected role.
- Pending invites show **Resend** / **Cancel** buttons; expire after 7 days.

### Database changes (one migration)

- `pending_invites` (`email`, `role`, `invited_by`, `token`, `expires_at`, `accepted_at`) — admin-only RLS.
- `permissions` (`key`, `label`) — seeded with the 8 rows above.
- `role_permissions` (`role_name`, `permission_key`) — drives the matrix; seeded with default Admin/Manager/User grants.
- `custom_roles` (`name`) — for roles beyond admin/manager/user.
- Update `handle_new_user` trigger: on signup, look up `pending_invites` by email; if found, assign that role and mark invite accepted.
- Helper `has_permission(_user_id, _key)` SECURITY DEFINER — admin short-circuits to true; otherwise checks `role_permissions` joined with `user_roles`.

### Backend

- **Server function** `inviteUser` (in `src/routes/settings.tsx` or a dedicated file) — admin-only, validates with zod, inserts into `pending_invites`, calls `supabaseAdmin.auth.admin.inviteUserByEmail()` with `notify.gedatajob.com` as the sender (handled by the existing auth-email-hook once auth templates are scaffolded).
- **Auth email templates** scaffolded so the invite email is branded.
- **Resend / cancel** = simple admin-only DB ops.

### Frontend changes

- **`src/components/UsersManager.tsx`** — add Invites and Roles & Permissions sections above the existing Users + Pre-seeded admins blocks.
- **`src/lib/auth-context.tsx`** — expose `permissions: Set<string>` and `can(key)` helper alongside existing `isAdmin/isManager`.
- **`src/routes/index.tsx`** & **`src/components/JobsTable.tsx`** — replace `isAdmin`/`isManager` UI gates with `can('jobs.delete')`, `can('users.manage')`, etc. RLS still enforces server-side.
- Pending-invite acceptance is automatic via the updated signup trigger — no extra page needed.

### Technical notes

- `inviteUserByEmail` requires the service-role client (`supabaseAdmin` from `client.server.ts`) and runs in a server function gated by `requireSupabaseAuth` + an admin role check.
- Permission keys are stable strings (`jobs.view`, `jobs.add`, `jobs.edit`, `jobs.delete`, `entities.manage`, `ai.view`, `users.manage`, `upload.remote`) — used by both the matrix UI and frontend `can()` checks.
- Default seeds match the matrix shown above; you can toggle anything except the Admin row.

