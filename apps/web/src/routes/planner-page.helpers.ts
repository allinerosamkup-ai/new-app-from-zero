export type TimelineBlockStatus = "planned" | "completed" | "postponed";
export type TimelineBlockIntensity = "L" | "M" | "P";
export type PlannerCategory = "trabalho" | "autocuidado" | "social" | "pessoal" | "casa";
export type TimelineBlockNoteMode = "text" | "checklist";

export type TimelineChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type TimelineRecurringConfig = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "custom";
  days: number[];
  everyNDays: number;
};

export type FormStateLike = {
  date?: string;
  title: string;
  time: string;
  endTime?: string;
  category: string;
  energyLevel: 1 | 2 | 3 | 4 | 5;
  noteMode?: TimelineBlockNoteMode;
  note?: string;
  checklist?: TimelineChecklistItem[];
  recurring?: TimelineRecurringConfig;
  lastResetDate?: string;
  persistentReminderEnabled?: boolean;
  persistentReminderIntervalMinutes?: number | null;
  alarmEnabled?: boolean;
  vibrateEnabled?: boolean;
  recurringNotificationEnabled?: boolean;
  visualRepeatEnabled?: boolean;
  icon?: string;
  color?: string;
};

export type PlannerTaskLike = {
  id: string;
  title: string;
  time: string;
  endTime: string;
  done: boolean;
  category?: string | null;
  source?: string;
  link?: string;
  persistentReminderEnabled?: boolean | null;
  persistentReminderIntervalMinutes?: number | null;
  alarmEnabled?: boolean | null;
  vibrateEnabled?: boolean | null;
  recurringNotificationEnabled?: boolean | null;
  visualRepeatEnabled?: boolean | null;
  icon?: string | null;
  color?: string | null;
  intensity?: string | null;
  energyLevel?: 1 | 2 | 3 | 4 | 5 | null;
  isAiSuggested?: boolean | null;
  aiReasoning?: string | null;
  gcalEventId?: string | null;
};

export type PlannerAgendaSlot =
  | {
      kind: "task";
      key: string;
      time: string;
      endTime: string;
      durationLabel: string;
      category: PlannerCategory;
      task: PlannerTaskLike;
    }
  | {
      kind: "empty";
      key: string;
      time: string;
      title: string;
      description: string;
    };

export type SwipeGestureInput = {
  deltaX: number;
  deltaY: number;
};

const EMPTY_AGENDA_TEMPLATE: Array<Pick<Extract<PlannerAgendaSlot, { kind: "empty" }>, "time" | "title" | "description">> = [
  {
    time: "08:00",
    title: "Manhã livre",
    description: "Um começo sem pressa para encaixar um primeiro bloco com calma.",
  },
  {
    time: "10:30",
    title: "Janela de foco",
    description: "Espaço aberto para trabalho profundo, estudo ou uma reunião curta.",
  },
  {
    time: "13:00",
    title: "Pausa do meio-dia",
    description: "Mantém a cara de agenda e deixa um respiro visível no centro do dia.",
  },
  {
    time: "15:30",
    title: "Bloco flexível",
    description: "Use para ajustar imprevistos, deslocamentos ou uma tarefa leve.",
  },
  {
    time: "18:00",
    title: "Fechamento do dia",
    description: "Reserve um encerramento gentil para não deixar a agenda sumir ao anoitecer.",
  },
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Encontra o próximo slot livre no planner a partir do horário atual.
 * - Se tiver slot livre hoje até 18:00, retorna o primeiro horário livre.
 * - Se não tiver (ou já for tarde), agenda para amanhã às 09:00.
 */
export function findSmartPlannerSlot(
  tasks: Array<{ time: string; endTime?: string | null }>,
  now: Date = new Date(),
): { time: string; date: string; isNextDay: boolean } {
  const todayKey = formatDateKeyFromDate(now);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const tomorrowKey = formatDateKeyFromDate(tomorrow);

  const currentMins = now.getHours() * 60 + now.getMinutes();
  // Arredonda para o próximo bloco de 30 min
  const startMins = Math.ceil((currentMins + 1) / 30) * 30;

  const DAY_END = 18 * 60; // 18:00
  const SLOT_DURATION = 30;

  if (startMins + SLOT_DURATION > DAY_END) {
    return { time: "09:00", date: tomorrowKey, isNextDay: true };
  }

  for (let s = startMins; s + SLOT_DURATION <= DAY_END; s += 30) {
    const slotEnd = s + SLOT_DURATION;
    const conflict = tasks.some((t) => {
      const ts = timeToMinutes(t.time);
      const te = t.endTime ? timeToMinutes(t.endTime) : ts + 30;
      return s < te && slotEnd > ts;
    });
    if (!conflict) {
      const h = String(Math.floor(s / 60)).padStart(2, "0");
      const m = String(s % 60).padStart(2, "0");
      return { time: `${h}:${m}`, date: todayKey, isNextDay: false };
    }
  }

  return { time: "09:00", date: tomorrowKey, isNextDay: true };
}

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60).toString().padStart(2, "0");
  const nextMinutes = (normalized % 60).toString().padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

