create table if not exists public.objective_action_recovery_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  objective_id uuid not null references public.objectives(id) on delete cascade,
  lease_token text not null,
  lease_until timestamptz not null,
  retry_not_before timestamptz,
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_objective_action_recovery_claim unique (user_id, objective_id)
);

create index if not exists idx_objective_action_recovery_lease
  on public.objective_action_recovery_claims(lease_until);

create index if not exists idx_objective_action_recovery_retry
  on public.objective_action_recovery_claims(retry_not_before);

alter table public.objective_action_recovery_claims enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'objective_action_recovery_claims'
      and policyname = 'objective_action_recovery_claims_own_rows'
  ) then
    create policy objective_action_recovery_claims_own_rows
      on public.objective_action_recovery_claims
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
