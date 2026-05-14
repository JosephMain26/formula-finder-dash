# Make the Users tab fully responsive

The Users tab (`src/components/UsersManager.tsx`) currently breaks on phone screens: the invite row, user rows, and especially the Roles & Permissions matrix push controls off-screen or cause horizontal scrolling that hides headlines/buttons. This plan makes every section usable on a 360px phone with no hidden functionality.

## Scope

Only `src/components/UsersManager.tsx`. No business logic changes.

## Changes per section

**1. Data Visibility card**
- Switch from `flex items-start justify-between` to `flex-col sm:flex-row sm:items-start sm:justify-between` so the Switch sits below the description on phones instead of getting squeezed.

**2. Invite Users**
- Email input: keep `flex-1` but lower `min-w-[220px]` to `min-w-[180px]` so it doesn't force wrap awkwardly.
- Wrap role Select + Send button in a `flex gap-2 w-full sm:w-auto` group; make Select `flex-1 sm:w-40` so the row collapses to: [email full-width] / [role + send full-width] on small screens.
- Pending invite rows: stack the meta + action buttons vertically on mobile (`flex-col sm:flex-row sm:items-center`); keep Resend/Cancel side by side in their own row.

**3. Users list**
- Each row: change to `flex-col sm:flex-row sm:items-center` so name/email block sits on top, then a second row holds the role Select (full width on mobile), Edit, and Delete buttons. Use `w-full sm:w-32` on the role SelectTrigger and put Edit/Delete in a `flex gap-1 ml-auto` container.

**4. Roles & Permissions (biggest issue)**
- "New role" input + Add button: already wraps OK; make the Add button `whitespace-nowrap`.
- The matrix `<table>` is the worst offender — on a 360px screen, columns vanish behind horizontal scroll with no indication. Two-part fix:
  - Keep `overflow-x-auto` but add a sticky first column: `<th>`/`<td>` for the Permission name get `sticky left-0 bg-background z-10` (header `bg-muted/50`) so users can always see which permission they're toggling while scrolling roles horizontally.
  - Add `min-w-[110px]` to role headers so checkboxes don't crush together, and shrink padding on phones (`p-1.5 sm:p-2`).
  - Add a small hint above the table on mobile only: `<p className="text-xs text-muted-foreground sm:hidden">Scroll horizontally to see all roles →</p>`.

**5. Pre-seeded Admin Emails**
- Add `truncate min-w-0` to the email span so long emails don't push the trash button off-screen.
- Input + Add button row: make Add `shrink-0`.

**6. Edit Profile dialog**
- `DialogContent` currently `max-w-lg` — add `max-h-[90vh] overflow-y-auto` and `w-[calc(100%-2rem)]` so the dialog fits and scrolls on phones.

**7. Delete confirm AlertDialog**
- Add `w-[calc(100%-2rem)]` to `AlertDialogContent` for safe phone margins (shadcn default is fine width-wise but footer buttons can clip on 320px — already stacks via shadcn defaults, no change needed beyond width safety).

## Out of scope

- The settings page `TabsList` itself (already uses `w-max` inside what should be a horizontal scroller) — only touch if testing reveals the tab strip hides triggers. Quick fix if needed: wrap in `overflow-x-auto`.
- No DB, server function, or auth changes.

## Verification

After edits, view the Users tab at 360px and 414px in the preview to confirm: every headline visible, every button reachable, the permission matrix scrolls with sticky permission column, dialogs fit the viewport.
