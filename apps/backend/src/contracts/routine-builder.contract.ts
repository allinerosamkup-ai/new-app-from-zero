import { z } from 'zod';

export const RoutineItemKindSchema = z.enum(['goal', 'project', 'task', 'habit', 'calendar', 'reference', 'concern']);
export const RoutineItemReviewStateSchema = z.enum(['pending', 'confirmed', 'excluded']);
export const RoutineSessionStatusSchema = z.enum(['draft', 'classified', 'needs_clarification', 'ready', 'applying', 'applied', 'failed', 'cancelled']);

export const RoutineBuilderModeSchema = z.enum(['guided', 'import']);

const RoutineDayOfWeekSchema = z.number().int().min(0).max(6);
const RoutineTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

function timeInMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function validateTimeWindow(
  value: { startTime: string; endTime: string },
  context: z.RefinementCtx,
): void {
  if (timeInMinutes(value.endTime) <= timeInMinutes(value.startTime)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O horário final deve ser posterior ao horário inicial.',
      path: ['endTime'],
    });
  }
}

function uniqueStringSelection(maxItems: number) {
  return z.array(z.string().trim().min(1).max(80))
    .max(maxItems)
    .transform((values) => [...new Set(values)]);
}

const RoutineGuidedDaysSchema = z.array(RoutineDayOfWeekSchema)
  .max(7)
  .optional()
  .default([])
  .transform((values) => [...new Set(values)]);

export const RoutineGuidedHabitSchema = z.object({
  templateId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(3).max(120),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  daysOfWeek: RoutineGuidedDaysSchema,
  timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
  durationMinutes: z.number().int().min(5).max(180),
});

export const RoutineGuidedAvailabilitySchema = z.object({
  dayOfWeek: RoutineDayOfWeekSchema,
  startTime: RoutineTimeSchema,
  endTime: RoutineTimeSchema,
}).superRefine(validateTimeWindow);

export const RoutineGuidedFixedCommitmentSchema = z.object({
  title: z.string().trim().min(3).max(120),
  dayOfWeek: RoutineDayOfWeekSchema,
  startTime: RoutineTimeSchema,
  endTime: RoutineTimeSchema,
}).superRefine(validateTimeWindow);

export const RoutineGuidedAnswersSchema = z.object({
  lifeAreas: uniqueStringSelection(20),
  availability: z.array(RoutineGuidedAvailabilitySchema)
    .max(21)
    .optional()
    .default([])
    .transform((values) => [...new Map(
      values.map((value) => [`${value.dayOfWeek}:${value.startTime}:${value.endTime}`, value]),
    ).values()]),
  fixedCommitments: z.array(RoutineGuidedFixedCommitmentSchema)
    .max(50)
    .optional()
    .default([])
    .transform((values) => [...new Map(
      values.map((value) => [
        `${value.title.toLowerCase()}:${value.dayOfWeek}:${value.startTime}:${value.endTime}`,
        value,
      ]),
    ).values()]),
  energyDrains: uniqueStringSelection(30),
  energyRestorers: uniqueStringSelection(30),
  intentions: uniqueStringSelection(20),
  selectedHabits: z.array(RoutineGuidedHabitSchema)
    .max(30)
    .optional()
    .default([])
    .transform((values) => [...new Map(values.map((value) => [value.templateId, value])).values()]),
  currentState: z.object({
    mood: z.number().int().min(1).max(10),
    energy: z.number().int().min(1).max(10),
    focus: z.number().int().min(1).max(10),
    sleepQuality: z.string().trim().min(1).max(40),
  }),
  freeText: z.string().trim().max(2000).optional(),
});

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
  mode: RoutineBuilderModeSchema.optional().default('import'),
  focus: z.string().trim().min(3).max(500).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().trim().min(3).max(80),
  locale: z.string().trim().min(2).max(16).optional().default('pt-BR'),
  limits: RoutineLimitsSchema.optional().default({}),
}).superRefine((session, context) => {
  // No guiado o foco nasce das escolhas; na importação ainda precisa vir explícito.
  if (session.mode === 'import' && !session.focus) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A importação exige um foco com pelo menos 3 caracteres.',
      path: ['focus'],
    });
  }
});

export const RoutineUpdateItemsSchema = z.object({ items: z.array(RoutineClassifiedItemSchema).min(1).max(200) });
export const RoutineClarificationAnswerSchema = z.object({ questionId: z.string().min(1).max(80), answer: z.string().trim().min(1).max(1000) });
export const RoutineClarificationAnswersSchema = z.object({ answers: z.array(RoutineClarificationAnswerSchema).max(5) });

export type RoutineItemKind = z.infer<typeof RoutineItemKindSchema>;
export type RoutineClassifiedItem = z.infer<typeof RoutineClassifiedItemSchema>;
export type RoutineSessionStatus = z.infer<typeof RoutineSessionStatusSchema>;
export type RoutineBuilderMode = z.infer<typeof RoutineBuilderModeSchema>;
export type RoutineGuidedHabit = z.infer<typeof RoutineGuidedHabitSchema>;
export type RoutineGuidedAnswers = z.infer<typeof RoutineGuidedAnswersSchema>;
export type RoutineCreateSessionInput = z.input<typeof RoutineCreateSessionSchema>;
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
