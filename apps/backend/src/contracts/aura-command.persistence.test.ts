import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../../..');
const schema = fs.readFileSync(path.join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
const migrationPath = path.join(root, 'supabase/migrations/20260728150000_add_aura_command_center.sql');

assert.match(schema, /model AuraCommandSession\b/);
assert.match(schema, /model AuraCommandMessage\b/);
assert.match(schema, /model AuraCommandPlan\b/);
assert.match(schema, /model AuraCommandOperation\b/);
assert.match(schema, /model Capture\b/);
assert.match(schema, /gcalCalendarId\s+String\?/);
assert.match(schema, /gcalSyncStatus\s+String/);
assert.match(schema, /gcalWriteCalendarId\s+String\?/);

assert.equal(fs.existsSync(migrationPath), true, 'command center migration must exist');
const migration = fs.readFileSync(migrationPath, 'utf8');
assert.match(migration, /create table if not exists public\.aura_command_sessions/i);
assert.match(migration, /create table if not exists public\.captures/i);
assert.match(migration, /create unique index.*gcal.*calendar.*event/is);
assert.match(migration, /gcal_write_calendar_id/i);
assert.match(migration, /enable row level security/i);

console.log('aura-command persistence tests passed');
