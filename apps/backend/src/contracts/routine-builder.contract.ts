import { z } from 'zod';

export const RoutineItemKindSchema = z.enum(['goal', 'project', 'task', 'habit', 'calendar', 'reference', 'concern']);
export const RoutineItemReviewStateSchema = z.enum(['pending', 'confirmed', 'excluded']);
export const RoutineSessionStatusSchema = z.enum(['draft', 'classified', 'needs_clarification', 'ready', 'applying', 'applied', 'failed', 'cancelled']);

export const RoutineRecurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional().default([]),
  timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  interval: z.number().int().min(1).max(31).optional().default(1),
});

export const RoutineClassifiedItemSchema = z.object({
  id: z.string().min(1).max(80),
  kind: RoutineItemKindSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1200).nullable().optional(),
  sourceExcerpt: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  classificationReason: z.string().trim().max(280).nullable().optional(),
  reviewState: RoutineItemReviewStateSchema.optional().default('pending'),
  parentItemId: z.string().max(80).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  recurrence: RoutineRecurrenceSchema.nullable().optional(),
  isFixed: z.boolean().optional().default(false),
  duplicateOf: z.string().max(120).nullable().optional(),
});

export const RoutineUnavailableWindowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().trim().max(160).nullable().optional(),
});

export const RoutineLimitsSchema = z.object({
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().default('07:00'),
  sleepTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().default('23:00'),
  maxDailyLoadMinutes: z.number().int().min(30).max(720).optional().default(360),
  unavailable: z.array(RoutineUnavailableWindowSchema).max(30).optional().default([]),
});

const SUPPORTED_SOURCE_MIME = ['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] as const;

export const RoutineSourceSchema = z.object({
  sourceType: z.enum(['text', 'transcript', 'file']),
  fileName: z.string().trim().max(255).nullable().optional(),
  mimeType: z.enum(SUPPORTED_SOURCE_MIME).nullable().optional(),
  text: z.string().min(1).max(100_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
}).superRefine((source, context) => {
  if (source.sourceType === 'file' && (!source.fileName || !source.mimeType)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Arquivos exigem nome e tipo válidos.', path: ['fileName'] });
  }
});

export const RoutineCreateSessionSchema = z.object({
  focus: z.string().trim().min(3).max(500),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().trim().min(3).max(80),
  locale: z.string().trim().min(2).max(16).optional().default('pt-BR'),
  limits: RoutineLimitsSchema.optional().default({}),
});

export const RoutineUpdateItemsSchema = z.object({ items: z.array(RoutineClassifiedItemSchema).min(1).max(200) });
export const RoutineClarificationAnswerSchema = z.object({ questionId: z.string().min(1).max(80), answer: z.string().trim().min(1).max(1000) });
export const RoutineClarificationAnswersSchema = z.object({ answers: z.array(RoutineClarificationAnswerSchema).max(5) });

export type RoutineItemKind = z.infer<typeof RoutineItemKindSchema>;
export type RoutineClassifiedItem = z.infer<typeof RoutineClassifiedItemSchema>;
export type RoutineSessionStatus = z.infer<typeof RoutineSessionStatusSchema>;
export type RoutineCreateSessionInput = z.infer<typeof RoutineCreateSessionSchema>;
export type RoutineSource = z.infer<typeof RoutineSourceSchema>;

const TRANSITIONS: Record<RoutineSessionStatus, ReadonlySet<RoutineSessionStatus>> = {
  draft: new Set(['classified', 'failed', 'cancelled']),
  classified: new Set(['needs_clarification', 'ready', 'failed', 'cancelled']),
  needs_clarification: new Set(['classified', 'ready', 'failed', 'cancelled']),
  ready: new Set(['applying', 'classified', 'failed', 'cancelled']),
  applying: new Set(['applied', 'ready', 'failed']),
  applied: new Set(),
  failed: new Set(['draft', 'classified', 'cancelled']),
  cancelled: new Set(),
};

export function canTransitionRoutineSession(from: RoutineSessionStatus, to: RoutineSessionStatus): boolean {
  return TRANSITIONS[from].has(to);
}
