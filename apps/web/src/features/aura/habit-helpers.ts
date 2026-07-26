import type { Habit } from "./types";

export type HabitFrequency = "daily" | "weekly" | "monthly";

export type HabitFormDraft = {
  title: string;
  category: string;
  frequency: HabitFrequency;
  targetCount: number;
  targetDays: number[];
  icon: string;
  timeOfDay: string;
  description: string;
  reminderEnabled: boolean;
  reminderTime?: string;
  persistentReminderEnabled: boolean;
  persistentReminderIntervalMinutes: number;
  durationMinutes?: number;
};

export type HabitPayload = {
  title: string;
  category: string;
  frequency: HabitFrequency;
  targetCount: number;
  targetDays: number[];
  icon: string;
  timeOfDay: string;
  description?: string;
  durationMinutes?: number;
  reminderEnabled: boolean;
  reminderTime?: string;
  persistentReminderEnabled: boolean;
  persistentReminderIntervalMinutes?: number;
};

export type HabitDayDecision = "postponed" | "skipped";
export type HabitDayDecisions = Record<string, HabitDayDecision>;

type HabitSuggestionDraftSource = {
  title: string;
  icon: string;
  category: string;
  timeOfDay: string;
  durationMinutes: number;
};

type HabitSchedule = {
  frequency: string;
  targetDays?: number[] | null;
};

type HabitForDay = HabitSchedule & {
  id: string;
  targetCount?: number | null;
  completions?: Array<{ date?: string | Date | null; completionCount?: number | null }>;
};

const WEEKDAY_LABELS: Record<number, string> = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sáb",
};

const WEEKDAY_LABELS_EN: Record<number, string> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function getHabitTargetCount(habit: Pick<Habit, "targetCount"> | { targetCount?: number | null }): number {
  return clampInteger(habit.targetCount, 1, 24, 1);
}

export function getHabitCompletionCount(
  habit: Pick<Habit, "completions"> | { completions?: Array<{ date?: string | Date | null; completionCount?: number | null }> },
  dateKey: string,
): number {
  const completion = habit.completions?.find((item) => {
    const rawDate = item.date;
    if (typeof rawDate === "string") return rawDate.startsWith(dateKey);
    if (rawDate instanceof Date) return rawDate.toISOString().startsWith(dateKey);
    return false;
  });

  if (!completion) return 0;
  return clampInteger(completion.completionCount ?? 1, 1, 999, 1);
}

export function isHabitCompleteForDate(
  habit: Pick<Habit, "targetCount" | "completions"> | { targetCount?: number | null; completions?: Array<{ date?: string | Date | null; completionCount?: number | null }> },
  dateKey: string,
): boolean {
  return getHabitCompletionCount(habit, dateKey) >= getHabitTargetCount(habit);
}

export function getHabitProgressLabel(
  habit: Pick<Habit, "targetCount" | "completions"> | { targetCount?: number | null; completions?: Array<{ date?: string | Date | null; completionCount?: number | null }> },
  dateKey: string,
): string {
  const target = getHabitTargetCount(habit);
  const count = getHabitCompletionCount(habit, dateKey);
  return `${Math.min(count, target)}/${target} hoje`;
}

export function isHabitDueOnWeekday(
  habit: Pick<Habit, "frequency" | "targetDays"> | { frequency: string; targetDays?: number[] | null },
  weekday: number,
): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") {
    const days = Array.isArray(habit.targetDays) ? habit.targetDays : [];
    return days.length === 0 || days.includes(weekday);
  }
  return false;
}

function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function isHabitDueOnDate(habit: HabitSchedule, value: string | Date): boolean {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return false;
  if (habit.frequency === "monthly") return date.getDate() === 1;
  return isHabitDueOnWeekday(habit, date.getDay());
}

