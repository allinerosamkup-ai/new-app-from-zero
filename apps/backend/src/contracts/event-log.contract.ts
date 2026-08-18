import { z } from 'zod';

const MAX_EVENT_NAME_LENGTH = 80;
const MAX_PATH_LENGTH = 256;
const MAX_PROPERTY_STRING_LENGTH = 256;
const MAX_PROPERTY_DEPTH = 6;

const FORBIDDEN_PII_KEYS = new Set([
  'name', 'fullname', 'firstname', 'lastname', 'displayname', 'profilename', 'email', 'useremail',
  'phone', 'userphone', 'phonenumber', 'telefone', 'celular', 'cpf', 'cnpj', 'ssn', 'document',
  'documentnumber', 'address', 'street', 'zipcode', 'postalcode', 'birthdate', 'birthday', 'dob',
  'note', 'transcript', 'message', 'journal', 'diagnosis', 'symptomdetail',
]);

const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PhonePattern = /^\+?[0-9()\-\s]{7,20}$/;
const CpfPattern = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

type PropertyIssue = { path: (string | number)[]; message: string };

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function validateEventLogValue(value: unknown, path: (string | number)[] = [], depth = 0): PropertyIssue[] {
  const issues: PropertyIssue[] = [];
  if (depth > MAX_PROPERTY_DEPTH) return [{ path, message: 'properties depth is too deep' }];
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return issues;
  if (typeof value === 'string') {
    if (value.length > MAX_PROPERTY_STRING_LENGTH) issues.push({ path, message: 'properties strings must stay short' });
    if (EmailPattern.test(value) || PhonePattern.test(value) || CpfPattern.test(value)) {
      issues.push({ path, message: 'properties cannot contain direct PII values' });
    }
    return issues;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) issues.push(...validateEventLogValue(value[index], [...path, index], depth + 1));
    return issues;
  }
  if (isPlainObject(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (FORBIDDEN_PII_KEYS.has(normalizeKey(key))) {
        issues.push({ path: [...path, key], message: 'properties cannot contain personal-content fields' });
        continue;
      }
      issues.push(...validateEventLogValue(nestedValue, [...path, key], depth + 1));
    }
    return issues;
  }
  return [{ path, message: 'properties must be valid JSON' }];
}

const EventLogPropertiesSchema = z.unknown().superRefine((value, ctx) => {
  for (const issue of validateEventLogValue(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: issue.path });
});

export function validateEventLogProperties(value: unknown) {
  return EventLogPropertiesSchema.safeParse(value);
}

/** Compatibilidade para telemetria legada. Novos fluxos devem usar ProductEventCreateSchema. */
export const EventLogCreateSchema = z.object({
  eventName: z.string().trim().min(1).max(MAX_EVENT_NAME_LENGTH).regex(/^[A-Za-z][A-Za-z0-9._:-]*$/),
  properties: z.unknown().optional(),
  path: z.string().trim().min(1).max(MAX_PATH_LENGTH).regex(/^\/[^\s]*$/).optional(),
}).superRefine((value, ctx) => {
  if (value.properties === undefined) return;
  const result = validateEventLogProperties(value.properties);
  if (result.success) return;
  for (const issue of result.error.issues) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: ['properties', ...issue.path] });
});

const SurfaceSchema = z.enum(['checkin', 'home', 'patterns', 'journal', 'goals', 'checkin_result']);
const EntryPointSchema = z.enum(['home', 'navigation', 'deep_link', 'unknown']);
const FailureCodeSchema = z.enum(['network', 'offline', 'permission_denied', 'recognition_failed', 'validation', 'server', 'unknown']);
const DecisionFeedbackSchema = z.enum(['accepted', 'corrected', 'rejected', 'done', 'substituted']);
const EvidenceBandSchema = z.enum(['insufficient', 'limited', 'supported']);
const UUIDSchema = z.string().uuid();

