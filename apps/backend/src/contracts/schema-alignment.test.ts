import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260313103000_initial_public_schema.sql',
);

const migration = fs.readFileSync(migrationPath, 'utf8');

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

console.log('schema alignment tests passed');
