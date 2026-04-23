

## Invite Users by Email + Custom Roles & Permissions

I'll add three things to the existing **Settings → Users** tab:

1. **Invite users by email** (sends an email-link signup, with their role pre-assigned).
2. **Manage roles** — add/rename/delete custom roles beyond Admin/Manager/User.
3. **Permissions matrix** — toggle which actions each role is allowed to do.

### What you'll see in Settings → Users

The Users tab will be reorganized into 3 sub-sections:

```text
┌────────────────────────────────────────────────────────┐
│ INVITES                                                │
│ [email@example.com]  [Role ▾]  [Send invite]           │
│ Pending invites:                                       │
│  • bob@x.com — Manager — sent 2h ago — [Resend][Cancel]│
├────────────────────────────────────────────────────────┤
│ USERS                                                  │
│ Jane Doe (jane@…)        [Manager ▾]  [Remove]         │
│ John Smith (john@…)      [Admin ▾]                     │
├────────────────────────────────────────────────────────┤
│ ROLES & PERMISSIONS                                    │
│ [+ Add role]                                           │
│  Permission                Admin Manager User Custom1  │
│  View jobs                  ✓     ✓     ✓     ☐        │
│  Add jobs                   ✓     ✓     ✓     ☐        │
│  Edit jobs                  ✓     ✓     ☐     ☐        │
│  Delete jobs                ✓     ✓     ☐     ☐        │
│  Manage marketers/techs     ✓     ☐     ☐     ☐        │
│  View AI training           ✓     ☐     ☐     ☐        │
│  Manage users & roles       ✓     ☐     ☐     ☐        │
│  Use remote upload link     ✓     ✓     ✓     ✓        │
└────────────────────────────────────────────────────────┘
```

Admin row is locked (admin always has every permission).

### How invites work

- You enter an email + pick a role and click **Send invite**.
- They receive a Lovable-branded email with a magic link. Clicking it logs them in (no password setup needed) and they land on the dashboard with the role already assigned.
- Pending invites are listed with **Resend** / **Cancel** buttons.
- If they don't accept within 7 days, the invite expires.

### Database changes (one migration)

- New table `pending_invites` (`email`, `role`, `invited_by`, `token`, `expires_at`, `accepted_at`) — admin-only RLS.
- New table `permissions` — list of permission keys the app understands (seeded with the rows shown above).
- New table `role_permissions` (`role_name`, `permission_key`) — drives the matrix.
- New table `custom_roles` (`name`, `created_at`) — for roles beyond admin/manager/user.
- Update the signup trigger (`handle_new_user`) to look up `pending_invites` by email and apply the pre-assigned role on first login, then mark the invite accepted.
- Helper function `has_permission(_user_id, _key)` (security definer) that returns true if any of the user's roles grants the permission. Admin short-circuits to true.

### Backend (one server route + email template)

- **Server route** `src/routes/lovable/email/auth/webhook.ts` (auth email hook — scaffolded by Lovable Emails). Uses your existing email domain so invitations come from your branded sender.
- A small **server function** `inviteUser` that: validates input (zod), inserts into `pending_invites`, and triggers `supabase.auth.admin.inviteUserByEmail()` via the service-role client.
- **Resend invite** & **cancel invite** are simple admin-only DB ops.

### Frontend changes

- **`src/components/UsersManager.tsx`** — extend with the three sections above (invites / users / permissions matrix). Keep the existing pre-seeded admin emails block at the bottom.
- **`src/lib/auth-context.tsx`** — expose `permissions: Set<string>` and a `can(key)` helper alongside `isAdmin/isManager`.
- **`src/routes/index.tsx`, `JobsTable.tsx`, etc.** — replace existing `isAdmin` / `isManager` UI checks with `can('jobs.delete')`, `can('users.manage')`, etc. (RLS still enforces server-side.)
- **Pending invite acceptance** — handled automatically by the updated signup trigger; no extra UI page needed.

### Email setup (one-time)

Inviting users requires a verified sender domain. I'll guide you through the email domain setup dialog the first time, then auth invite emails work automatically.

<lov-actions>
<lov-open-email-setup>Set up email domain</lov-open-email-setup>
</lov-actions>

