import { z } from 'zod';

export const CheckinSlotSchema = z.enum(['morning', 'midday', 'evening']);

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
  note: z.string().optional(),
});

export type CheckinCreateInput = z.infer<typeof CheckinCreateSchema>;
