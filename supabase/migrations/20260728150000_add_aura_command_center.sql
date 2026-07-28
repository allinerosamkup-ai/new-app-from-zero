alter table public.user_preferences
  add column if not exists gcal_write_calendar_id text;

create table if not exists public.aura_command_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_command_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aura_command_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_command_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aura_command_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_message_id uuid not null references public.aura_command_messages(id) on delete cascade,
  status text not null default 'draft',
  execution_policy text not null,
  confidence double precision not null,
  assistant_message text not null,
  missing_fields text[] not null default '{}',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_command_operations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.aura_command_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_operation_id text not null,
  type text not null,
  status text not null default 'proposed',
  selected boolean not null default true,
  payload jsonb not null,
  result jsonb,
  error jsonb,
  idempotency_key text unique,
  applied_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, client_operation_id)
);

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('note', 'checklist')),
  title text not null,
  content text not null default '',
  items jsonb not null default '[]'::jsonb,
  status text not null default 'inbox' check (status in ('inbox', 'completed', 'archived')),
  source_operation_id uuid unique references public.aura_command_operations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.timeline_blocks
  add column if not exists gcal_calendar_id text,
  add column if not exists gcal_sync_status text not null default 'not_applicable',
  add column if not exists source_command_operation_id uuid references public.aura_command_operations(id) on delete set null;

update public.timeline_blocks
set
  gcal_calendar_id = coalesce(gcal_calendar_id, 'primary'),
  gcal_sync_status = 'synced'
where gcal_event_id is not null;

create unique index if not exists uq_timeline_gcal_calendar_event
  on public.timeline_blocks(user_id, gcal_calendar_id, gcal_event_id)
  where gcal_event_id is not null and gcal_calendar_id is not null;
create unique index if not exists uq_timeline_source_command_operation
  on public.timeline_blocks(source_command_operation_id)
  where source_command_operation_id is not null;

create index if not exists idx_aura_command_sessions_user_updated
  on public.aura_command_sessions(user_id, updated_at desc);
create index if not exists idx_aura_command_messages_session_created
  on public.aura_command_messages(session_id, created_at);
create index if not exists idx_aura_command_plans_session_status
  on public.aura_command_plans(session_id, status);
create index if not exists idx_aura_command_operations_user_status
  on public.aura_command_operations(user_id, status, updated_at desc);
create index if not exists idx_captures_user_status
  on public.captures(user_id, status, created_at desc);

alter table public.aura_command_sessions enable row level security;
alter table public.aura_command_messages enable row level security;
alter table public.aura_command_plans enable row level security;
alter table public.aura_command_operations enable row level security;
alter table public.captures enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'aura_command_sessions',
    'aura_command_messages',
    'aura_command_plans',
    'aura_command_operations',
    'captures'
  ]
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_own_rows'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        table_name || '_own_rows',
        table_name
      );
    end if;
  end loop;
end
$$;
