import { z } from 'zod';

const ReminderIntervalSchema = z.number().int().min(5).max(720);

export const HabitCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  targetDays: z.array(z.number().int().min(0).max(6)).optional(),
  targetCount: z.number().int().min(1).max(24).default(1),
  timeOfDay: z.string().optional(),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  persistentReminderEnabled: z.boolean().optional(),
  persistentReminderIntervalMinutes: ReminderIntervalSchema.optional(),
});

export const HabitPatchSchema = HabitCreateSchema.partial().extend({
  archived: z.boolean().optional(),
  archivedAt: z.string().datetime().optional(),
});

export type HabitCreateInput = z.infer<typeof HabitCreateSchema>;
export type HabitPatchInput = z.infer<typeof HabitPatchSchema>;
