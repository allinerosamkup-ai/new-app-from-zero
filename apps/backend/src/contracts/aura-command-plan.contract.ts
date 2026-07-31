import { z } from 'zod';
import { CheckinSignalMetadataSchema, CheckinSourceSchema } from './checkin-draft.contract';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const OperationBase = {
  id: z.string().trim().min(1).max(120),
  status: z.enum(['proposed', 'pending', 'applied', 'failed', 'undone']).default('proposed'),
  selected: z.boolean().default(true),
};

const ChecklistItemSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(500),
  done: z.boolean().default(false),
});

const PlannerTaskOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('create_planner_task'),
  payload: z.object({
    title: z.string().trim().min(1).max(500),
    date: DateSchema,
    startTime: TimeSchema.nullable().optional(),
    durationMinutes: z.number().int().min(5).max(720).default(30),
    category: z.string().trim().min(1).max(80).default('pessoal'),
    note: z.string().trim().max(10000).nullable().optional(),
    checklist: z.array(ChecklistItemSchema).max(100).default([]),
    goalId: z.string().uuid().nullable().optional(),
  }),
});

const CalendarEventOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('create_calendar_event'),
  payload: z.object({
    title: z.string().trim().min(1).max(500),
    date: DateSchema,
    startTime: TimeSchema,
    durationMinutes: z.number().int().min(5).max(1440).default(60),
    calendarId: z.string().trim().min(1).max(500),
    location: z.string().trim().max(1000).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
  }),
});

const GoalOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('create_goal'),
  payload: z.object({
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(10000).nullable().optional(),
    category: z.string().trim().min(1).max(80).default('geral'),
    subgoals: z.array(ChecklistItemSchema).min(1).max(30),
    firstAction: z.object({
      title: z.string().trim().min(1).max(500),
      date: DateSchema,
      startTime: TimeSchema,
      durationMinutes: z.number().int().min(5).max(180),
    }).nullable().optional(),
  }),
});

const HabitOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('create_habit'),
  payload: z.object({
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).nullable().optional(),
    category: z.string().trim().min(1).max(80).default('geral'),
    frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    targetDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    durationMinutes: z.number().int().min(1).max(720).nullable().optional(),
    reminderTime: TimeSchema.nullable().optional(),
  }),
});

const CaptureOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('create_capture'),
  payload: z.object({
    kind: z.enum(['note', 'checklist']),
    title: z.string().trim().min(1).max(500),
    content: z.string().trim().max(30000).default(''),
    items: z.array(ChecklistItemSchema).max(200).default([]),
  }),
});

const CheckinOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('create_checkin'),
  payload: z.object({
    localDate: DateSchema,
    moodScore: z.number().int().min(1).max(10).nullable(),
    energyScore: z.number().int().min(1).max(10).nullable(),
    clarityScore: z.number().int().min(1).max(10).nullable(),
    irritabilityScore: z.number().int().min(1).max(10).nullable(),
    note: z.string().trim().max(5000).nullable().optional(),
    emotions: z.array(z.string().trim().min(1).max(100)).max(3).default([]),
  }),
});

const RecordCheckinOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('record_checkin'),
  payload: z.object({
    localDate: DateSchema,
    moodScore: z.number().int().min(1).max(10),
    energyScore: z.number().int().min(1).max(10),
    clarityScore: z.number().int().min(1).max(10).nullable().default(null),
    irritabilityScore: z.number().int().min(1).max(10).nullable().default(null),
    physicalScore: z.number().int().min(1).max(10).nullable().default(null),
    socialScore: z.number().int().min(1).max(10).nullable().default(null),
    sleepScore: z.number().int().min(1).max(10).nullable().default(null),
    sleepHours: z.number().min(0).max(24).nullable().default(null),
    note: z.string().trim().max(5000).nullable().optional(),
    emotions: z.array(z.string().trim().min(1).max(100)).max(3).default([]),
    factors: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
    source: CheckinSourceSchema,
    sourceMessageId: z.string().trim().min(1).max(200).nullable().default(null),
    idempotencyKey: z.string().trim().min(8).max(300).nullable().default(null),
    rawText: z.string().trim().min(1).max(30_000).nullable().default(null),
    signalMetadata: CheckinSignalMetadataSchema,
  }),
});

const ExistingItemOperationSchema = z.object({
  ...OperationBase,
  type: z.enum(['update_item', 'complete_item', 'delete_item']),
  payload: z.object({
    targetType: z.enum(['timeline', 'calendar_event', 'goal', 'habit', 'capture']),
    targetId: z.string().trim().min(1).max(500),
    calendarId: z.string().trim().min(1).max(500).nullable().optional(),
    changes: z.record(z.unknown()).default({}),
  }),
});

const JournalOperationSchema = z.object({
  ...OperationBase,
  type: z.literal('handoff_to_journal'),
  payload: z.object({
    content: z.string().trim().min(1).max(30000),
  }),
});

export const AuraCommandOperationSchema = z.union([
  PlannerTaskOperationSchema,
  CalendarEventOperationSchema,
  GoalOperationSchema,
  HabitOperationSchema,
  CaptureOperationSchema,
  CheckinOperationSchema,
  RecordCheckinOperationSchema,
  ExistingItemOperationSchema,
  JournalOperationSchema,
]);

export const AuraCommandPlanSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  sourceMessageId: z.string().uuid(),
  status: z.enum(['draft', 'proposed', 'applying', 'applied', 'partial', 'failed', 'cancelled']),
  executionPolicy: z.enum(['auto_apply', 'review_required', 'clarification']),
  confidence: z.number().min(0).max(1),
  assistantMessage: z.string().trim().min(1).max(10000),
  missingFields: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  operations: z.array(AuraCommandOperationSchema).max(50),
});

export const AuraCommandPlanApplySchema = z.object({
  operationIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const AuraCommandPlanPatchSchema = z.object({
  operations: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    selected: z.boolean().optional(),
    payload: z.record(z.unknown()).optional(),
  }).refine((item) => item.selected !== undefined || item.payload !== undefined, {
    message: 'selected or payload is required',
  })).min(1).max(50),
});

export type AuraCommandOperation = z.infer<typeof AuraCommandOperationSchema>;
export type AuraCommandPlan = z.infer<typeof AuraCommandPlanSchema>;
export type AuraCommandPlanApply = z.infer<typeof AuraCommandPlanApplySchema>;
export type AuraCommandPlanPatch = z.infer<typeof AuraCommandPlanPatchSchema>;