export function subtractMinutesFromTime(time: string, minutesToSubtract: number): string {
  return addMinutesToTime(time, -minutesToSubtract);
}

function deriveCategoryFromTitle(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes("meditação") ||
    normalizedTitle.includes("meditar") ||
    normalizedTitle.includes("yoga") ||
    normalizedTitle.includes("autocuidado")
  ) {
    return "autocuidado";
  }

  if (
    normalizedTitle.includes("reunião") ||
    normalizedTitle.includes("análise") ||
    normalizedTitle.includes("trabalho") ||
    normalizedTitle.includes("projeto")
  ) {
    return "trabalho";
  }

  if (
    normalizedTitle.includes("casa") ||
    normalizedTitle.includes("mercado") ||
    normalizedTitle.includes("limpeza") ||
    normalizedTitle.includes("plantas") ||
    normalizedTitle.includes("planta")
  ) {
    return "casa";
  }

  if (
    normalizedTitle.includes("almoço") ||
    normalizedTitle.includes("social") ||
    normalizedTitle.includes("amigo")
  ) {
    return "social";
  }

  return "pessoal";
}

export function normalizePlannerCategory(category?: string | null, title = "") {
  const value = (category ?? "").trim().toLowerCase();

  if (value === "trabalho") return "trabalho";
  if (value === "autocuidado" || value === "saude" || value === "saúde") return "autocuidado";
  if (value === "self-care" || value === "selfcare" || value === "health" || value === "energia" || value === "humor") return "autocuidado";
  if (value === "social") return "social";
  if (value === "foco") return "trabalho";
  if (value === "casa") return "casa";
  if (value === "pessoal" || value === "geral" || value === "rotina" || value === "lazer" || value === "planning" || value === "outro") return "pessoal";
  return deriveCategoryFromTitle(title);
}

export function mapEnergyLevelToIntensity(
  energyLevel: FormStateLike["energyLevel"],
  fallback: TimelineBlockIntensity = "M",
): TimelineBlockIntensity {
  if (energyLevel >= 4) return "P";
  if (energyLevel <= 2) return "L";
  return "M";
}

export function mapIntensityToEnergyLevel(intensity?: string | null): FormStateLike["energyLevel"] {
  const value = (intensity ?? "").trim().toUpperCase();

  if (value === "P") return 4;
  if (value === "L") return 2;
  return 3;
}

export function buildTimelineBlockInput(
  form: FormStateLike,
  options?: {
    id?: string;
    durationMinutes?: number;
    fallbackIntensity?: TimelineBlockIntensity;
    fallbackStatus?: TimelineBlockStatus;
    isAiSuggested?: boolean;
    aiReasoning?: string | null;
  },
) {
  const payload: any = {
    ...(options?.id ? { id: options.id } : {}),
    title: form.title.trim(),
    startTime: form.time,
    endTime: form.endTime || addMinutesToTime(form.time, options?.durationMinutes ?? 30),
    category: normalizePlannerCategory(form.category, form.title),
    intensity: mapEnergyLevelToIntensity(form.energyLevel, options?.fallbackIntensity),
    energyLevel: form.energyLevel >= 4 ? 'alta' : form.energyLevel <= 2 ? 'leve' : 'media',
    status: options?.fallbackStatus ?? "planned",
    ...(options?.isAiSuggested !== undefined ? { isAiSuggested: options.isAiSuggested } : {}),
    ...(options?.aiReasoning !== undefined ? { aiReasoning: options.aiReasoning } : {}),
  };

  const hasMetadata =
    form.noteMode !== undefined ||
    form.note !== undefined ||
    form.checklist !== undefined ||
    form.recurring !== undefined ||
    form.lastResetDate !== undefined ||
    form.persistentReminderEnabled !== undefined ||
    form.persistentReminderIntervalMinutes !== undefined ||
    form.alarmEnabled !== undefined ||
    form.vibrateEnabled !== undefined ||
    form.visualRepeatEnabled !== undefined;

  if (!hasMetadata) {
    return payload;
  }

  return {
    ...payload,
    noteMode: form.noteMode,
    note: form.note,
    checklist: form.checklist,
    recurring: form.recurring,
    lastResetDate: form.lastResetDate,
    persistentReminderEnabled: form.persistentReminderEnabled,
    persistentReminderIntervalMinutes: form.persistentReminderIntervalMinutes,
    alarmEnabled: form.alarmEnabled,
    vibrateEnabled: form.vibrateEnabled,
    recurringNotificationEnabled: form.recurringNotificationEnabled,
    visualRepeatEnabled: form.visualRepeatEnabled,
    icon: form.icon,
    color: form.color,
  };
}

