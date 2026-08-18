-- Eventos de produto do núcleo ativo: contratos versionados, idempotência e retenção.
alter table public.event_logs
  add column if not exists event_id uuid,
  add column if not exists event_version smallint,
  add column if not exists occurred_at timestamptz,
  add column if not exists surface text,
  add column if not exists expires_at timestamptz;

update public.event_logs
set occurred_at = coalesce(occurred_at, created_at),
    expires_at = coalesce(expires_at, created_at + interval '180 days')
where occurred_at is null or expires_at is null;

alter table public.event_logs
  alter column occurred_at set default timezone('utc', now()),
  alter column expires_at set default (timezone('utc', now()) + interval '180 days'),
  alter column occurred_at set not null,
  alter column expires_at set not null;

create unique index if not exists event_logs_user_id_event_id_unique
  on public.event_logs (user_id, event_id)
  where event_id is not null;

create index if not exists event_logs_expires_at_idx
  on public.event_logs (expires_at)
  where event_id is not null;

alter table public.event_logs enable row level security;
drop policy if exists "event_logs_manage_own" on public.event_logs;
create policy "event_logs_manage_own"
  on public.event_logs
  for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.purge_expired_product_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.event_logs
  where event_id is not null
    and expires_at < timezone('utc', now());
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.purge_expired_product_events() from public, anon, authenticated;
grant execute on function public.purge_expired_product_events() to service_role;
