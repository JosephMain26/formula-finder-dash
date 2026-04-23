

## Login System with Roles & Permissions

I'll add email/password + Google authentication, a 3-tier role system (Admin / Manager / User), and pre-seed your email as admin. The public `/upload` link stays open so outside users can submit jobs without an account.

### What you'll get

1. **`/auth` page** — sign up & sign in (email + password, plus Google).
2. **Auto-logout** & user menu in the dashboard header.
3. **Role-based access**:
   - **Admin** — full control: settings, AI training, user management, delete jobs, manage marketers/techs/installers.
   - **Manager** — view + edit/delete jobs, view reports & analytics, but cannot manage users or change settings.
   - **User** — view jobs and add/edit only their own entries.
4. **User Management page** (`/settings` → new "Users" tab, admin-only) — list all users, change their role, remove them.
5. **Pre-seeded admin** — when you sign up with the email you provide, you'll automatically be granted admin role.
6. **Public `/upload`** — unchanged, no login required.

### Database changes (one migration)

- New enum `app_role` with values `admin`, `manager`, `user`.
- New table `user_roles` (`user_id`, `role`) — roles stored separately from profile (security best practice).
- New table `profiles` (`id`, `email`, `display_name`, `created_at`) auto-populated by trigger on signup.
- New table `admin_seed` (`email`) — holds your pre-seeded admin email; trigger checks this on signup and grants admin role automatically.
- Security definer function `has_role(user_id, role)` for safe RLS checks.
- **RLS policies updated** on `jobs`, `companies`, `technicians`, `installers`, `job_types`, `app_settings`:
  - SELECT — any authenticated user (or public for `jobs` INSERT to support `/upload`).
  - INSERT — authenticated users + public for `jobs` (remote link).
  - UPDATE — manager or admin.
  - DELETE — admin only (or manager for jobs).
  - `app_settings` write — admin only.

### Frontend changes

- **`src/routes/__root.tsx`** — wrap `<Outlet />` with an `AuthProvider` that exposes `user`, `role`, `isAdmin`, `isManager`, `signOut`.
- **`src/routes/auth.tsx`** (new, public) — tabs for Sign In / Sign Up, with Google button.
- **`src/routes/_authenticated.tsx`** (new pathless layout) — guards routes; redirects to `/auth` if not signed in.
- **Move existing routes under `_authenticated`**: `index`, `settings`, `companies`, `technicians`, `installers`. (`/upload` stays public.)
- **`src/routes/index.tsx`** — add user badge + sign-out button in header; hide Settings link for non-admins.
- **`src/routes/settings.tsx`** — admin-only guard via `beforeLoad`; add new **Users** tab listing accounts with role dropdowns.
- **`src/components/JobsTable.tsx`** — hide delete button for non-admin/manager; disable inline-edit for `User` role on rows they didn't create.

### Technical approach

- Auth uses Supabase email/password with email confirmation **disabled** (so you can sign up and immediately log in to test).
- Google OAuth enabled with redirect back to `/`.
- A signup trigger inserts into `profiles`, then checks `admin_seed`: if the email matches, inserts `(user_id, 'admin')` into `user_roles`; otherwise defaults to `'user'`.
- Role lookup happens once per session via the `AuthProvider` and is cached; UI components read from context.
- All role checks on the server are enforced by RLS using `has_role()` — UI hiding is just UX, not the security boundary.

### One thing I need from you

Please reply with the **email address** you want pre-seeded as the admin (the email you'll sign up with). Once you confirm, I'll implement everything in one pass.