export function formatHabitFrequency(habit: HabitSchedule, language: "pt" | "en" = "pt"): string {
  if (habit.frequency === "daily") return language === "en" ? "Every day" : "Todos os dias";
  if (habit.frequency === "monthly") return language === "en" ? "Every month, day 1" : "Todo mês, dia 1";

  const days = Array.isArray(habit.targetDays)
    ? Array.from(new Set(habit.targetDays)).filter((day) => day >= 0 && day <= 6).sort()
    : [];

  if (days.length === 0) return language === "en" ? "Any day of the week" : "Qualquer dia da semana";
  const labels = language === "en" ? WEEKDAY_LABELS_EN : WEEKDAY_LABELS;
  const conjunction = language === "en" ? " and " : " e ";
  return days.map((day) => labels[day]).join(", ").replace(/, ([^,]*)$/, `${conjunction}$1`).replace(/^./, (letter) => letter.toUpperCase());
}

export function formatHabitTimeOfDay(value?: string | null, language: "pt" | "en" = "pt"): string {
  if (value === "morning") return language === "en" ? "Morning" : "Manhã";
  if (value === "afternoon") return language === "en" ? "Afternoon" : "Tarde";
  if (value === "evening") return language === "en" ? "Evening" : "Noite";
  return language === "en" ? "Flexible time" : "Horário livre";
}

export function buildHabitDraftFromSuggestion(suggestion: HabitSuggestionDraftSource): HabitFormDraft {
  return {
    title: suggestion.title,
    category: suggestion.category,
    frequency: "daily",
    targetCount: 1,
    targetDays: [],
    icon: suggestion.icon,
    timeOfDay: suggestion.timeOfDay,
    description: "",
    reminderEnabled: false,
    reminderTime: "09:00",
    persistentReminderEnabled: false,
    persistentReminderIntervalMinutes: 60,
    durationMinutes: suggestion.durationMinutes || undefined,
  };
}

export function parseHabitDayDecisions(value: string | null | undefined): HabitDayDecisions {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, HabitDayDecision] => (
        entry[1] === "postponed" || entry[1] === "skipped"
      )),
    );
  } catch {
    return {};
  }
}

export function categorizeHabitsForDate<T extends HabitForDay>(
  habits: T[],
  dateKey: string,
  decisions: HabitDayDecisions = {},
): { pending: T[]; postponed: T[]; skipped: T[]; done: T[] } {
  const result = { pending: [] as T[], postponed: [] as T[], skipped: [] as T[], done: [] as T[] };

  habits.forEach((habit) => {
    if (!isHabitDueOnDate(habit, dateKey)) return;
    if (isHabitCompleteForDate(habit, dateKey)) {
      result.done.push(habit);
      return;
    }

    const decision = decisions[habit.id];
    if (decision === "postponed") result.postponed.push(habit);
    else if (decision === "skipped") result.skipped.push(habit);
    else result.pending.push(habit);
  });

  return result;
}

export function buildHabitPayload(draft: HabitFormDraft): HabitPayload {
  const frequency = draft.frequency === "weekly" || draft.frequency === "monthly" ? draft.frequency : "daily";
  const targetDays = frequency === "weekly"
    ? Array.from(new Set(draft.targetDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort()
    : [];
  const persistentReminderEnabled = Boolean(draft.persistentReminderEnabled && draft.reminderEnabled);

  return {
    title: draft.title.trim(),
    category: draft.category || "geral",
    frequency,
    targetCount: clampInteger(draft.targetCount, 1, 24, 1),
    targetDays,
    icon: draft.icon || "✨",
    timeOfDay: draft.timeOfDay || "anytime",
    description: draft.description.trim() || undefined,
    durationMinutes: draft.durationMinutes,
    reminderEnabled: Boolean(draft.reminderEnabled),
    reminderTime: draft.reminderEnabled ? draft.reminderTime || "09:00" : undefined,
    persistentReminderEnabled,
    persistentReminderIntervalMinutes: persistentReminderEnabled
      ? clampInteger(draft.persistentReminderIntervalMinutes, 5, 720, 60)
      : undefined,
  };
}
