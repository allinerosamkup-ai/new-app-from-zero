type HabitReminderCandidate = {
  frequency?: string | null;
  targetDays?: number[] | null;
  targetCount?: number | null;
  completions?: Array<{ completionCount?: number | null }>;
};

type NotificationPreferencesLike = {
  notificationsOn?: boolean | null;
  notificationPreferences?: unknown;
};

function resolveTargetCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(24, Math.round(count)));
}

function resolveCompletionCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.round(count));
}

export function getSaoPauloDateContext(referenceDate: Date): {
  dateKey: string;
  weekday: number;
  dayOfMonth: number;
  dbDate: Date;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(referenceDate);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const dateKey = `${year}-${month}-${day}`;
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();

  return {
    dateKey,
    weekday,
    dayOfMonth: Number(day),
    dbDate: new Date(`${dateKey}T00:00:00.000Z`),
  };
}

export function shouldSendHabitReminderToday(
  habit: HabitReminderCandidate,
  weekday: number,
  dayOfMonth?: number,
): boolean {
  if (habit.frequency === 'weekly') {
    const targetDays = Array.isArray(habit.targetDays) ? habit.targetDays : [];
    if (targetDays.length > 0 && !targetDays.includes(weekday)) return false;
  }

  if (habit.frequency === 'monthly') {
    if (dayOfMonth !== 1) return false;
  }

  const completionCount = habit.completions?.reduce(
    (total, completion) => total + resolveCompletionCount(completion.completionCount ?? 1),
    0,
  ) ?? 0;

  return completionCount < resolveTargetCount(habit.targetCount);
}

export function allowsHabitNotifications(preference: NotificationPreferencesLike | null | undefined): boolean {
  if (!preference?.notificationsOn) return false;
  const notificationPreferences = preference.notificationPreferences && typeof preference.notificationPreferences === 'object'
    ? preference.notificationPreferences as Record<string, unknown>
    : {};

  return notificationPreferences.habits !== false;
}
