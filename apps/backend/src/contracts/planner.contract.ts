import { z } from 'zod';

import {
  AdaptationPermissionSchema,
  AdaptabilitySourceSchema,
  resolveTimelineAdaptability,
  resolveTimelineAdaptabilityProvenance,
  TemporalPolicySchema,
  TimelineBlockSchema,
} from '../services/planner.service';

export const PlannerSyncSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forceSave: z.boolean().default(false),
  blocks: z.array(TimelineBlockSchema),
});

export type PlannerSyncInput = z.infer<typeof PlannerSyncSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Planner AI Suggestions — Frente 1 da Sprint Agenda Adaptativa
// Endpoint dedicado /api/ai/planner-suggestions retorna propostas (NÃO persiste)
// O frontend confirma bloco-a-bloco via cards (aceitar/rejeitar/adiar).
// ────────────────────────────────────────────────────────────────────────────

const PlannerCategorySchema = z.enum(['trabalho', 'pessoal', 'autocuidado', 'social', 'outro']);
const PlannerIntensitySchema = z.enum(['L', 'M', 'P']);

export const PlannerAISuggestionExistingBlockSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  category: z.string().optional().default('outro'),
  intensity: PlannerIntensitySchema.optional().default('M'),
  status: z.enum(['planned', 'completed', 'postponed', 'cancelled']).optional().default('planned'),
  gcalEventId: z.string().optional().nullable(),
  temporalPolicy: TemporalPolicySchema.optional().default('flexible'),
  adaptationPermission: AdaptationPermissionSchema.optional().default('eligible'),
  adaptabilitySource: AdaptabilitySourceSchema.optional().default('default'),
  adaptabilityConfidence: z.number().min(0).max(1).optional().default(0.5),
}).transform((block) => ({
  ...block,
  ...resolveTimelineAdaptability(block),
  ...resolveTimelineAdaptabilityProvenance(block),
}));

export const PlannerAIEnergyStateSchema = z.object({
  label: z.string().max(200),
  // analysis aceita texto longo do MoodCycleEngine (até ~800 chars). Fix 15/05:
  // payload real chegou com 537 chars, max=400 derrubava request inteira.
  // Truncamos no service se vier maior, em vez de rejeitar.
  analysis: z.string().max(2000).optional().nullable().transform((val) => {
    if (!val) return val;
    return val.length > 800 ? val.slice(0, 800) + '…' : val;
  }),
  suggestedIntensity: PlannerIntensitySchema.optional().default('M'),
  avgMood: z.number().nullable().optional(),
  avgEnergy: z.number().nullable().optional(),
});

export const PlannerAISuggestionRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  existingBlocks: z.array(PlannerAISuggestionExistingBlockSchema).max(40).default([]),
  energyState: PlannerAIEnergyStateSchema,
  // currentHour/currentMinute injetados auto pelo helper api do front (lib/api.ts)
  currentHour: z.number().int().min(0).max(23).optional(),
  currentMinute: z.number().int().min(0).max(59).optional(),
  phase: z.string().nullable().optional(),
});
export type PlannerAISuggestionRequest = z.input<typeof PlannerAISuggestionRequestSchema>;
export type PlannerAISuggestionValidatedRequest = z.output<typeof PlannerAISuggestionRequestSchema>;

export const PlannerAIScheduledItemSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  title: z.string().min(3).max(160),
  category: PlannerCategorySchema,
  intensity: PlannerIntensitySchema,
  isRoutine: z.boolean().default(false),
  reasoning: z.string().min(8).max(280),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const PlannerAIAdjustExistingItemSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['MOVE_TOMORROW', 'DOWNGRADE_INTENSITY', 'CANCEL', 'KEEP']),
  reason: z.string().min(8).max(220),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const PlannerAISuggestionResponseSchema = z.object({
  schedule: z.array(PlannerAIScheduledItemSchema).max(8).default([]),
  adjustedExisting: z.array(PlannerAIAdjustExistingItemSchema).max(20).default([]),
  adjustments: z.array(z.string().max(180)).max(5).default([]),
  warnings: z.array(z.string().max(180)).max(3).default([]),
});
export type PlannerAISuggestionResponse = z.infer<typeof PlannerAISuggestionResponseSchema>;
