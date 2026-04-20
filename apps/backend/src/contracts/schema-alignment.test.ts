import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260313103000_initial_public_schema.sql',
);

const migration = fs.readFileSync(migrationPath, 'utf8');
const timelineMetadataMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260412120000_add_timeline_block_metadata.sql'),
  'utf8',
);
const memoryRlsMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260412123000_enable_memory_embeddings_rls.sql'),
  'utf8',
);
const habitTargetsMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260412133000_add_habit_targets_and_persistent_reminders.sql'),
  'utf8',
);
const notificationPreferencesMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260412170000_add_notification_preferences.sql'),
  'utf8',
);
const gcalSelectedCalendarsMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260413190000_add_gcal_selected_calendars.sql'),
  'utf8',
);
const eventLogMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260420120000_add_event_logs.sql'),
  'utf8',
);

assert.match(migration, /suggestions\s+text\[\]/);
assert.match(migration, /age\s+integer/);
assert.match(migration, /current_feeling\s+text/);
assert.match(migration, /sleep_quality_note\s+text/);
assert.match(migration, /routine_text\s+text/);
assert.match(migration, /main_energy_pressure\s+text/);
assert.match(migration, /primary_goal\s+text/);
assert.match(migration, /ai_profile_summary\s+text/);
assert.match(migration, /ai_routine_summary\s+text/);
assert.match(migration, /ai_initial_state_summary\s+text/);
assert.match(migration, /ai_top_themes\s+text\[\]/);
assert.match(migration, /ai_initial_suggestions\s+text\[\]/);
assert.match(migration, /ai_profile_payload\s+jsonb/);

assert.match(timelineMetadataMigration, /note_mode\s+text/);
assert.match(timelineMetadataMigration, /note\s+text/);
assert.match(timelineMetadataMigration, /checklist\s+jsonb/);
assert.match(timelineMetadataMigration, /recurring\s+jsonb/);
assert.match(timelineMetadataMigration, /energy_level\s+text/);
assert.match(timelineMetadataMigration, /last_reset_date\s+date/);

assert.match(memoryRlsMigration, /memory_embeddings enable row level security/);
assert.match(memoryRlsMigration, /memory_embeddings_manage_own/);

assert.match(habitTargetsMigration, /target_count\s+integer/);
assert.match(habitTargetsMigration, /completion_count\s+integer/);
assert.match(habitTargetsMigration, /persistent_reminder_enabled\s+boolean/);
assert.match(habitTargetsMigration, /persistent_reminder_interval_minutes\s+integer/);

assert.match(notificationPreferencesMigration, /notification_preferences\s+jsonb/);
assert.match(notificationPreferencesMigration, /journalMorningTime/);
assert.match(notificationPreferencesMigration, /aiSuggestions/);
assert.match(gcalSelectedCalendarsMigration, /gcal_selected_calendars\s+jsonb/);
assert.match(eventLogMigration, /create table if not exists public\.event_logs/);
assert.match(eventLogMigration, /event_name\s+text/);
assert.match(eventLogMigration, /properties\s+jsonb/);
assert.match(eventLogMigration, /user_agent\s+text/);
assert.match(eventLogMigration, /create index if not exists event_logs_user_id_created_at_idx/);
assert.match(eventLogMigration, /create index if not exists event_logs_user_id_event_name_idx/);

console.log('schema alignment tests passed');
