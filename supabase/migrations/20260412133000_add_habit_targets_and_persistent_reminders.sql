alter table if exists public.habits
  add column if not exists target_count integer not null default 1,
  add column if not exists persistent_reminder_enabled boolean not null default false,
  add column if not exists persistent_reminder_interval_minutes integer;

alter table if exists public.habit_completions
  add column if not exists completion_count integer not null default 1;

alter table if exists public.timeline_blocks
  add column if not exists persistent_reminder_enabled boolean not null default false,
  add column if not exists persistent_reminder_interval_minutes integer;

alter table if exists public.habits
  drop constraint if exists habits_target_count_check;

alter table if exists public.habits
  add constraint habits_target_count_check
  check (target_count between 1 and 24);

alter table if exists public.habits
  drop constraint if exists habits_persistent_reminder_interval_check;

alter table if exists public.habits
  add constraint habits_persistent_reminder_interval_check
  check (
    persistent_reminder_interval_minutes is null
    or persistent_reminder_interval_minutes between 5 and 720
  );

alter table if exists public.habit_completions
  drop constraint if exists habit_completions_completion_count_check;

alter table if exists public.habit_completions
  add constraint habit_completions_completion_count_check
  check (completion_count >= 1);

alter table if exists public.timeline_blocks
  drop constraint if exists timeline_blocks_persistent_reminder_interval_check;

alter table if exists public.timeline_blocks
  add constraint timeline_blocks_persistent_reminder_interval_check
  check (
    persistent_reminder_interval_minutes is null
    or persistent_reminder_interval_minutes between 5 and 720
  );
