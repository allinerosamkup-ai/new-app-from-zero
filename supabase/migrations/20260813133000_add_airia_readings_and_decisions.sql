-- Leitura operacional única da Airia: sinais preservados, estado atual,
-- trajetória intradiária, histórico, segurança e uma proposta confirmável.
alter table public.daily_checkins
  add column if not exists checkin_purpose text not null default 'window';

alter table public.daily_checkins
  drop constraint if exists daily_checkins_checkin_purpose_check,
  add constraint daily_checkins_checkin_purpose_check
    check (checkin_purpose in ('window', 'extra'));

create table if not exists public.airia_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  version integer not null default 1,
  fingerprint text not null,
  current_state jsonb not null default '{}'::jsonb,
  intraday jsonb not null default '{}'::jsonb,
  historical jsonb not null default '{}'::jsonb,
  risk_safety jsonb not null default '{}'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  source_checkin_id uuid references public.daily_checkins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create index if not exists idx_airia_readings_user_date
  on public.airia_readings (user_id, local_date desc);

create table if not exists public.airia_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reading_id uuid not null unique references public.airia_readings(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  status text not null default 'proposta'
    check (status in ('proposta', 'aceita', 'corrigida', 'rejeitada', 'concluída', 'substituída')),
  surface text not null default 'system',
  decision jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  valid_until timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_airia_decisions_user_status
  on public.airia_decisions (user_id, status, updated_at desc);
create index if not exists idx_airia_decisions_user_objective
  on public.airia_decisions (user_id, objective_id);

alter table public.airia_readings enable row level security;
alter table public.airia_decisions enable row level security;

drop policy if exists "airia_readings_user_isolation" on public.airia_readings;
create policy "airia_readings_user_isolation" on public.airia_readings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "airia_decisions_user_isolation" on public.airia_decisions;
create policy "airia_decisions_user_isolation" on public.airia_decisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_airia_readings_updated_at on public.airia_readings;
create trigger set_airia_readings_updated_at
  before update on public.airia_readings
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_airia_decisions_updated_at on public.airia_decisions;
create trigger set_airia_decisions_updated_at
  before update on public.airia_decisions
  for each row execute function public.update_updated_at_column();
