alter table if exists public.timeline_blocks
  add column if not exists temporal_policy text not null default 'flexible',
  add column if not exists adaptation_permission text not null default 'eligible';

-- Eventos externos são âncoras rígidas, inclusive registros anteriores ao contrato.
update public.timeline_blocks
set
  temporal_policy = 'fixed',
  adaptation_permission = 'protected'
where gcal_event_id is not null;

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_temporal_policy_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_temporal_policy_check
  check (temporal_policy in ('fixed', 'windowed', 'flexible'));

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_adaptation_permission_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_adaptation_permission_check
  check (adaptation_permission in ('protected', 'preview', 'eligible'));
