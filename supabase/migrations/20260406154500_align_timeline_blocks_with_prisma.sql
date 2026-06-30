alter table if exists public.timeline_blocks
  alter column duration_mins drop not null;

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_status_check;

update public.timeline_blocks
set status = case
  when status = 'pending' then 'planned'
  when status = 'done' then 'completed'
  when status = 'rescheduled' then 'postponed'
  when status = 'canceled' then 'postponed'
  else status
end;

alter table if exists public.timeline_blocks
  alter column status set default 'planned';

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_status_check
  check (status = any (array['planned'::text, 'completed'::text, 'postponed'::text]));
