import type { RoutineClassifiedItem } from '../contracts/routine-builder.contract';

export type RoutineCapacity = {
  level: 'low' | 'balanced' | 'high';
  reason: string;
};

export type RoutineExistingBlock = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  isFixed: boolean;
};

export type RoutinePlanEntry = {
  id: string;
  sourceItemId?: string;
  kind: 'task' | 'habit' | 'calendar' | 'existing';
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  durationMinutes: number;
  isFixed: boolean;
  persist: boolean;
  reason: string;
};

export type RoutineWeekPlan = {
  weekStart: string;
  capacity: RoutineCapacity;
  entries: RoutinePlanEntry[];
  days: Array<{ date: string; flexibleMinutes: number; fixedMinutes: number }>;
  contextItems: Array<{ sourceItemId: string; kind: RoutineClassifiedItem['kind']; title: string }>;
  unscheduled: Array<{ sourceItemId: string; title: string; reason: string }>;
};

type ComposeInput = {
  weekStart: string;
  items: RoutineClassifiedItem[];
  limits: {
    wakeTime: string;
    sleepTime: string;
    maxDailyLoadMinutes: number;
    unavailable: Array<{ date: string; startTime: string; endTime: string; reason?: string | null }>;
  };
  existingBlocks: RoutineExistingBlock[];
  existingHabits?: Array<{
    id: string;
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    targetDays: number[];
    durationMinutes?: number | null;
  }>;
  capacity: RoutineCapacity;
};

type BusyWindow = { start: number; end: number };

