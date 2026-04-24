## Personalized Greeting Header (mobile/tablet/desktop friendly)

Replace the static "Jobs Dashboard" title with a time-aware, name-personalized greeting. Includes auto-refresh at hour boundaries (#1) and a personalized empty state (#2). Skips #3 (editable display name) per your instruction.

### Header layout
```
Good afternoon, Sarah 👋          [Parse]  [Add Job]
Admin · here is a quick overview
```
- Mobile (<640px): `text-xl`, role + subtitle wrap below, actions stay right-aligned.
- Tablet (640–1024px): `text-2xl`, role badge inline.
- Desktop (≥1024px): `text-3xl`, full layout with Settings + Sign-out buttons restored on the right.

### Files (3)

1. **`src/lib/auth-context.tsx`** — add `displayName: string | null` to context.
   - Fetch `display_name` from `profiles` alongside roles.
   - Fallback chain: `profiles.display_name` → `user_metadata.full_name` → `user_metadata.name` → capitalized email local-part.

2. **`src/routes/index.tsx`** — new greeting block + auto-refresh.
   - Greeting from `new Date().getHours()` (`<12` morning, `<18` afternoon, else evening).
   - Render greeting `<h1>`, role `<Badge>`, and "here is a quick overview" subtitle.
   - Remove the now-redundant top-right email/role block.
   - `useEffect` schedules a `setTimeout` to next top-of-hour to flip greeting without reload.

3. **`src/components/JobsTable.tsx`** — personalized empty state.
   - When filtered `jobs.length === 0`: "Nothing here yet, {firstName}. Add your first job to get started."

### Credit-saving notes
- Reuses existing auth fetch path and `useAuth()` hook — no new queries per render.
- Pure Tailwind responsive classes — no new CSS, no new packages, no DB changes.