const ProductEventPayloadSchema = z.discriminatedUnion('eventName', [
  z.object({ eventName: z.literal('checkin.opened.v1'), properties: z.object({ entryPoint: EntryPointSchema, hasPreviousCheckinToday: z.boolean() }).strict() }),
  z.object({ eventName: z.literal('checkin.optional_context_toggled.v1'), properties: z.object({ isOpen: z.boolean(), section: z.literal('context') }).strict() }),
  z.object({ eventName: z.literal('checkin.voice_requested.v1'), properties: z.object({}).strict() }),
  z.object({ eventName: z.literal('checkin.voice_failed.v1'), properties: z.object({ failureCode: FailureCodeSchema }).strict() }),
  z.object({ eventName: z.literal('checkin.submit_attempted.v1'), properties: z.object({ requiredFieldsComplete: z.boolean(), optionalFieldsCount: z.number().int().min(0).max(12), inputMode: z.enum(['manual', 'voice_assisted']) }).strict() }),
  z.object({ eventName: z.literal('checkin.validation_blocked.v1'), properties: z.object({ missingFieldCodes: z.array(z.enum(['mood', 'energy', 'factors'])).max(3) }).strict() }),
  z.object({ eventName: z.literal('checkin.completed.v1'), properties: z.object({ checkinId: UUIDSchema, hasOptionalContext: z.boolean(), inputMode: z.enum(['manual', 'voice_assisted']) }).strict() }),
  z.object({ eventName: z.literal('checkin.queued.v1'), properties: z.object({ idempotencyKey: UUIDSchema, retryCount: z.number().int().min(0).max(20), inputMode: z.enum(['manual', 'voice_assisted']) }).strict() }),
  z.object({ eventName: z.literal('checkin.save_failed.v1'), properties: z.object({ failureCode: FailureCodeSchema, retryable: z.boolean(), networkState: z.enum(['online', 'offline', 'unknown']) }).strict() }),
  z.object({ eventName: z.literal('home.opened.v1'), properties: z.object({ hasCheckinToday: z.boolean(), evidenceBand: EvidenceBandSchema }).strict() }),
  z.object({ eventName: z.literal('home.next_step_selected.v1'), properties: z.object({ destination: z.enum(['checkin', 'journal', 'goals', 'patterns']), sourceCard: z.enum(['reading', 'empty_state', 'quick_action', 'unknown']) }).strict() }),
  z.object({ eventName: z.literal('patterns.opened.v1'), properties: z.object({ evidenceBand: EvidenceBandSchema, observedDays: z.number().int().min(0).max(366) }).strict() }),
  z.object({ eventName: z.literal('patterns.report_requested.v1'), properties: z.object({ windowDays: z.number().int().min(7).max(90) }).strict() }),
  z.object({ eventName: z.literal('patterns.report_resolved.v1'), properties: z.object({ outcome: z.enum(['ready', 'failed']), failureCode: FailureCodeSchema.optional() }).strict() }),
  z.object({ eventName: z.literal('journal.opened.v1'), properties: z.object({ hasEntryToday: z.boolean() }).strict() }),
  z.object({ eventName: z.literal('journal.entry_saved.v1'), properties: z.object({ sessionId: UUIDSchema, hasGoalLink: z.boolean() }).strict() }),
  z.object({ eventName: z.literal('goals.opened.v1'), properties: z.object({ activeGoalsCount: z.number().int().min(0).max(100) }).strict() }),
  z.object({ eventName: z.literal('goal.created.v1'), properties: z.object({ goalId: UUIDSchema, creationMode: z.enum(['manual', 'suggestion']), hasDeadline: z.boolean() }).strict() }),
  z.object({ eventName: z.literal('goal.action_changed.v1'), properties: z.object({ goalId: UUIDSchema, actionId: UUIDSchema, changeType: z.enum(['created', 'completed', 'deferred', 'restored', 'edited']) }).strict() }),
  z.object({ eventName: z.literal('decision.presented.v1'), properties: z.object({ decisionId: UUIDSchema, evidenceBand: EvidenceBandSchema }).strict() }),
  z.object({ eventName: z.literal('decision.feedback_submitted.v1'), properties: z.object({ decisionId: UUIDSchema, feedback: DecisionFeedbackSchema }).strict() }),
]);

export const ProductEventCreateSchema = z.object({
  eventId: UUIDSchema,
  occurredAt: z.string().datetime({ offset: true }),
  surface: SurfaceSchema,
  path: z.string().trim().min(1).max(MAX_PATH_LENGTH).regex(/^\/[^\s]*$/).optional(),
}).and(ProductEventPayloadSchema).superRefine((value, ctx) => {
  const occurredAt = new Date(value.occurredAt).getTime();
  const now = Date.now();
  if (occurredAt > now + 10 * 60_000 || occurredAt < now - 31 * 24 * 60 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'occurredAt must be within the last 31 days and not in the future' });
  }
});

export type ProductEventCreateInput = z.infer<typeof ProductEventCreateSchema>;
export type EventLogCreateInput = z.infer<typeof EventLogCreateSchema>;
