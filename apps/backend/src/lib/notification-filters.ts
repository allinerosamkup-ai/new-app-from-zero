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

// ─── Nudge único diário (check-in / diário) ──────────────────────────────────
// Nudges de engajamento são limitados a 1 por dia. Lembretes de compromisso
// real (planner, hábito com horário definido pela usuária) não entram no limite.

export const NUDGE_EVENT_NAME = 'nudge.sent';
export const MAX_DAILY_NUDGES = 1;
export const MAX_PERSISTENT_REMINDERS_PER_DAY = 3;

// Janela de silêncio: nenhum nudge antes das 07:00 nem depois das 22:00.
const NUDGE_EARLIEST_MINUTES = 7 * 60;
const NUDGE_LATEST_MINUTES = 22 * 60;
const NUDGE_MIN_PATTERN_SAMPLES = 5;

export type NudgeDecision = { send: boolean; reason: string };

function timeToMinutes(time: unknown): number | null {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function isWithinNudgeWindow(time: string): boolean {
  const minutes = timeToMinutes(time);
  return minutes !== null && minutes >= NUDGE_EARLIEST_MINUTES && minutes <= NUDGE_LATEST_MINUTES;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.min(NUDGE_LATEST_MINUTES, Math.max(NUDGE_EARLIEST_MINUTES, totalMinutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Início do dia de São Paulo em UTC (BRT fixo = UTC-3) para filtrar EventLog por dia local. */
export function getSaoPauloDayStartUtc(dateKey: string): Date {
  return new Date(`${dateKey}T03:00:00.000Z`);
}

/**
 * Resolve o horário do nudge de check-in:
 * - com 5+ check-ins recentes, usa a mediana do horário real (arredondada a 10min),
 *   limitada à janela 07:00–22:00;
 * - senão, usa o horário preferido da usuária ou 09:00.
 */
export function resolveCheckinNudgeTime(opts: {
  preferredTime?: string | null;
  recentCheckinTimes: string[];
}): string {
  const samples = opts.recentCheckinTimes
    .map(timeToMinutes)
    .filter((minutes): minutes is number => minutes !== null)
    .sort((a, b) => a - b);

  if (samples.length >= NUDGE_MIN_PATTERN_SAMPLES) {
    const mid = Math.floor(samples.length / 2);
    const median = samples.length % 2 === 1 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
    return minutesToTime(Math.round(median / 10) * 10);
  }

  const preferred = timeToMinutes(opts.preferredTime);
  return preferred !== null ? minutesToTime(preferred) : '09:00';
}

export function shouldSendCheckinNudge(opts: {
  currentTime: string;
  nudgeTime: string;
  hasCheckinToday: boolean;
  nudgesSentToday: number;
}): NudgeDecision {
  if (!isWithinNudgeWindow(opts.currentTime)) return { send: false, reason: 'janela de silêncio' };
  if (opts.currentTime !== opts.nudgeTime) return { send: false, reason: 'fora do horário do nudge' };
  if (opts.hasCheckinToday) return { send: false, reason: 'check-in já registrado hoje' };
  if (opts.nudgesSentToday >= MAX_DAILY_NUDGES) return { send: false, reason: 'limite diário de nudges atingido' };
  return { send: true, reason: 'nudge de check-in no horário do padrão' };
}

export function shouldSendJournalNudge(opts: {
  currentTime: string;
  journalTimes: string[];
  nudgesSentToday: number;
}): NudgeDecision {
  if (!isWithinNudgeWindow(opts.currentTime)) return { send: false, reason: 'janela de silêncio' };
  if (!opts.journalTimes.includes(opts.currentTime)) return { send: false, reason: 'fora do horário do nudge' };
  if (opts.nudgesSentToday >= MAX_DAILY_NUDGES) return { send: false, reason: 'limite diário de nudges atingido' };
  return { send: true, reason: 'nudge de diário dentro do limite diário' };
}

export function shouldSendPersistentReminder(opts: {
  taskLocalDate: Date;
  todayLocalDate: Date;
  startAt: Date;
  now: Date;
  intervalMinutes: number;
  sentToday: number;
}): NudgeDecision {
  if (opts.taskLocalDate.getTime() !== opts.todayLocalDate.getTime()) return { send: false, reason: 'tarefa fora do dia atual' };
  if (opts.startAt.getTime() >= opts.now.getTime()) return { send: false, reason: 'tarefa ainda não começou' };
  if (!Number.isFinite(opts.intervalMinutes) || opts.intervalMinutes < 15) return { send: false, reason: 'intervalo inválido' };
  if (opts.sentToday >= MAX_PERSISTENT_REMINDERS_PER_DAY) return { send: false, reason: 'limite de lembretes da tarefa atingido' };
  const minutesPast = Math.floor((opts.now.getTime() - opts.startAt.getTime()) / 60000);
  if (minutesPast % opts.intervalMinutes !== 0) return { send: false, reason: 'fora do intervalo' };
  return { send: true, reason: 'lembrete persistente elegível' };
}