export function resolvePlannerBlockDate(formDate: string | undefined, fallbackDate: string): string {
  const candidate = (formDate ?? "").trim();
  return DATE_PATTERN.test(candidate) ? candidate : fallbackDate;
}

export function formatTimelineDurationLabel(startTime: string, endTime: string): string {
  const delta = timeToMinutes(endTime) - timeToMinutes(startTime);
  const safeMinutes = delta > 0 ? delta : 30;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes.toString().padStart(2, "0")}`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes} min`;
}

export function buildPlannerAgendaSlots(tasks: PlannerTaskLike[]): PlannerAgendaSlot[] {
  const slots: PlannerAgendaSlot[] = [];

  for (let i = 6; i <= 23; i++) {
    const time = `${i.toString().padStart(2, "0")}:00`;
    slots.push({
      kind: "empty",
      key: `hour-${time}`,
      time,
      title: "",
      description: "",
    });
  }

  tasks.forEach((task) => {
    // Skip all-day tasks from the vertical timeline
    if (task.time === "00:00" && task.endTime === "23:59") return;

    slots.push({
      kind: "task",
      key: task.id,
      time: task.time,
      endTime: task.endTime,
      durationLabel: formatTimelineDurationLabel(task.time, task.endTime),
      category: normalizePlannerCategory(task.category, task.title),
      task,
    });
  });

  slots.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const deduped: PlannerAgendaSlot[] = [];
  slots.forEach((slot) => {
    if (slot.kind === "empty" && !slot.title) {
      const hasTaskAtSameTime = tasks.some((t) => t.time === slot.time);
      if (hasTaskAtSameTime) return;
    }
    deduped.push(slot);
  });

  return deduped;
}

export function resolveTaskCardSwipeAction(
  gesture: SwipeGestureInput,
  threshold = 76,
): "complete" | "delete" | null {
  const absX = Math.abs(gesture.deltaX);
  const absY = Math.abs(gesture.deltaY);

  if (absX < threshold || absX < absY * 1.35) {
    return null;
  }

  return gesture.deltaX < 0 ? "complete" : "delete";
}

export function shouldNavigateAgendaBySwipe(
  gesture: SwipeGestureInput,
  threshold = 168,
): boolean {
  const absX = Math.abs(gesture.deltaX);
  const absY = Math.abs(gesture.deltaY);

  return absX >= threshold && absX >= absY * 2;
}

export function stripGoogleCalendarTaskId(taskId: string): string {
  return parseGoogleCalendarTaskId(taskId).eventId;
}

export function buildGoogleCalendarTaskId(calendarId: string | null | undefined, eventId: string): string {
  const safeCalendarId = encodeURIComponent(calendarId?.trim() || "primary");
  const safeEventId = encodeURIComponent(eventId);
  return `gcal-${safeCalendarId}::${safeEventId}`;
}

export function parseGoogleCalendarTaskId(taskId: string): { calendarId: string; eventId: string } {
  if (!taskId.startsWith("gcal-")) {
    return { calendarId: "primary", eventId: taskId };
  }

  const payload = taskId.slice(5);
  const separatorIndex = payload.indexOf("::");
  if (separatorIndex === -1) {
    return { calendarId: "primary", eventId: payload };
  }

  return {
    calendarId: decodeURIComponent(payload.slice(0, separatorIndex)) || "primary",
    eventId: decodeURIComponent(payload.slice(separatorIndex + 2)),
  };
}

export function stripGoogleCalendarTaskTitle(title: string): string {
  const cleaned = title.replace(/^📅\s*/u, "").trim();
  return cleaned || "Evento";
}
