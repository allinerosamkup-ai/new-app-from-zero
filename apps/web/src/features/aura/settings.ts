export const DEFAULT_MORNING_CHECKIN_TIME = "08:00";
export const DEFAULT_EVENING_CHECKIN_TIME = "20:00";
export const QUIET_MODE_START_TIME = "20:00";
export const QUIET_MODE_END_TIME = "08:00";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeInput(value: unknown, fallback: string): string {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback;
}

export function normalizeReminderPreferences(
  preferences: unknown,
  current?: { morningCheckinTime?: string; eveningCheckinTime?: string; checkinReminder?: boolean },
) {
  const payload = preferences && typeof preferences === "object" ? preferences as Record<string, unknown> : {};

  return {
    morningCheckinTime: normalizeTimeInput(
      payload.morningCheckinTime,
      current?.morningCheckinTime ?? DEFAULT_MORNING_CHECKIN_TIME,
    ),
    eveningCheckinTime: normalizeTimeInput(
      payload.eveningReviewTime,
      current?.eveningCheckinTime ?? DEFAULT_EVENING_CHECKIN_TIME,
    ),
    checkinReminder: typeof payload.notificationsOn === "boolean"
      ? payload.notificationsOn
      : current?.checkinReminder ?? true,
  };
}
