alter table public.objectives
  add constraint uq_objectives_user_id_id unique (user_id, id);

create table if not exists public.objective_action_recovery_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  objective_id uuid not null,
  lease_token text not null,
  lease_until timestamptz not null,
  retry_not_before timestamptz,
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_objective_action_recovery_claim unique (user_id, objective_id),
  constraint fk_objective_action_recovery_owner
    foreign key (user_id, objective_id)
    references public.objectives(user_id, id)
    on delete cascade
);

create index if not exists idx_objective_action_recovery_lease
  on public.objective_action_recovery_claims(lease_until);

create index if not exists idx_objective_action_recovery_retry
  on public.objective_action_recovery_claims(retry_not_before);

alter table public.objective_action_recovery_claims enable row level security;

revoke all on table public.objective_action_recovery_claims from public;
revoke all on table public.objective_action_recovery_claims from anon, authenticated;
grant select, insert, update, delete on table public.objective_action_recovery_claims to service_role;
