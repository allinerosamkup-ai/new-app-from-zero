alter table if exists public.timeline_blocks
  add column if not exists gcal_event_id text;

create index if not exists idx_timeline_blocks_gcal_event_id
  on public.timeline_blocks (gcal_event_id)
  where gcal_event_id is not null;
