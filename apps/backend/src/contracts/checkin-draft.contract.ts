import { z } from 'zod';

export const CheckinSignalProvenanceSchema = z.enum(['reported', 'inferred', 'absent']);

export const CheckinSignalObservationSchema = z.object({
  provenance: CheckinSignalProvenanceSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
});

export const CheckinSignalSchema = CheckinSignalObservationSchema.extend({
  value: z.number().int().min(1).max(10).nullable(),
}).superRefine((signal, context) => {
  if (signal.provenance === 'absent' && signal.value !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: 'absent signals must have a null value',
    });
  }
  if (signal.provenance !== 'absent' && signal.value === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: 'reported or inferred signals require a value',
    });
  }
});

/**
 * O que a pessoa respondeu sobre o dia e que não é um sinal de 1 a 10.
 *
 * Capacidade ("o que cabe hoje") e objetivo prioritário são perguntados no
 * check-in e definem o tamanho e o alvo do que a Airia sugere. Eram jogados
 * fora: viajavam só pelo estado de navegação até a tela de resultado e morriam
 * ao fechar o app. Pergunta que não vira dado é esforço cobrado à toa de quem
 * já está sem combustível.
 *
 * Entram aqui, na coluna Json que já existe, porque não têm forma de sinal
 * observado — não têm escala, provenance nem confiança. Colocá-los como
 * `CheckinSignalObservationSchema` seria forçar um formato que não descreve o
 * dado; coluna nova seria migração para um par de campos por check-in.
 */
export const CheckinDayPlanSchema = z.object({
  capacity: z.enum(['quick', 'moderate', 'heavy']).optional(),
  priorityGoalId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const CheckinSignalMetadataSchema = z.object({
  mood: CheckinSignalObservationSchema.optional(),
  energy: CheckinSignalObservationSchema.optional(),
  clarity: CheckinSignalObservationSchema.optional(),
  irritability: CheckinSignalObservationSchema.optional(),
  physical: CheckinSignalObservationSchema.optional(),
  social: CheckinSignalObservationSchema.optional(),
  sleepScore: CheckinSignalObservationSchema.optional(),
  dayPlan: CheckinDayPlanSchema.optional(),
  /**
   * De qual tela saiu o registro. `source` não resolve: diário e chat da Aura
   * são os dois `aura_text`.
   *
   * Faltava, e o custo foi alto. O diário já mandava `{ surface: 'journal' }`;
   * como o objeto é `.strict()`, o construtor de plano lançava, o `catch` mudo
   * do endpoint engolia, e a proposta de check-in do diário nunca chegou a
   * existir — junto com a de meta, que vinha depois no mesmo laço.
   */
  surface: z.enum(['journal', 'aura', 'screen']).optional(),
}).strict();

export const CheckinSourceSchema = z.enum(['screen', 'aura_text', 'aura_voice', 'mobile']);

export const CheckinDraftSchema = z.object({
  status: z.enum(['ready', 'needs_clarification', 'unsupported']),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occurredAt: z.string().datetime({ offset: true }),
  source: CheckinSourceSchema,
  sourceMessageId: z.string().trim().min(1).max(200).nullable(),
  idempotencyKey: z.string().trim().min(8).max(300).nullable(),
  rawText: z.string().trim().min(1).max(30_000).nullable(),
  note: z.string().trim().min(1).max(5_000).nullable(),
  emotions: z.array(z.string().trim().min(1).max(100)).max(3).default([]),
  factors: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  mood: CheckinSignalSchema,
  energy: CheckinSignalSchema,
  clarity: CheckinSignalSchema,
  irritability: CheckinSignalSchema,
  physical: CheckinSignalSchema,
  social: CheckinSignalSchema,
  sleepScore: CheckinSignalSchema,
  sleepHours: z.number().min(0).max(24).nullable(),
});

export type CheckinSignal = z.infer<typeof CheckinSignalSchema>;
export type CheckinDayPlan = z.infer<typeof CheckinDayPlanSchema>;
export type CheckinSignalMetadata = z.infer<typeof CheckinSignalMetadataSchema>;
export type CheckinSource = z.infer<typeof CheckinSourceSchema>;
export type CheckinDraft = z.infer<typeof CheckinDraftSchema>;
