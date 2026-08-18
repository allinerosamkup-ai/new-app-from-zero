import type { NotificationPreferences } from "./types";

export const DEFAULT_MORNING_CHECKIN_TIME = "08:00";
export const DEFAULT_EVENING_CHECKIN_TIME = "20:00";
export const DEFAULT_JOURNAL_MORNING_TIME = "11:00";
export const DEFAULT_JOURNAL_EVENING_TIME = "19:00";
export const QUIET_MODE_START_TIME = "20:00";
export const QUIET_MODE_END_TIME = "08:00";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeInput(value: unknown, fallback: string): string {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  checkin: true,
  journal: true,
  planner: false,
  habits: false,
  persistent: true,
  aiSuggestions: true,
  journalMorningTime: DEFAULT_JOURNAL_MORNING_TIME,
  journalEveningTime: DEFAULT_JOURNAL_EVENING_TIME,
};

export function normalizeNotificationPreferences(
  preferences: unknown,
  current?: Partial<NotificationPreferences>,
): NotificationPreferences {
  const payload = preferences && typeof preferences === "object" ? preferences as Record<string, unknown> : {};

  return {
    checkin: typeof payload.checkin === "boolean" ? payload.checkin : current?.checkin ?? DEFAULT_NOTIFICATION_PREFERENCES.checkin,
    journal: typeof payload.journal === "boolean" ? payload.journal : current?.journal ?? DEFAULT_NOTIFICATION_PREFERENCES.journal,
    // Mantidos no tipo para ler perfis antigos, mas deliberadamente inativos
    // enquanto esses módulos estiverem fora do produto.
    planner: false,
    habits: false,
    persistent: typeof payload.persistent === "boolean" ? payload.persistent : current?.persistent ?? DEFAULT_NOTIFICATION_PREFERENCES.persistent,
    aiSuggestions: typeof payload.aiSuggestions === "boolean" ? payload.aiSuggestions : current?.aiSuggestions ?? DEFAULT_NOTIFICATION_PREFERENCES.aiSuggestions,
    journalMorningTime: normalizeTimeInput(
      payload.journalMorningTime,
      current?.journalMorningTime ?? DEFAULT_NOTIFICATION_PREFERENCES.journalMorningTime,
    ),
    journalEveningTime: normalizeTimeInput(
      payload.journalEveningTime,
      current?.journalEveningTime ?? DEFAULT_NOTIFICATION_PREFERENCES.journalEveningTime,
    ),
  };
}

export function normalizeReminderPreferences(
  preferences: unknown,
  current?: {
    morningCheckinTime?: string;
    eveningCheckinTime?: string;
    checkinReminder?: boolean;
    notificationPreferences?: Partial<NotificationPreferences>;
  },
) {
  const payload = preferences && typeof preferences === "object" ? preferences as Record<string, unknown> : {};
  const notificationPreferences = normalizeNotificationPreferences(
    payload.notificationPreferences,
    {
      ...current?.notificationPreferences,
      checkin: typeof payload.notificationsOn === "boolean"
        ? payload.notificationsOn
        : current?.notificationPreferences?.checkin,
    },
  );

  return {
    morningCheckinTime: normalizeTimeInput(
      payload.morningCheckinTime,
      current?.morningCheckinTime ?? DEFAULT_MORNING_CHECKIN_TIME,
    ),
    eveningCheckinTime: normalizeTimeInput(
      payload.eveningReviewTime,
      current?.eveningCheckinTime ?? DEFAULT_EVENING_CHECKIN_TIME,
    ),
    checkinReminder: notificationPreferences.checkin,
    notificationPreferences,
  };
}
