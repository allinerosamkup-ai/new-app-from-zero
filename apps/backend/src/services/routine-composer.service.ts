import type {
  RoutineClassifiedItem,
  RoutinePriority,
  RoutineTimeWindow,
} from '../contracts/routine-builder.contract';

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
  priority?: RoutinePriority;
  deadline?: string | null;
  timeWindow?: RoutineTimeWindow | null;
};

export type RoutineConflictAlternative = {
  action: 'move' | 'shorten' | 'defer';
  reason: string;
  suggestedDate?: string;
  suggestedStartTime?: string;
  durationMinutes?: number;
};

export type RoutineLoadStatus = 'light' | 'balanced' | 'overloaded';

export type RoutineWeekPlan = {
  weekStart: string;
  capacity: RoutineCapacity;
  entries: RoutinePlanEntry[];
  days: Array<{
    date: string;
    flexibleMinutes: number;
    fixedMinutes: number;
    predictedMinutes: number;
    capacityMinutes: number;
    utilizationPercent: number;
    status: RoutineLoadStatus;
  }>;
  contextItems: Array<{ sourceItemId: string; kind: RoutineClassifiedItem['kind']; title: string }>;
  unscheduled: Array<{
    sourceItemId: string;
    title: string;
    reason: string;
    alternatives: RoutineConflictAlternative[];
  }>;
};

