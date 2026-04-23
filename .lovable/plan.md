

## Add "Remember me" to login

Supabase already keeps users signed in across reloads and browser restarts by default. The toggle just lets users opt out — when **unchecked**, we sign them out when they close the tab.

### Changes (one file: `src/routes/auth.tsx`)

1. Add a **Remember me** checkbox below the password field on the Sign In form (default: checked).
2. On successful sign-in:
   - If **checked** → do nothing extra (default Supabase behavior — session persists across browser restarts via localStorage).
   - If **unchecked** → set a flag `sessionStorage.setItem('lovable.ephemeral', '1')`. A small listener in `__root.tsx` (or `auth-context.tsx`) reads this flag once on mount and registers a `beforeunload` handler that calls `supabase.auth.signOut()` when the tab closes.
3. Persist the user's last choice in `localStorage` so the checkbox remembers their preference next visit.

### Why this is the cheapest option

- No DB migration, no edge function, no new packages.
- `client.ts` is auto-generated and can't be edited, so we can't swap storage adapters at runtime — the `beforeunload` approach achieves the same UX (session ends on tab close) with ~15 lines of code.
- Two small edits: `src/routes/auth.tsx` (checkbox + flag) and `src/lib/auth-context.tsx` (one `useEffect` to register the unload handler).

### Files touched

- `src/routes/auth.tsx` — add checkbox, write flag on submit.
- `src/lib/auth-context.tsx` — add `useEffect` that signs out on tab close when the ephemeral flag is set.

