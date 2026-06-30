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
  habit: Pick<Habit, "frequency" | "targetDays"> | { frequency: string; targetDays?: number[] },
  weekday: number,
): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") {
    const days = Array.isArray(habit.targetDays) ? habit.targetDays : [];
    return days.length === 0 || days.includes(weekday);
  }
  return false;
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
