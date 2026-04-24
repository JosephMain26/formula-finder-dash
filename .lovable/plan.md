## Plan: UX polish + per-user persisted preferences

### 1. Timezone dropdown + auto-detect (`src/components/MyProfileCard.tsx`)
- Replace the free-text `Input` for timezone with a searchable `Command` + `Popover` combobox.
- Source list from `Intl.supportedValuesOf("timeZone")` with a fallback static list for browsers that don't support it.
- On first load (no saved value), auto-fill with `Intl.DateTimeFormat().resolvedOptions().timeZone` so the user just confirms.
- Keep value as IANA string (e.g. `America/Los_Angeles`) — schema unchanged.

### 2. Mobile date picker fix (no auto-open on iOS/Android)
- **`src/components/AddJobDialog.tsx`**: Replace the native `<Input type="date">` for `job_date` with a Shadcn Datepicker (`Popover` + `Calendar`, `pointer-events-auto`). Native date inputs auto-trigger the OS picker when the dialog autofocuses them on iOS — the popover-based picker only opens when the trigger button is tapped.
- **`src/components/ExportReportDialog.tsx`**: Same swap for the `from`/`to` date inputs.
- Keep underlying values as `YYYY-MM-DD` strings so the rest of the codebase is unchanged.

### 3. Dashboard date presets (`src/components/DateRangePresets.tsx`)
- Add three built-in presets to the existing list:
  - **Today** — `from = to = today`
  - **This Month** — first day of current month → today
  - **This Year** — Jan 1 of current year → today
- Insert into the resolution logic and the dropdown UI alongside the existing presets. No schema changes.

### 4. Per-user persisted dashboard view
**Database migration** — new table `public.user_preferences`:
```sql
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "Users read own prefs" on public.user_preferences
  for select to authenticated using (auth.uid() = user_id);
create policy "Users upsert own prefs" on public.user_preferences
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own prefs" on public.user_preferences
  for update to authenticated using (auth.uid() = user_id);
```

**New helper `src/lib/userPrefs.ts`**:
- `loadUserPrefs()` — fetch row for current user, return parsed `prefs` JSON (or `{}`).
- `saveUserPrefs(partial)` — debounced (~600ms) upsert that deep-merges the partial into existing prefs.
- Writes-through to `localStorage` as instant cache so the UI hydrates immediately on next login while the network round-trip happens in background.

**Wire into existing components** (load on mount, save on change):
- `src/routes/index.tsx` — date range, active filters, sort state.
- `src/components/AnalyticsPanel.tsx` — chart visibility / selected views.
- `src/components/ColumnToggle.tsx` — currently uses `localStorage` for active dashboard view id; switch to `userPrefs` so it follows the user across devices/logouts. Existing `dashboardViews` templates in `app_settings` stay shared (admin-managed); only the *active selection* moves to per-user.

**Prefs JSON shape** (single source of truth):
```ts
{
  dashboard: {
    activeViewId?: string,
    visibleColumns?: ColumnKey[],     // ad-hoc override when no template active
    dateRange?: { from: string; to: string; presetId?: string },
    filters?: Record<string, unknown>,
  },
  analytics: {
    visibleCharts?: string[],
    timeBucket?: 'day' | 'week' | 'month',
  }
}
```

### Files to create / edit
- **Create**: `src/lib/userPrefs.ts`, new migration for `user_preferences`.
- **Edit**: `MyProfileCard.tsx`, `AddJobDialog.tsx`, `ExportReportDialog.tsx`, `DateRangePresets.tsx`, `routes/index.tsx`, `AnalyticsPanel.tsx`, `ColumnToggle.tsx`.

### Out of scope (intentionally cheap)
- No redesign of dashboard / analytics — just persistence wiring.
- No migration of existing `localStorage` keys for other users; current users will simply re-pick their view once and it then persists forever.

Reply **Approved** to implement, or tell me which of the four items to skip.