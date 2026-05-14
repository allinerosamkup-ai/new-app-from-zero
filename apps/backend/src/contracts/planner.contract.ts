import { z } from 'zod';

import { TimelineBlockSchema } from '../services/planner.service';

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
});

export const PlannerAIEnergyStateSchema = z.object({
  label: z.string().max(120),
  analysis: z.string().max(400).optional().nullable(),
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
export type PlannerAISuggestionRequest = z.infer<typeof PlannerAISuggestionRequestSchema>;

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
