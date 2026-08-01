-- Canonical check-in contract shared by screen, Airia text, voice and mobile.
-- Existing rows are preserved; previously required neutral scores become truly optional.
alter table if exists public.daily_checkins
  drop constraint if exists daily_checkins_slot_check,
  alter column clarity_score drop not null,
  alter column physical_score drop not null,
  alter column social_score drop not null,
  add column if not exists sleep_hours double precision,
  add column if not exists source text not null default 'screen',
  add column if not exists source_message_id text,
  add column if not exists idempotency_key text,
  add column if not exists signal_metadata jsonb;

alter table if exists public.daily_checkins
  drop constraint if exists daily_checkins_source_check,
  drop constraint if exists daily_checkins_sleep_hours_check;

-- Older visual check-ins were stored as "manual". Keep that provenance while
-- moving them into the canonical screen source used by every current client.
update public.daily_checkins
set signal_metadata = coalesce(signal_metadata, '{}'::jsonb)
      || jsonb_build_object('legacySource', source),
    source = 'screen'
where source not in ('screen', 'aura_text', 'aura_voice', 'mobile');

alter table if exists public.daily_checkins
  add constraint daily_checkins_source_check
    check (source in ('screen', 'aura_text', 'aura_voice', 'mobile')),
  add constraint daily_checkins_sleep_hours_check
    check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24));

create unique index if not exists idx_daily_checkins_user_idempotency
  on public.daily_checkins (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_daily_checkins_user_source_message
  on public.daily_checkins (user_id, source, source_message_id)
  where source_message_id is not null;
