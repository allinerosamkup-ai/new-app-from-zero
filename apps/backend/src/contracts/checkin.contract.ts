import { z } from 'zod';
import { RiskSafetySchema } from './risk-safety.contract';

export const CheckinSlotSchema = z.string().regex(/^(morning|midday|evening)(-[a-zA-Z0-9:_-]+)?$/);

const SymptomLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const CheckinCreateSchema = z.object({
  userId: z.string().uuid(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkinSlot: CheckinSlotSchema.optional(),
  moodScore: z.number().min(1).max(10),
  energyScore: z.number().min(1).max(10),
  clarityScore: z.number().min(1).max(10),
  irritabilityScore: z.number().min(1).max(10),
  physicalScore: z.number().min(1).max(10).optional(),
  socialScore: z.number().min(1).max(10).optional(),
  sleepScore: z.number().min(1).max(10).optional(),
  note: z.string().optional(),
  // Módulo de Saúde Feminina
  isFlowing: z.boolean().optional(),
  flowDay: z.number().int().min(1).max(7).optional(),
  flowIntensity: z.enum(['leve', 'moderado', 'intenso']).optional(),
  symptomLevels: z.object({
    colica: SymptomLevelSchema.optional(),
    dorCabeca: SymptomLevelSchema.optional(),
  }).optional(),
  factors: z.array(z.string()).optional(),
  emotions: z.array(z.string()).max(3).optional(),
  // Diagnostic-aware optional signals.
  // Only persisted when the user has a relevant prior diagnosis (TDAH/bipolar);
  // backend tolerates them on any check-in for forward compatibility.
  medicationTakenToday: z.boolean().nullable().optional(),
  focusScore: z.number().int().min(1).max(10).nullable().optional(),
  hyperfocusOccurred: z.boolean().nullable().optional(),
  mixedEpisodeNote: z.string().trim().max(500).nullable().optional(),
  dayType: z.enum(['up', 'down', 'mixed', 'stable']).nullable().optional(),
});

export type CheckinCreateInput = z.infer<typeof CheckinCreateSchema>;

export const CheckinResponseSchema = z.object({
  id: z.string().uuid(),
  stateLabel: z.string().nullable().optional(),
  stateLabelType: z.string().nullable().optional(),
  stateSummary: z.string().nullable().optional(),
  aiState: z.unknown().optional(),
  riskSafety: RiskSafetySchema.optional(),
}).catchall(z.unknown());

export type CheckinResponse = z.infer<typeof CheckinResponseSchema>;
