import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const rlsName = '20260412123000_enable_memory_embeddings_rls.sql';
const canonicalName = '20260714200000_add_canonical_memory.sql';
const checkinName = '20260731120000_unify_checkin_signals.sql';
const rlsIndex = migrations.indexOf(rlsName);
const canonicalIndex = migrations.indexOf(canonicalName);
const checkinIndex = migrations.indexOf(checkinName);

assert.ok(rlsIndex >= 0 && canonicalIndex >= 0 && rlsIndex < canonicalIndex,
  'the legacy memory RLS migration runs before the canonical migration creates memory_embeddings');
assert.ok(checkinIndex > canonicalIndex,
  'the canonical check-in migration must run after the existing command-center migrations');

const legacyRls = fs.readFileSync(path.join(migrationsDir, rlsName), 'utf8');
assert.match(legacyRls, /to_regclass\('public\.memory_embeddings'\) is not null/i,
  'the earlier migration must explicitly guard the whole policy operation when the table is absent');
assert.match(legacyRls, /execute\s+'drop policy if exists "memory_embeddings_manage_own" on public\.memory_embeddings'/i);
assert.match(legacyRls, /execute\s+'create policy "memory_embeddings_manage_own"/i);

const checkinMigration = fs.readFileSync(path.join(migrationsDir, checkinName), 'utf8');
assert.match(checkinMigration, /where idempotency_key is not null/i,
  'nullable idempotency keys need a partial unique index');
assert.doesNotMatch(checkinMigration, /drop table|truncate/i,
  'the migration must preserve existing check-in history');

console.log('migration chain safety tests passed');
