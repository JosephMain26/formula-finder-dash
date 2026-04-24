create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users read own prefs"
  on public.user_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own prefs"
  on public.user_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own prefs"
  on public.user_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger update_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.update_updated_at_column();