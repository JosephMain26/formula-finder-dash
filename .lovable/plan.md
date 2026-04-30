## Goal
Track clients (customers) used on jobs so you can reuse them later. Manage them on a dedicated page (create / edit / delete) and pick / auto-create them from the Add/Edit Job dialog. Technicians are not required to provide client info.

## 1. Database (1 migration)

Create `public.clients`:
- `id uuid pk default gen_random_uuid()`
- `name text not null`
- `phone text` (indexed, used for dedup)
- `email text`
- `address text`
- `notes text`
- `created_by uuid` (auth.uid of creator, nullable)
- `created_at`, `updated_at` timestamptz default now()
- Unique partial index on `lower(phone)` where phone is not null (prevents duplicates by phone).

RLS:
- SELECT: authenticated.
- INSERT: authenticated (any logged-in user; auto-creation from job form needs this).
- UPDATE: admins, managers, OR users with new permission `clients.edit`.
- DELETE: admins, OR users with new permission `clients.delete`.

Add `client_id uuid` column to `jobs` (nullable, no FK constraint to keep migration cheap — matches the existing pattern with company_id).

Add 2 permission rows to `permissions` table:
- `clients.edit` — Edit clients
- `clients.delete` — Delete clients

(Admins automatically pass both via the existing `has_permission` admin short-circuit.)

## 2. Clients page — `src/routes/clients.tsx`

A simple management page mirroring `installers.tsx` style:
- Table: Name, Phone, Email, Address, Notes, Actions
- "Add Client" button → dialog with the fields above
- Edit (pencil) and Delete (trash w/ AlertDialog confirm) per row, gated by `clients.edit` / `clients.delete`
- Search box (filter by name/phone/email client-side)

Add nav link "Clients" in `MobileNav.tsx` and the settings header next to Marketers/Technicians/Installers.

## 3. Job form integration — `src/components/AddJobDialog.tsx`

Add a **Client** picker (Combobox-style Select) above the existing customer-info fields:
- Loads `clients` on dialog open
- Selecting a client auto-fills `phone_no` and `address` (only if those fields are still empty, so it doesn't overwrite manual typing)
- "+ New client" option leaves selection empty — a new client will be created on submit (see below)
- Stores `client_id` in form state and saves it on the job payload

**Auto-save on submit (skipped for technicians):**
- New helper `isTechnician = roles.includes("user") && !isAdmin && !isManager` — actually simpler: skip auto-save when the user has the `user` role only and is not admin/manager. We'll expose `isTechOnly` from `auth-context` (one-line derivation).
- On submit, if not tech-only AND no `client_id` selected AND `phone_no` is filled:
  1. Look up an existing client by phone (`select id from clients where phone = ... limit 1`)
  2. If found → use its id
  3. If not → insert `{ name: address-derived-or-phone, phone, address }` and use the returned id
- The job payload then includes `client_id`. Tech users simply skip this entire block — their submit flow is unchanged.

If a client IS selected, just attach its id; no insert.

## 4. UI Surfaces

- Add "Clients" link to `MobileNav.tsx` and to the settings header buttons row (`src/routes/settings.tsx`).
- Use existing UI primitives only — no new dependencies.

## Technical Detail

```ts
// migration outline
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_phone_unique on public.clients (lower(phone)) where phone is not null;
alter table public.jobs add column if not exists client_id uuid;

-- RLS
alter table public.clients enable row level security;
create policy "auth view clients"   on public.clients for select to authenticated using (true);
create policy "auth insert clients" on public.clients for insert to authenticated with check (true);
create policy "edit clients"        on public.clients for update to authenticated
  using (has_role(auth.uid(),'admin') or has_role(auth.uid(),'manager') or has_permission(auth.uid(),'clients.edit'));
create policy "delete clients"      on public.clients for delete to authenticated
  using (has_role(auth.uid(),'admin') or has_permission(auth.uid(),'clients.delete'));

insert into public.permissions (key,label,description) values
  ('clients.edit','Edit clients','Allow editing client records'),
  ('clients.delete','Delete clients','Allow deleting client records')
on conflict (key) do nothing;
```

```ts
// AddJobDialog submit (added before insert/update)
if (!isTechOnly) {
  let cid = form.client_id || null;
  if (!cid && form.phone_no) {
    const { data: existing } = await supabase
      .from("clients").select("id").eq("phone", form.phone_no).maybeSingle();
    if (existing) cid = existing.id;
    else {
      const { data: ins } = await supabase.from("clients").insert({
        name: form.address?.split(",")[0] || form.phone_no,
        phone: form.phone_no, address: form.address || null,
      }).select("id").single();
      cid = ins?.id ?? null;
    }
  }
  payload.client_id = cid;
}
```

## Files Touched
- New: `supabase/migrations/<ts>_clients.sql`
- New: `src/routes/clients.tsx`
- Edited: `src/components/AddJobDialog.tsx` (client picker + auto-save block + form state)
- Edited: `src/lib/auth-context.tsx` (expose `isTechOnly`)
- Edited: `src/components/MobileNav.tsx`, `src/routes/settings.tsx` (nav link)

Total: 1 migration + 1 new page + 4 small edits — minimal credit usage. No new dependencies.

Reply **Approved** to implement.