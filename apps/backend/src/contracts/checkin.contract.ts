import { z } from 'zod';

export const CheckinSlotSchema = z.string().regex(/^(morning|midday|evening)(-[a-zA-Z0-9:_-]+)?$/);

const SymptomLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const CheckinCreateSchema = z.object({
  userId: z.string().uuid(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkinSlot: CheckinSlotSchema.optional(),
  moodScore: z.number().min(1).max(5),
  energyScore: z.number().min(1).max(5),
  clarityScore: z.number().min(1).max(5),
  irritabilityScore: z.number().min(1).max(5),
  physicalScore: z.number().min(1).max(5).optional(),
  socialScore: z.number().min(1).max(5).optional(),
  sleepScore: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
  // Módulo de Saúde Feminina
  isFlowing: z.boolean().optional(),
  flowDay: z.number().int().min(1).max(7).optional(),
  flowIntensity: z.enum(['leve', 'moderado', 'intenso']).optional(),
  symptomLevels: z.object({
    colica: SymptomLevelSchema.optional(),
    dorCabeca: SymptomLevelSchema.optional(),
  }).optional(),
});

export type CheckinCreateInput = z.infer<typeof CheckinCreateSchema>;
