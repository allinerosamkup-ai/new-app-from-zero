import { z } from 'zod';

export const DEFAULT_MORNING_CHECKIN_TIME = '08:00';
export const DEFAULT_EVENING_REVIEW_TIME = '20:00';

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const PreferencesPatchSchema = z.object({
  timezone: z.string().optional(),
  wakeTime: TimeSchema.nullable().optional(),
  sleepTime: TimeSchema.nullable().optional(),
  morningCheckinTime: TimeSchema.nullable().optional(),
  eveningReviewTime: TimeSchema.nullable().optional(),
  notificationsOn: z.boolean().optional(),
  aiTone: z.string().optional(),
});

export const defaultUserPreferences = {
  timezone: 'America/Sao_Paulo',
  wakeTime: null,
  sleepTime: null,
  morningCheckinTime: DEFAULT_MORNING_CHECKIN_TIME,
  eveningReviewTime: DEFAULT_EVENING_REVIEW_TIME,
  notificationsOn: true,
  aiTone: 'warm',
};

export type PreferencesPatchInput = z.infer<typeof PreferencesPatchSchema>;
