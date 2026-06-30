-- Migration to fix missing columns in timeline_blocks table that are causing Prisma queries to fail.
-- These columns were added in schema.prisma but not applied to Supabase via migrations.

alter table if exists public.timeline_blocks
  add column if not exists alarm_enabled boolean default false,
  add column if not exists vibrate_enabled boolean default false,
  add column if not exists recurring_notification_enabled boolean default false,
  add column if not exists icon text,
  add column if not exists color text;
