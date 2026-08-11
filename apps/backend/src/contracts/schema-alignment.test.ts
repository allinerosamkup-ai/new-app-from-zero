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
const timelineAdaptabilityMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260714180000_add_timeline_adaptability_contract.sql'),
  'utf8',
);
const timelineAdaptabilityProvenanceMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260714183000_add_timeline_adaptability_provenance.sql'),
  'utf8',
);
const canonicalMemoryMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260714200000_add_canonical_memory.sql'),
  'utf8',
);
const checkinMigrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260731120000_unify_checkin_signals.sql',
);
assert.ok(fs.existsSync(checkinMigrationPath), 'canonical check-in migration must exist');
const checkinMigration = fs.readFileSync(checkinMigrationPath, 'utf8');
const objectiveRecoveryMigration = fs.readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260801163000_add_objective_action_recovery_claims.sql'),
  'utf8',
);
const objectiveIntelligenceMigrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260811120000_add_objective_intelligence.sql',
);
assert.ok(fs.existsSync(objectiveIntelligenceMigrationPath), 'objective intelligence migration must exist');
const objectiveIntelligenceMigration = fs.readFileSync(objectiveIntelligenceMigrationPath, 'utf8');
const billingPartnersMigrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260810130000_add_billing_trials_and_professional_partners.sql',
);
assert.ok(fs.existsSync(billingPartnersMigrationPath), 'billing and professional partners migration must exist');
const billingPartnersMigration = fs.readFileSync(billingPartnersMigrationPath, 'utf8');
const prismaSchema = fs.readFileSync(
  path.resolve(__dirname, '../../../../packages/database/prisma/schema.prisma'),
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
assert.match(timelineAdaptabilityMigration, /temporal_policy\s+text\s+not null\s+default 'flexible'/);
assert.match(timelineAdaptabilityMigration, /adaptation_permission\s+text\s+not null\s+default 'eligible'/);
assert.match(timelineAdaptabilityMigration, /where gcal_event_id is not null/);
assert.match(timelineAdaptabilityMigration, /temporal_policy = 'fixed'/);
assert.match(timelineAdaptabilityMigration, /adaptation_permission = 'protected'/);
assert.match(timelineAdaptabilityProvenanceMigration, /adaptability_source\s+text\s+not null\s+default 'default'/);
assert.match(timelineAdaptabilityProvenanceMigration, /adaptability_confidence\s+double precision\s+not null\s+default 0\.5/);
assert.match(timelineAdaptabilityProvenanceMigration, /adaptability_source = 'gcal', adaptability_confidence = 1/);
assert.match(timelineAdaptabilityProvenanceMigration, /where gcal_event_id is not null/);
assert.match(timelineAdaptabilityProvenanceMigration, /adaptability_source = 'recurrence'/);
assert.match(timelineAdaptabilityProvenanceMigration, /adaptability_source = 'ai'/);
assert.match(timelineAdaptabilityProvenanceMigration, /adaptability_source = 'language'/);
assert.match(timelineAdaptabilityProvenanceMigration, /temporal_policy = 'windowed', adaptation_permission = 'preview'/);
assert.doesNotMatch(timelineAdaptabilityProvenanceMigration, /\(recurring->>'enabled'\)::boolean/);
assert.match(timelineAdaptabilityProvenanceMigration, /\(\^\|\[\^\[:alnum:\]_\]\)/);
assert.doesNotMatch('Paula networking', /(^|[^\p{L}\p{N}_])(aula|work)([^\p{L}\p{N}_]|$)/iu);
assert.match(canonicalMemoryMigration, /negative_state text check \(negative_state is null or negative_state in \('completed','rejected','deleted','scheduled'\)\)/);
assert.match(canonicalMemoryMigration, /foreign key \(memory_id, user_id\)/);
assert.match(canonicalMemoryMigration, /exists \([\s\S]*memory\.user_id = auth\.uid\(\)/);
assert.match(canonicalMemoryMigration, /insert into public\.user_memories[\s\S]*'legacy\.rag'/);
assert.match(canonicalMemoryMigration, /'none'/);
assert.match(canonicalMemoryMigration, /set memory_id = memory\.id/);
assert.match(canonicalMemoryMigration, /function public\.match_user_memories/);
assert.match(canonicalMemoryMigration, /create extension if not exists vector/);
assert.match(canonicalMemoryMigration, /create table if not exists public\.memory_embeddings/);
assert.match(canonicalMemoryMigration, /embedding vector\(1536\) not null/);
assert.match(canonicalMemoryMigration, /memory_embeddings_manage_own/);
assert.ok(
  canonicalMemoryMigration.indexOf('create table if not exists public.memory_embeddings')
    < canonicalMemoryMigration.indexOf('alter table public.memory_embeddings add column if not exists memory_id'),
  'clean migration creates memory_embeddings before altering/backfilling it',
);

assert.match(prismaSchema, /clarityScore\s+Int\?/);
assert.match(prismaSchema, /physicalScore\s+Int\?/);
assert.match(prismaSchema, /socialScore\s+Int\?/);
assert.match(prismaSchema, /source\s+String\s+@default\("screen"\)/);
assert.match(prismaSchema, /sourceMessageId\s+String\?\s+@map\("source_message_id"\)/);
assert.match(prismaSchema, /idempotencyKey\s+String\?\s+@map\("idempotency_key"\)/);
assert.match(prismaSchema, /signalMetadata\s+Json\?\s+@map\("signal_metadata"\)/);
assert.match(prismaSchema, /sleepHours\s+Float\?\s+@map\("sleep_hours"\)/);

assert.match(checkinMigration, /drop constraint if exists daily_checkins_slot_check/i);
assert.match(checkinMigration, /alter column clarity_score drop not null/i);
assert.match(checkinMigration, /alter column physical_score drop not null/i);
assert.match(checkinMigration, /alter column social_score drop not null/i);
assert.match(checkinMigration, /add column if not exists source text not null default 'screen'/i);
assert.match(checkinMigration, /add column if not exists source_message_id text/i);
assert.match(checkinMigration, /add column if not exists idempotency_key text/i);
assert.match(checkinMigration, /add column if not exists signal_metadata jsonb/i);
assert.match(checkinMigration, /add column if not exists sleep_hours double precision/i);
assert.match(checkinMigration, /create unique index if not exists idx_daily_checkins_user_idempotency/i);

assert.match(objectiveRecoveryMigration, /objective_action_recovery_claims enable row level security/i);
assert.match(objectiveRecoveryMigration, /unique\s*\(user_id,\s*id\)/i,
  'objective ownership must be addressable by a composite key');
assert.match(
  objectiveRecoveryMigration,
  /foreign key\s*\(user_id,\s*objective_id\)\s*references public\.objectives\s*\(user_id,\s*id\)\s*on delete cascade/i,
  'a claim cannot point to an objective owned by another user',
);
assert.doesNotMatch(objectiveRecoveryMigration, /references public\.objectives\s*\(id\)/i);
assert.doesNotMatch(objectiveRecoveryMigration, /create policy|auth\.uid\(\)|for all/i,
  'internal lease tokens must not be exposed through an authenticated-user RLS policy');
assert.match(objectiveRecoveryMigration, /revoke all on table public\.objective_action_recovery_claims from anon, authenticated/i);
assert.match(objectiveRecoveryMigration, /grant select, insert, update, delete on table public\.objective_action_recovery_claims to service_role/i);
assert.match(
  prismaSchema,
  /@@unique\(\[userId, id\], name: "uq_objectives_user_id_id", map: "uq_objectives_user_id_id"\)/,
);
assert.match(
  prismaSchema,
  /@@unique\(\[userId, objectiveId\], name: "uq_objective_action_recovery_claim", map: "uq_objective_action_recovery_claim"\)/,
);
assert.match(
  prismaSchema,
  /objective\s+Objective\s+@relation\(fields: \[userId, objectiveId\], references: \[userId, id\], onDelete: Cascade\)/,
);
for (const field of [
  'deadline',
  'pausedAt',
  'resultDefinition',
  'currentReality',
  'milestones',
  'pathVersion',
  'pathProposal',
  'pathProposalCreatedAt',
  'pathStatus',
  'pathQuestion',
]) {
  assert.match(prismaSchema, new RegExp(`\\b${field}\\b`), `Objective.${field} must exist`);
}
assert.match(prismaSchema, /primaryObjectiveId\s+String\?\s+@map\("primary_objective_id"\)\s+@db\.Uuid/);
assert.match(prismaSchema, /primaryObjective\s+Objective\?\s+@relation\("PrimaryObjective", fields: \[primaryObjectiveId\], references: \[id\], onDelete: SetNull\)/);
assert.match(prismaSchema, /primaryForUsers\s+UserPreference\[\]\s+@relation\("PrimaryObjective"\)/);
assert.match(prismaSchema, /deadline\s+DateTime\?\s+@db\.Date/);
assert.match(objectiveIntelligenceMigration, /add column if not exists deadline date/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists paused_at timestamptz/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists result_definition text/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists current_reality text/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists milestones jsonb/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists path_version integer/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists path_proposal jsonb/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists path_status text/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists path_question text/i);
assert.match(objectiveIntelligenceMigration, /add column if not exists primary_objective_id uuid/i);
assert.match(objectiveIntelligenceMigration, /foreign key \(primary_objective_id\) references public\.objectives\(id\) on delete set null/i);
assert.match(objectiveIntelligenceMigration, /update public\.objectives[\s\S]*'legacy-current'[\s\S]*path_status = 'ready'/i);

for (const table of [
  'billing_accounts',
  'professional_partners',
  'referral_attributions',
  'stripe_webhook_events',
]) {
  assert.match(
    billingPartnersMigration,
    new RegExp(`create table if not exists public\\.${table}`, 'i'),
    `${table} must be created by the billing migration`,
  );
}
for (const column of [
  'stripe_customer_id',
  'stripe_subscription_id',
  'referral_code',
  'referred_user_id',
  'stripe_event_id',
]) {
  assert.match(
    billingPartnersMigration,
    new RegExp(`unique[^;]*${column}|${column}[^;]*unique`, 'i'),
    `${column} must be protected by a unique constraint or index`,
  );
}
for (const table of ['billing_accounts', 'professional_partners', 'referral_attributions']) {
  assert.match(billingPartnersMigration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  assert.match(billingPartnersMigration, new RegExp(`create policy[^;]+${table}`, 'i'));
}
assert.match(billingPartnersMigration, /stripe_webhook_events enable row level security/i);
assert.match(billingPartnersMigration, /revoke all on table public\.stripe_webhook_events from anon, authenticated/i);
assert.match(prismaSchema, /model BillingAccount/);
assert.match(prismaSchema, /model ProfessionalPartner/);
assert.match(prismaSchema, /model ReferralAttribution/);
assert.match(prismaSchema, /model StripeWebhookEvent/);

console.log('schema alignment tests passed');
