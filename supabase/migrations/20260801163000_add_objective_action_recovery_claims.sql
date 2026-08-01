do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_objectives_user_id_id'
      and conrelid = 'public.objectives'::regclass
  ) then
    alter table public.objectives
      add constraint uq_objectives_user_id_id unique (user_id, id);
  end if;
end
$$;

create table if not exists public.objective_action_recovery_claims (
  id uuid default gen_random_uuid(),
  user_id uuid not null,
  objective_id uuid not null,
  lease_token text not null,
  lease_until timestamptz not null,
  retry_not_before timestamptz,
  attempts integer not null default 1,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.objective_action_recovery_claims
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists objective_id uuid,
  add column if not exists lease_token text default gen_random_uuid()::text,
  add column if not exists lease_until timestamptz default now(),
  add column if not exists retry_not_before timestamptz,
  add column if not exists attempts integer default 1,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.objective_action_recovery_claims
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column objective_id set not null,
  alter column lease_token set not null,
  alter column lease_until set not null,
  alter column attempts set default 1,
  alter column attempts set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'objective_action_recovery_claims_pkey'
      and conrelid = 'public.objective_action_recovery_claims'::regclass
  ) then
    alter table public.objective_action_recovery_claims
      add constraint objective_action_recovery_claims_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_objective_action_recovery_claim'
      and conrelid = 'public.objective_action_recovery_claims'::regclass
  ) then
    alter table public.objective_action_recovery_claims
      add constraint uq_objective_action_recovery_claim unique (user_id, objective_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'objective_action_recovery_attempts_positive'
      and conrelid = 'public.objective_action_recovery_claims'::regclass
  ) then
    alter table public.objective_action_recovery_claims
      add constraint objective_action_recovery_attempts_positive check (attempts > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_objective_action_recovery_owner'
      and conrelid = 'public.objective_action_recovery_claims'::regclass
  ) then
    alter table public.objective_action_recovery_claims
      add constraint fk_objective_action_recovery_owner
      foreign key (user_id, objective_id)
      references public.objectives(user_id, id)
      on delete cascade;
  end if;
end
$$;

create index if not exists idx_objective_action_recovery_lease
  on public.objective_action_recovery_claims(lease_until);

create index if not exists idx_objective_action_recovery_retry
  on public.objective_action_recovery_claims(retry_not_before);

alter table public.objective_action_recovery_claims enable row level security;

drop policy if exists objective_action_recovery_claims_own_rows
  on public.objective_action_recovery_claims;

revoke all on table public.objective_action_recovery_claims from public;
revoke all on table public.objective_action_recovery_claims from anon, authenticated;
grant select, insert, update, delete on table public.objective_action_recovery_claims to service_role;
