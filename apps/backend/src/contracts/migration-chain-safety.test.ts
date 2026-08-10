import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const rlsName = '20260412123000_enable_memory_embeddings_rls.sql';
const canonicalName = '20260714200000_add_canonical_memory.sql';
const checkinName = '20260731120000_unify_checkin_signals.sql';
const authProfileName = '20260801002000_ensure_auth_profiles.sql';
const objectiveRecoveryName = '20260801163000_add_objective_action_recovery_claims.sql';
const billingPartnersName = '20260810130000_add_billing_trials_and_professional_partners.sql';
const rlsIndex = migrations.indexOf(rlsName);
const canonicalIndex = migrations.indexOf(canonicalName);
const checkinIndex = migrations.indexOf(checkinName);
const authProfileIndex = migrations.indexOf(authProfileName);
const objectiveRecoveryIndex = migrations.indexOf(objectiveRecoveryName);
const billingPartnersIndex = migrations.indexOf(billingPartnersName);

assert.ok(rlsIndex >= 0 && canonicalIndex >= 0 && rlsIndex < canonicalIndex,
  'the legacy memory RLS migration runs before the canonical migration creates memory_embeddings');
assert.ok(checkinIndex > canonicalIndex,
  'the canonical check-in migration must run after the existing command-center migrations');
assert.ok(authProfileIndex > checkinIndex,
  'the authenticated profile repair must run after the canonical check-in migration');
assert.ok(objectiveRecoveryIndex > authProfileIndex,
  'objective recovery claims must run after profile repair');
assert.ok(billingPartnersIndex > objectiveRecoveryIndex,
  'billing and professional partner tables must run after the existing profile-owned schema');

const legacyRls = fs.readFileSync(path.join(migrationsDir, rlsName), 'utf8');
assert.match(legacyRls, /to_regclass\('public\.memory_embeddings'\) is not null/i,
  'the earlier migration must explicitly guard the whole policy operation when the table is absent');
assert.match(legacyRls, /execute\s+'drop policy if exists "memory_embeddings_manage_own" on public\.memory_embeddings'/i);
assert.match(legacyRls, /execute\s+'create policy "memory_embeddings_manage_own"/i);

const checkinMigration = fs.readFileSync(path.join(migrationsDir, checkinName), 'utf8');
const authProfileMigration = fs.readFileSync(path.join(migrationsDir, authProfileName), 'utf8');
const objectiveRecoveryMigration = fs.readFileSync(path.join(migrationsDir, objectiveRecoveryName), 'utf8');
const billingPartnersMigration = fs.readFileSync(path.join(migrationsDir, billingPartnersName), 'utf8');
const deployScript = fs.readFileSync(
  path.resolve(__dirname, '../../../../deploy/airia/deploy.sh'),
  'utf8',
);
assert.match(checkinMigration, /where idempotency_key is not null/i,
  'nullable idempotency keys need a partial unique index');
assert.match(checkinMigration, /jsonb_build_object\('legacySource', source\)/i,
  'legacy manual sources must be preserved in metadata before normalization');
assert.ok(
  checkinMigration.indexOf("update public.daily_checkins")
    < checkinMigration.indexOf("add constraint daily_checkins_source_check"),
  'legacy sources must be normalized before the canonical source constraint is added',
);
assert.doesNotMatch(checkinMigration, /drop table|truncate/i,
  'the migration must preserve existing check-in history');
assert.match(authProfileMigration, /create or replace function public\.handle_new_user/i);
assert.match(authProfileMigration, /create trigger on_auth_user_created/i);
assert.match(authProfileMigration, /insert into public\.profiles[\s\S]*from auth\.users/i,
  'existing authenticated users without a public profile must be backfilled');

const deployedCheckinIndex = deployScript.indexOf(checkinName);
const deployedAuthProfileIndex = deployScript.indexOf(authProfileName);
const deployedObjectiveRecoveryIndex = deployScript.indexOf(objectiveRecoveryName);
const deployedBillingPartnersIndex = deployScript.indexOf(billingPartnersName);
assert.ok(
  deployedCheckinIndex >= 0
    && deployedAuthProfileIndex > deployedCheckinIndex
    && deployedObjectiveRecoveryIndex > deployedAuthProfileIndex
    && deployedBillingPartnersIndex > deployedObjectiveRecoveryIndex,
  'deploy must apply billing partners after its database prerequisites',
);
assert.match(objectiveRecoveryMigration, /create table if not exists public\.objective_action_recovery_claims/i);
for (const column of [
  'id',
  'user_id',
  'objective_id',
  'lease_token',
  'lease_until',
  'retry_not_before',
  'attempts',
  'last_error',
  'created_at',
  'updated_at',
]) {
  assert.match(
    objectiveRecoveryMigration,
    new RegExp(`add column if not exists ${column}\\b`, 'i'),
    `reapplying the migration must repair a previous claims table missing ${column}`,
  );
}
assert.match(
  objectiveRecoveryMigration,
  /do \$\$[\s\S]*pg_constraint[\s\S]*uq_objectives_user_id_id[\s\S]*end[\s\S]*\$\$;/i,
  'the objective ownership unique constraint must be guarded by pg_constraint',
);
assert.match(
  objectiveRecoveryMigration,
  /do \$\$[\s\S]*pg_constraint[\s\S]*fk_objective_action_recovery_owner[\s\S]*end[\s\S]*\$\$;/i,
  'the composite ownership foreign key must be guarded by pg_constraint',
);
assert.match(objectiveRecoveryMigration, /create index if not exists idx_objective_action_recovery_lease/i);
assert.match(objectiveRecoveryMigration, /alter table public\.objective_action_recovery_claims enable row level security/i);
assert.match(objectiveRecoveryMigration, /revoke all on table public\.objective_action_recovery_claims from anon, authenticated/i);
assert.match(objectiveRecoveryMigration, /grant select, insert, update, delete on table public\.objective_action_recovery_claims to service_role/i);
assert.doesNotMatch(billingPartnersMigration, /drop table|truncate/i,
  'billing migration must preserve existing user and subscription history');
assert.match(billingPartnersMigration, /alter table public\.stripe_webhook_events enable row level security/i);
assert.match(billingPartnersMigration, /revoke all on table public\.stripe_webhook_events from anon, authenticated/i);

console.log('migration chain safety tests passed');
