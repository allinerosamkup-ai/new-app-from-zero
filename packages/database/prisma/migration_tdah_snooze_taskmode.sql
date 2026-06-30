-- Migration: TDAH Task Avoidance System — snoozed_until + task_mode
-- Run this in Supabase SQL Editor

ALTER TABLE timeline_blocks
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS task_mode TEXT NOT NULL DEFAULT 'standard';
