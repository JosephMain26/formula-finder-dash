## Goal
1. Link technicians to a system user (so each tech row can map to a user/role).
2. Add an editable 6-digit **pincode** per technician (admin or the tech themselves can edit).
3. On the **remote upload** page, require entering a pincode → that locks the **Technician** field to the matching tech, and the submitted job records *who* added it.
4. Show "Added by" on the resulting job (visible in the jobs list / when viewed via remote link context).

---

## 1. Database migration (single file)
- `ALTER TABLE public.technicians ADD COLUMN user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;`
- `ALTER TABLE public.technicians ADD COLUMN pincode text NULL;`
- `ALTER TABLE public.technicians ADD CONSTRAINT technicians_pincode_format CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$');`
- Unique partial index so two techs can't share a pincode: `CREATE UNIQUE INDEX technicians_pincode_unique ON public.technicians (pincode) WHERE pincode IS NOT NULL;`
- New RPC (SECURITY DEFINER) used by the public upload page:
  ```sql
  create or replace function public.lookup_tech_by_pincode(_pin text)
  returns table(id uuid, tech_name text)
  language sql stable security definer set search_path = public as $$
    select id, tech_name from public.technicians
    where pincode = _pin limit 1;
  $$;
  grant execute on function public.lookup_tech_by_pincode(text) to anon, authenticated;
  ```
  This avoids exposing the whole pincode column via RLS while still allowing pincode validation from the unauthenticated `/upload` page.
- RLS for the new columns stays under existing technicians policies (already permissive for read; updates are allowed for authenticated). No policy change needed.

## 2. `src/routes/technicians.tsx`
- Add columns **User** (linked profile) and **Pincode** to the table.
- In `TechnicianDialog`:
  - `user_id` → searchable Select populated from `profiles` (id + display_name/email). Allow "— None —".
  - `pincode` → numeric Input (maxLength 6, pattern `\d{6}`) with a small "Generate" button (`Math.floor(100000 + Math.random()*900000)`).
  - Validate uniqueness client-side via the unique index error → toast.
- Show pincode masked by default with a 👁 toggle; admins always see it.

## 3. `src/components/MyProfileCard.tsx` (tech self-edit)
- If the current user is linked to a technician row (`technicians.user_id = auth.uid()`), show a **"My remote pincode"** field they can view/edit (same 6-digit validation + Generate button). One row update via `.eq("user_id", uid)`.

## 4. `src/routes/upload.tsx` (the public page)
- Add a **PIN gate** at the top of both tabs (Parse & Manual): a single 6-digit input.
- On change, when length === 6, call `supabase.rpc("lookup_tech_by_pincode", { _pin })`.
  - If found → store `{ tech_id, tech_name }` in state, lock the Technician select to that name (disabled, value preset).
  - If not found → show "Invalid pincode" and disable Submit.
- `buildPayload` updates:
  - `tech_name`: forced to the matched tech.
  - `created_by`: change marker from `"remote_link"` to `` `remote_link:${tech_name}` `` so admins immediately see *who* submitted.
- Pincode is required to submit (block both Parse and Manual submit buttons until a tech is matched).

## 5. `src/components/JobsTable.tsx` (display "Added by")
- The `created_by` column already exists. Add a small visual treatment: if value starts with `remote_link:`, render badge `Remote · {name}`; else render the raw value. No schema change.
- Also expose it in the column toggle list if not already.

## 6. `src/components/RemoteLinkButton.tsx`
- Update the helper text in the popover: *"Recipients will need their personal 6-digit pincode (set in Technicians) to submit. Submissions are tagged with their name automatically."*

## 7. `src/components/UsersManager.tsx`
- No structural change required for the role linking itself (roles still live in `user_roles`). But add a small badge next to each user showing "Tech: {tech_name}" when a `technicians.user_id` row is linked, so admins can see the connection at a glance. (One extra query in `load()`.)

---

## Files touched
- **New migration**: `supabase/migrations/<timestamp>_tech_user_link_and_pincode.sql`
- **Edited**: `src/routes/technicians.tsx`, `src/routes/upload.tsx`, `src/components/MyProfileCard.tsx`, `src/components/JobsTable.tsx`, `src/components/RemoteLinkButton.tsx`, `src/components/UsersManager.tsx`

## Out of scope (to keep credit usage low)
- No new "Tech portal" page — the existing pincode + remote upload flow is enough.
- No changes to the in-app `AddJobDialog` flow (already authenticated, already records `created_by`).
- No SMS/email delivery of the pincode — admin shares it manually or the tech sees it on their profile card.

Reply **Approved** to implement, or tell me which steps to drop.