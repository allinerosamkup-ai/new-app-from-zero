create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  path text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists event_logs_user_id_created_at_idx
  on public.event_logs (user_id, created_at desc);

create index if not exists event_logs_user_id_event_name_idx
  on public.event_logs (user_id, event_name);

alter table if exists public.event_logs enable row level security;

drop policy if exists "event_logs_manage_own" on public.event_logs;
create policy "event_logs_manage_own"
  on public.event_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
