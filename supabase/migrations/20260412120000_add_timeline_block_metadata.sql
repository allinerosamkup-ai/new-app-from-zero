alter table if exists public.timeline_blocks
  add column if not exists note_mode text not null default 'text',
  add column if not exists note text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists recurring jsonb not null default '{"enabled":false,"frequency":"daily","days":[],"everyNDays":1}'::jsonb,
  add column if not exists energy_level text default 'media',
  add column if not exists last_reset_date date;

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_note_mode_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_note_mode_check
  check (note_mode = any (array['text'::text, 'checklist'::text]));

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_energy_level_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_energy_level_check
  check (energy_level is null or energy_level = any (array['alta'::text, 'media'::text, 'leve'::text]));