type ComposeInput = {
  weekStart: string;
  items: RoutineClassifiedItem[];
  limits: {
    wakeTime: string;
    sleepTime: string;
    maxDailyLoadMinutes: number;
    unavailable: Array<{ date: string; startTime: string; endTime: string; reason?: string | null }>;
    available?: Array<{ date: string; startTime: string; endTime: string }>;
  };
  existingBlocks: RoutineExistingBlock[];
  existingHabits?: Array<{
    id: string;
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    targetDays: number[];
    durationMinutes?: number | null;
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime' | null;
    reminderTime?: string | null;
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

function availableWindowsForDate(
  date: string,
  available: ComposeInput['limits']['available'],
  fallback: BusyWindow,
): BusyWindow[] {
  if (!available || available.length === 0) return [fallback];
  return available
    .filter((window) => window.date === date)
    .map((window) => ({
      start: Math.max(fallback.start, toMinutes(window.startTime)),
      end: Math.min(fallback.end, toMinutes(window.endTime)),
    }))
    .filter((window) => window.end > window.start);
}

function intersectWindows(left: BusyWindow[], right: BusyWindow[]): BusyWindow[] {
  const intersections: BusyWindow[] = [];
  for (const first of left) {
    for (const second of right) {
      const start = Math.max(first.start, second.start);
      const end = Math.min(first.end, second.end);
      if (end > start) intersections.push({ start, end });
    }
  }
  return intersections;
}

function capacityDailyLimit(input: ComposeInput): number {
  if (input.capacity.level === 'low') return Math.min(input.limits.maxDailyLoadMinutes, 120);
  if (input.capacity.level === 'balanced') return Math.min(input.limits.maxDailyLoadMinutes, 240);
  return input.limits.maxDailyLoadMinutes;
}

function adaptedDuration(item: RoutineClassifiedItem, capacity: RoutineCapacity): number {
  const requested = item.durationMinutes ?? (item.kind === 'habit' ? 20 : 30);
  if (item.kind === 'habit' && item.timeWindow) {
    if (capacity.level === 'low') return item.timeWindow.minDurationMinutes;
    return Math.max(
      item.timeWindow.minDurationMinutes,
      Math.min(requested, item.timeWindow.maxDurationMinutes),
    );
  }
  if (capacity.level === 'low') return Math.min(requested, 30);
  return requested;
}

function withinWeek(date: string, weekDates: string[]): boolean {
  return weekDates.includes(date);
}

function sortedTasks(items: RoutineClassifiedItem[]): RoutineClassifiedItem[] {
  const weight: Record<RoutinePriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return [...items].sort((left, right) => {
    if (left.deadline && right.deadline) {
      const deadlineDifference = left.deadline.localeCompare(right.deadline);
      if (deadlineDifference !== 0) return deadlineDifference;
    }
    if (left.deadline) return -1;
    if (right.deadline) return 1;
    const priorityDifference = weight[right.priority ?? 'medium'] - weight[left.priority ?? 'medium'];
    if (priorityDifference !== 0) return priorityDifference;
    return left.id.localeCompare(right.id);
  });
}

function statusForLoad(predictedMinutes: number, capacityMinutes: number): RoutineLoadStatus {
  if (predictedMinutes > capacityMinutes) return 'overloaded';
  if (predictedMinutes < capacityMinutes * 0.5) return 'light';
  return 'balanced';
}

function defaultHabitWindow(
  habit: NonNullable<ComposeInput['existingHabits']>[number],
  wake: number,
  sleep: number,
): { start: number; end: number } {
  if (habit.reminderTime) {
    const start = Math.max(wake, toMinutes(habit.reminderTime));
    return { start, end: Math.min(sleep, start + 120) };
  }
  if (habit.timeOfDay === 'morning') return { start: Math.max(wake, 6 * 60), end: Math.min(sleep, 12 * 60) };
  if (habit.timeOfDay === 'afternoon') return { start: Math.max(wake, 12 * 60), end: Math.min(sleep, 18 * 60) };
  if (habit.timeOfDay === 'evening') return { start: Math.max(wake, 18 * 60), end: Math.min(sleep, 22 * 60) };
  return { start: wake, end: sleep };
}

function calendarDates(item: RoutineClassifiedItem, weekDates: string[]): string[] {
  if (item.date) return withinWeek(item.date, weekDates) ? [item.date] : [];
  if (item.recurrence?.frequency === 'daily') return weekDates;
  if (item.recurrence?.frequency === 'weekly') {
    const selectedDays = item.recurrence.daysOfWeek ?? [];
    return weekDates.filter((date) => selectedDays.includes(utcDay(date)));
  }
  return [];
}

function conflictAlternatives(
  item: RoutineClassifiedItem,
  weekStart: string,
): RoutineConflictAlternative[] {
  const nextWeekStart = addUtcDays(weekStart, 7);
  const requested = item.durationMinutes ?? (item.kind === 'habit' ? 20 : 30);
  const minimum = item.kind === 'habit' && item.timeWindow
    ? item.timeWindow.minDurationMinutes
    : Math.min(15, requested);
  return [
    {
      action: 'move',
      suggestedDate: nextWeekStart,
      suggestedStartTime: item.timeWindow?.startTime,
      reason: item.deadline && item.deadline < nextWeekStart
        ? 'Mover para a próxima semana exige revisar o prazo informado.'
        : 'Mover para a próxima semana preserva a duração sem tocar nos compromissos protegidos.',
    },
    {
      action: 'shorten',
      durationMinutes: minimum,
      reason: `Encurtar para ${minimum} minutos cria uma versão mínima, sem alterar outros compromissos.`,
    },
    {
      action: 'defer',
      reason: 'Adiar mantém este item fora da semana atual até uma nova confirmação.',
    },
  ];
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
    const committedByDate = new Map(weekDates.map((date) => [date, 0]));
    const fixedByDate = new Map(weekDates.map((date) => [date, 0]));

    const markBusy = (date: string, start: number, end: number): void => {
      const windows = busyByDate.get(date) ?? [];
      windows.push({ start, end });
      windows.sort((a, b) => a.start - b.start);
      busyByDate.set(date, windows);
    };

    const addCommittedLoad = (date: string, duration: number, fixed: boolean): void => {
      committedByDate.set(date, (committedByDate.get(date) ?? 0) + duration);
      if (fixed) fixedByDate.set(date, (fixedByDate.get(date) ?? 0) + duration);
    };

    for (const block of input.existingBlocks) {
      if (!withinWeek(block.date, weekDates)) continue;
      const duration = durationBetween(block.startTime, block.endTime);
      entries.push({
        id: `existing:${block.id}`,
        kind: 'existing',
        date: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        title: block.title,
        durationMinutes: duration,
        isFixed: block.isFixed,
        persist: false,
        reason: block.isFixed ? 'Compromisso existente protegido.' : 'Bloco já existente mantido na prévia.',
      });
      markBusy(block.date, toMinutes(block.startTime), toMinutes(block.endTime));
      addCommittedLoad(block.date, duration, block.isFixed);
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
          ? habit.targetDays.length > 0
            ? weekDates.filter((date) => habit.targetDays.includes(utcDay(date)))
            : weekDates
          : weekDates.filter((date) => date.slice(8, 10) === '01');
      const duration = Math.max(5, habit.durationMinutes ?? 10);
      for (const date of dates) {
        const windows = busyByDate.get(date) ?? [];
        const habitWindow = defaultHabitWindow(habit, wake, sleep);
        const allowedWindows = intersectWindows(
          [habitWindow],
          availableWindowsForDate(date, input.limits.available, { start: wake, end: sleep }),
        );
        let placed = false;
        for (const allowed of allowedWindows) {
          for (let start = allowed.start; start + duration <= allowed.end; start += SLOT_STEP_MINUTES) {
            const end = start + duration;
            if (windows.some((window) => overlaps(start, end, window))) continue;
            const committed = committedByDate.get(date) ?? 0;
            const used = flexibleByDate.get(date) ?? 0;
            if (committed + used + duration > dayLimit) continue;
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
          if (placed) break;
        }
        if (!placed) {
          unscheduled.push({
            sourceItemId: `existing-habit:${habit.id}`,
            title: habit.title,
            reason: `Sem janela segura em ${date}.`,
            alternatives: [{
              action: 'defer',
              reason: 'Adiar esta ocorrência mantém o hábito nos outros dias previstos.',
            }],
          });
        }
      }
    }

    const placeFlexible = (item: RoutineClassifiedItem, preferredDates: string[], kind: 'task' | 'habit'): boolean => {
      const preferredDuration = adaptedDuration(item, input.capacity);
      const durations = kind === 'habit' && item.timeWindow
        ? [...new Set([preferredDuration, item.timeWindow.minDurationMinutes])]
        : [preferredDuration];
      for (const date of preferredDates) {
        if (!withinWeek(date, weekDates)) continue;
        const windows = busyByDate.get(date) ?? [];
        const itemWindow = {
          start: item.timeWindow ? Math.max(wake, toMinutes(item.timeWindow.startTime)) : wake,
          end: item.timeWindow ? Math.min(sleep, toMinutes(item.timeWindow.endTime)) : sleep,
        };
        const allowedWindows = intersectWindows(
          [itemWindow],
          availableWindowsForDate(date, input.limits.available, { start: wake, end: sleep }),
        );
        for (const allowed of allowedWindows) {
          for (const duration of durations) {
            const used = flexibleByDate.get(date) ?? 0;
            const committed = committedByDate.get(date) ?? 0;
            if (committed + used + duration > dayLimit) continue;
            for (let start = allowed.start; start + duration <= allowed.end; start += SLOT_STEP_MINUTES) {
              const end = start + duration;
              if (windows.some((window) => overlaps(start, end, window))) continue;
              const requested = item.durationMinutes ?? preferredDuration;
              const reduced = requested > duration;
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
                  ? `${input.capacity.reason} Bloco reduzido para ${duration} minutos dentro do limite aceito, sem alterar compromissos protegidos.`
                  : `${input.capacity.reason} Alocado em uma janela livre, respeitando compromissos e limite diário.`,
                priority: item.priority ?? 'medium',
                deadline: item.deadline ?? null,
                timeWindow: item.timeWindow ?? null,
              });
              markBusy(date, start, end);
              flexibleByDate.set(date, used + duration);
              return true;
            }
          }
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
      const dates = calendarDates(item, weekDates);
      if (!item.startTime || dates.length === 0) {
        unscheduled.push({
          sourceItemId: item.id,
          title: item.title,
          reason: 'Compromisso sem data ou recorrência semanal e horário válidos dentro desta semana.',
          alternatives: [],
        });
        continue;
      }
      const duration = item.durationMinutes ?? 60;
      for (const date of dates) {
        const start = toMinutes(item.startTime);
        const end = start + duration;
        if ((busyByDate.get(date) ?? []).some((window) => overlaps(start, end, window))) {
          unscheduled.push({
            sourceItemId: item.id,
            title: item.title,
            reason: `O compromisso protegido de ${date} conflita com outro horário protegido ou indisponível.`,
            alternatives: [{
              action: 'defer',
              reason: 'Revisar manualmente o conflito sem mover nem encurtar compromissos protegidos.',
            }],
          });
          continue;
        }
        entries.push({
          id: `calendar:${item.id}:${date}`,
          sourceItemId: item.id,
          kind: 'calendar',
          date,
          startTime: item.startTime,
          endTime: toTime(end),
          title: item.title,
          durationMinutes: duration,
          isFixed: true,
          persist: true,
          reason: item.date
            ? 'Data e horário vieram da fonte e foram protegidos como compromisso fixo.'
            : 'Dia recorrente e horário vieram da rotina guiada e foram protegidos como compromisso fixo.',
          priority: item.priority ?? 'urgent',
          deadline: item.deadline ?? null,
        });
        markBusy(date, start, end);
        addCommittedLoad(date, duration, true);
      }
    }

    for (const item of reviewed.filter((candidate) => candidate.kind === 'habit')) {
      const recurrence = item.recurrence;
      if (!recurrence) {
        unscheduled.push({
          sourceItemId: item.id,
          title: item.title,
          reason: 'Hábito sem frequência confirmada.',
          alternatives: [],
        });
        continue;
      }
      let dates: string[] = [];
      if (recurrence.frequency === 'daily') dates = weekDates;
      if (recurrence.frequency === 'weekly') {
        const selectedDays = recurrence.daysOfWeek ?? [];
        dates = weekDates.filter((date) => selectedDays.includes(utcDay(date)));
        if (dates.length === 0) dates = weekDates.slice(0, recurrence.timesPerWeek ?? 1);
      }
      if (recurrence.frequency === 'monthly') {
        dates = weekDates.filter((date) => date.slice(8, 10) === '01');
      }
      for (const date of dates) {
        if (!placeFlexible(item, [date], 'habit')) {
          unscheduled.push({
            sourceItemId: item.id,
            title: item.title,
            reason: `Sem janela segura em ${date}.`,
            alternatives: conflictAlternatives(item, input.weekStart),
          });
        }
      }
    }

    const tasks = sortedTasks(reviewed.filter((candidate) => candidate.kind === 'task'));
    for (const item of tasks) {
      const allowedDates = item.date
        ? [item.date]
        : weekDates.filter((date) => !item.deadline || date <= item.deadline);
      if (!placeFlexible(item, allowedDates.length > 0 ? allowedDates : weekDates, 'task')) {
        unscheduled.push({
          sourceItemId: item.id,
          title: item.title,
          reason: 'Não coube sem ultrapassar a carga prevista ou colidir com compromissos protegidos.',
          alternatives: conflictAlternatives(item, input.weekStart),
        });
      }
    }

    entries.sort((left, right) => `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`));

    return {
      weekStart: input.weekStart,
      capacity: input.capacity,
      entries,
      days: weekDates.map((date) => {
        const flexibleMinutes = flexibleByDate.get(date) ?? 0;
        const fixedMinutes = fixedByDate.get(date) ?? 0;
        const predictedMinutes = (committedByDate.get(date) ?? 0) + flexibleMinutes;
        return {
          date,
          flexibleMinutes,
          fixedMinutes,
          predictedMinutes,
          capacityMinutes: dayLimit,
          utilizationPercent: dayLimit > 0 ? Math.round((predictedMinutes / dayLimit) * 100) : 0,
          status: statusForLoad(predictedMinutes, dayLimit),
        };
      }),
      contextItems,
      unscheduled,
    };
  }
}
