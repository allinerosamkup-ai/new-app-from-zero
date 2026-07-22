create extension if not exists pgcrypto;

create table if not exists public.routine_build_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','classified','needs_clarification','ready','applied','failed','cancelled')),
  stage text not null default 'source',
  source_type text,
  source_name text,
  source_mime text,
  source_hash text,
  source_text text,
  source_expires_at timestamptz,
  focus text not null,
  constraints jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  draft_plan jsonb,
  apply_result jsonb,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  week_start date not null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routine_build_sessions_user_status
  on public.routine_build_sessions(user_id, status, updated_at desc);
create index if not exists idx_routine_build_sessions_source_expiry
  on public.routine_build_sessions(source_expires_at)
  where source_text is not null;

alter table public.routine_build_sessions enable row level security;
drop policy if exists "routine_build_sessions_manage_own" on public.routine_build_sessions;
create policy "routine_build_sessions_manage_own" on public.routine_build_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
