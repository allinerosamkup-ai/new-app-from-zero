import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PRIVACY_EXPORT_ALLOWLIST } from '../services/privacy-redaction.allowlist';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const schema = readFileSync(path.join(repoRoot, 'packages', 'database', 'prisma', 'schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(repoRoot, 'supabase', 'migrations', '20260722160000_add_routine_build_sessions.sql'),
  'utf8',
);

assert.match(schema, /model RoutineBuildSession\s*\{/);
assert.match(schema, /routineBuildSessions\s+RoutineBuildSession\[\]/);
assert.match(schema, /sourceText\s+String\?/);
assert.match(schema, /sourceExpiresAt\s+DateTime\?/);
assert.match(schema, /applyResult\s+Json\?/);
assert.match(schema, /@@map\("routine_build_sessions"\)/);

const allowlist = PRIVACY_EXPORT_ALLOWLIST.RoutineBuildSession;
assert.ok(allowlist, 'RoutineBuildSession must be classified for privacy export');
assert.ok(allowlist.include.includes('sourceText'), 'sourceText belongs to the user export');
assert.ok(allowlist.include.includes('items'));
assert.ok(allowlist.include.includes('draftPlan'));

assert.match(migration, /create table if not exists public\.routine_build_sessions/i);
assert.match(migration, /references public\.profiles\s*\(id\)\s+on delete cascade/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /auth\.uid\(\)\s*=\s*user_id/i);
assert.match(migration, /source_expires_at/i);

console.log('routine-builder persistence tests passed');
