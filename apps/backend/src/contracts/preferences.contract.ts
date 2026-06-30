import { z } from 'zod';

export const DEFAULT_MORNING_CHECKIN_TIME = '08:00';
export const DEFAULT_EVENING_REVIEW_TIME = '20:00';
export const DEFAULT_JOURNAL_MORNING_TIME = '11:00';
export const DEFAULT_JOURNAL_EVENING_TIME = '19:00';

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const NotificationPreferencesSchema = z.object({
  checkin: z.boolean(),
  journal: z.boolean(),
  planner: z.boolean(),
  habits: z.boolean(),
  persistent: z.boolean(),
  aiSuggestions: z.boolean(),
  journalMorningTime: TimeSchema,
  journalEveningTime: TimeSchema,
});

export const defaultNotificationPreferences = {
  checkin: true,
  journal: true,
  planner: true,
  habits: true,
  persistent: true,
  aiSuggestions: true,
  journalMorningTime: DEFAULT_JOURNAL_MORNING_TIME,
  journalEveningTime: DEFAULT_JOURNAL_EVENING_TIME,
};

export function normalizeNotificationPreferences(value: unknown) {
  const payload = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};

  return NotificationPreferencesSchema.parse({
    ...defaultNotificationPreferences,
    ...payload,
  });
}

export const PreferencesPatchSchema = z.object({
  timezone: z.string().optional(),
  wakeTime: TimeSchema.nullable().optional(),
  sleepTime: TimeSchema.nullable().optional(),
  morningCheckinTime: TimeSchema.nullable().optional(),
  eveningReviewTime: TimeSchema.nullable().optional(),
  notificationsOn: z.boolean().optional(),
  notificationPreferences: NotificationPreferencesSchema.optional(),
  aiTone: z.string().optional(),
});

export const defaultUserPreferences = {
  timezone: 'America/Sao_Paulo',
  wakeTime: null,
  sleepTime: null,
  morningCheckinTime: DEFAULT_MORNING_CHECKIN_TIME,
  eveningReviewTime: DEFAULT_EVENING_REVIEW_TIME,
  notificationsOn: true,
  notificationPreferences: defaultNotificationPreferences,
  aiTone: 'warm',
};

export type PreferencesPatchInput = z.infer<typeof PreferencesPatchSchema>;