const SLOT_STEP_MINUTES = 15;
const BUFFER_MINUTES = 15;

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function toTime(value: number): string {
  const normalized = Math.max(0, Math.min((24 * 60) - 1, value));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function addUtcDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function utcDay(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function durationBetween(startTime: string, endTime: string): number {
  return Math.max(0, toMinutes(endTime) - toMinutes(startTime));
}

function overlaps(start: number, end: number, window: BusyWindow): boolean {
  return start < window.end + BUFFER_MINUTES && end + BUFFER_MINUTES > window.start;
}

function capacityDailyLimit(input: ComposeInput): number {
  if (input.capacity.level === 'low') return Math.min(input.limits.maxDailyLoadMinutes, 120);
  if (input.capacity.level === 'balanced') return Math.min(input.limits.maxDailyLoadMinutes, 240);
  return input.limits.maxDailyLoadMinutes;
}

function adaptedDuration(item: RoutineClassifiedItem, capacity: RoutineCapacity): number {
  const requested = item.durationMinutes ?? (item.kind === 'habit' ? 20 : 30);
  if (capacity.level === 'low') return Math.min(requested, 30);
  return requested;
}

function withinWeek(date: string, weekDates: string[]): boolean {
  return weekDates.includes(date);
}

function sortedTasks(items: RoutineClassifiedItem[]): RoutineClassifiedItem[] {
  return [...items].sort((left, right) => {
    if (left.deadline && right.deadline) return left.deadline.localeCompare(right.deadline);
    if (left.deadline) return -1;
    if (right.deadline) return 1;
    return left.id.localeCompare(right.id);
  });
}

export class RoutineComposerService {
  static compose(input: ComposeInput): RoutineWeekPlan {
    const weekDates = Array.from({ length: 7 }, (_, index) => addUtcDays(input.weekStart, index));
    const dayLimit = capacityDailyLimit(input);
    const wake = toMinutes(input.limits.wakeTime);
    const sleep = toMinutes(input.limits.sleepTime);
    const entries: RoutinePlanEntry[] = [];
    const contextItems: RoutineWeekPlan['contextItems'] = [];
    const unscheduled: RoutineWeekPlan['unscheduled'] = [];
    const busyByDate = new Map<string, BusyWindow[]>();
    const flexibleByDate = new Map(weekDates.map((date) => [date, 0]));

    const markBusy = (date: string, start: number, end: number): void => {
      const windows = busyByDate.get(date) ?? [];
      windows.push({ start, end });
      windows.sort((a, b) => a.start - b.start);
      busyByDate.set(date, windows);
    };

    for (const block of input.existingBlocks) {
      if (!withinWeek(block.date, weekDates)) continue;
      entries.push({
        id: `existing:${block.id}`,
        kind: 'existing',
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        title: block.title,
        durationMinutes: durationBetween(block.startTime, block.endTime),
        isFixed: block.isFixed,
        persist: false,
        reason: block.isFixed ? 'Compromisso existente protegido.' : 'Bloco já existente mantido na prévia.',
      });
      markBusy(block.date, toMinutes(block.startTime), toMinutes(block.endTime));
    }

    for (const window of input.limits.unavailable) {
      if (withinWeek(window.date, weekDates)) {
        markBusy(window.date, toMinutes(window.startTime), toMinutes(window.endTime));
      }
    }

    for (const habit of input.existingHabits ?? []) {
      const dates = habit.frequency === 'daily'
        ? weekDates
        : habit.frequency === 'weekly'
          ? weekDates.filter((date) => habit.targetDays.includes(utcDay(date)))
          : [weekDates[0]];
      const duration = Math.max(5, habit.durationMinutes ?? 10);
      for (const date of dates) {
        const windows = busyByDate.get(date) ?? [];
        let placed = false;
        for (let start = wake; start + duration <= sleep; start += SLOT_STEP_MINUTES) {
          const end = start + duration;
          if (windows.some((window) => overlaps(start, end, window))) continue;
          entries.push({
            id: `existing-habit:${habit.id}:${date}`,
            kind: 'habit',
            date,
            startTime: toTime(start),
            endTime: toTime(end),
            title: habit.title,
            durationMinutes: duration,
            isFixed: false,
            persist: false,
            reason: 'Hábito já existente mantido somente no dia em que é devido.',
          });
          markBusy(date, start, end);
          flexibleByDate.set(date, (flexibleByDate.get(date) ?? 0) + duration);
          placed = true;
          break;
        }
        if (!placed) {
          unscheduled.push({ sourceItemId: `existing-habit:${habit.id}`, title: habit.title, reason: `Sem janela segura em ${date}.` });
        }
      }
    }

    const placeFlexible = (item: RoutineClassifiedItem, preferredDates: string[], kind: 'task' | 'habit'): boolean => {
      const duration = adaptedDuration(item, input.capacity);
      for (const date of preferredDates) {
        if (!withinWeek(date, weekDates)) continue;
        const used = flexibleByDate.get(date) ?? 0;
        if (used + duration > dayLimit) continue;
        const windows = busyByDate.get(date) ?? [];
        for (let start = wake; start + duration <= sleep; start += SLOT_STEP_MINUTES) {
          const end = start + duration;
          if (windows.some((window) => overlaps(start, end, window))) continue;
          const reduced = input.capacity.level === 'low' && (item.durationMinutes ?? duration) > duration;
          entries.push({
            id: `${kind}:${item.id}:${date}`,
            sourceItemId: item.id,
            kind,
            date,
            startTime: toTime(start),
            endTime: toTime(end),
            title: item.title,
            durationMinutes: duration,
            isFixed: false,
            persist: true,
            reason: reduced
              ? `${input.capacity.reason} A semana começa com um bloco de entrada de ${duration} minutos, sem transformar baixa energia em abandono.`
              : `${input.capacity.reason} Alocado em uma janela livre, respeitando compromissos e limite diário.`,
          });
          markBusy(date, start, end);
          flexibleByDate.set(date, used + duration);
          return true;
        }
      }
      return false;
    };

    const reviewed = input.items.filter((item) => item.reviewState !== 'excluded' && !item.duplicateOf);
    for (const item of reviewed) {
      if (['goal', 'project', 'reference', 'concern'].includes(item.kind)) {
        contextItems.push({ sourceItemId: item.id, kind: item.kind, title: item.title });
      }
    }

    for (const item of reviewed.filter((candidate) => candidate.kind === 'calendar')) {
      if (!item.date || !item.startTime || !withinWeek(item.date, weekDates)) {
        unscheduled.push({ sourceItemId: item.id, title: item.title, reason: 'Compromisso sem data e horário válidos dentro desta semana.' });
        continue;
      }
      const duration = item.durationMinutes ?? 60;
      const start = toMinutes(item.startTime);
      const end = start + duration;
      if ((busyByDate.get(item.date) ?? []).some((window) => overlaps(start, end, window))) {
        unscheduled.push({ sourceItemId: item.id, title: item.title, reason: 'Conflita com um compromisso protegido ou período indisponível.' });
        continue;
      }
      entries.push({
        id: `calendar:${item.id}:${item.date}`,
        sourceItemId: item.id,
        kind: 'calendar',
        date: item.date,
        startTime: item.startTime,
        endTime: toTime(end),
        title: item.title,
        durationMinutes: duration,
        isFixed: true,
        persist: true,
        reason: 'Data e horário vieram da fonte e foram protegidos como compromisso fixo.',
      });
      markBusy(item.date, start, end);
    }

    for (const item of reviewed.filter((candidate) => candidate.kind === 'habit')) {
      const recurrence = item.recurrence;
      if (!recurrence) {
        unscheduled.push({ sourceItemId: item.id, title: item.title, reason: 'Hábito sem frequência confirmada.' });
        continue;
      }
      let dates: string[] = [];
      if (recurrence.frequency === 'daily') dates = weekDates;
      if (recurrence.frequency === 'weekly') {
        const selectedDays = recurrence.daysOfWeek ?? [];
        dates = weekDates.filter((date) => selectedDays.includes(utcDay(date)));
        if (dates.length === 0 && recurrence.timesPerWeek) dates = weekDates.slice(0, recurrence.timesPerWeek);
      }
      if (recurrence.frequency === 'monthly') dates = [weekDates[0]];
      for (const date of dates) {
        if (!placeFlexible(item, [date], 'habit')) {
          unscheduled.push({ sourceItemId: item.id, title: item.title, reason: `Sem janela segura em ${date}.` });
        }
      }
    }

    const tasks = sortedTasks(reviewed.filter((candidate) => candidate.kind === 'task'));
    for (const item of tasks) {
      const allowedDates = item.date
        ? [item.date]
        : weekDates.filter((date) => !item.deadline || date <= item.deadline);
      if (!placeFlexible(item, allowedDates.length > 0 ? allowedDates : weekDates, 'task')) {
        unscheduled.push({ sourceItemId: item.id, title: item.title, reason: 'Não coube sem ultrapassar limites ou colidir com compromissos.' });
      }
    }

    entries.sort((left, right) => `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`));

    return {
      weekStart: input.weekStart,
      capacity: input.capacity,
      entries,
      days: weekDates.map((date) => ({
        date,
        flexibleMinutes: flexibleByDate.get(date) ?? 0,
        fixedMinutes: entries
          .filter((entry) => entry.date === date && entry.isFixed)
          .reduce((total, entry) => total + entry.durationMinutes, 0),
      })),
      contextItems,
      unscheduled,
    };
  }
}
