export type AgendaBlock = {
  horario_inicio: string;
  horario_fim: string;
  tipo: "trabalho" | "autocuidado" | "casa" | "social" | "descanso" | "refeicao" | "flexivel";
  label: string;
  tarefas_sugeridas: string[];
  razao_ia: string;
  local_date?: string;
  intensity?: "L" | "M" | "P";
  blocked_reason?: string;
};

export type HomeAiMsg = {
  motivacional: string;
  autocuidado: string[];
  proactive: { emoji: string; title: string; desc: string; actionPath: string | null };
};

type HomeAiRequestKeyInput = {
  localDate: string;
  partOfDay: string;
  mood: string;
  taskCount: number;
  goalTitles: string[];
  pendingTaskTitles: string[];
  latestCheckinKey: string | null;
  refreshBucket: string;
};

export type HomeAgendaTaskItem = {
  id: string | number;
  kind: "task";
  title: string;
  time: string;
  category?: string;
  isAiSuggested?: boolean;
};

export type HomeAgendaHabitItem = {
  id: string;
  kind: "habit";
  title: string;
  icon?: string;
  reminderTime?: string | null;
};

export type HomeAgendaItem = HomeAgendaTaskItem | HomeAgendaHabitItem;

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function comparableKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeWhitespace(value);
    if (!normalized) return;

    const key = comparableKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function safeTimeValue(time: string | undefined): string {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "23:59";
}

function timeToMinutesValue(time: string | undefined): number {
  const safe = safeTimeValue(time);
  const [hour, minute] = safe.split(":").map(Number);
  return hour * 60 + minute;
}

function habitCompletionCount(habit: { completions?: Array<{ completionCount?: number | null } | unknown> }): number {
  const completion = habit.completions?.[0];
  if (!completion) return 0;
  if (completion !== null && typeof completion === "object" && "completionCount" in completion) {
    const count = Number((completion as { completionCount?: number | null }).completionCount ?? 1);
    return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
  }
  return 1;
}

function habitTargetCount(habit: { targetCount?: number | null }): number {
  const count = Number(habit.targetCount ?? 1);
  return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
}

export function buildQuarterHourRefreshBucket(referenceDate: Date): string {
  const quarter = Math.floor(referenceDate.getMinutes() / 15);
  return [
    referenceDate.getFullYear(),
    String(referenceDate.getMonth() + 1).padStart(2, "0"),
    String(referenceDate.getDate()).padStart(2, "0"),
    String(referenceDate.getHours()).padStart(2, "0"),
    quarter,
  ].join("-");
}

export function buildHomeAiRequestKey(input: HomeAiRequestKeyInput): string {
  return JSON.stringify({
    localDate: input.localDate,
    partOfDay: input.partOfDay,
    mood: input.mood,
    taskCount: input.taskCount,
    goalTitles: [...uniqueStrings(input.goalTitles)].sort((a, b) => a.localeCompare(b, "pt-BR")),
    pendingTaskTitles: [...uniqueStrings(input.pendingTaskTitles)].sort((a, b) => a.localeCompare(b, "pt-BR")),
    latestCheckinKey: input.latestCheckinKey ?? "",
    refreshBucket: input.refreshBucket,
  });
}

export function buildHomeAgendaPreview(input: {
  tasks: Array<{ id: string | number; title: string; time: string; done: boolean; category?: string; isAiSuggested?: boolean }>;
  habits: Array<{ id: string; title: string; icon?: string; targetCount?: number | null; completions?: Array<{ completionCount?: number | null } | unknown>; reminderEnabled?: boolean; reminderTime?: string | null }>;
  referenceDate?: Date;
}): { tasks: HomeAgendaTaskItem[]; habit: HomeAgendaHabitItem | null; items: HomeAgendaItem[] } {
  const nowMinutes = input.referenceDate
    ? input.referenceDate.getHours() * 60 + input.referenceDate.getMinutes()
    : null;

  const tasks = input.tasks
    .filter((task) => !task.done && normalizeWhitespace(task.title).length > 0)
    .filter((task) => nowMinutes === null || timeToMinutesValue(task.time) >= nowMinutes)
    .sort((a, b) => safeTimeValue(a.time).localeCompare(safeTimeValue(b.time)))
    .slice(0, 3)
    .map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: normalizeWhitespace(task.title),
      time: safeTimeValue(task.time),
      category: task.category,
      isAiSuggested: Boolean(task.isAiSuggested),
    }));

  const taskTitles = new Set(tasks.map((task) => comparableKey(task.title)));
  const habit = input.habits
    .filter((habit) => normalizeWhitespace(habit.title).length > 0)
    .filter((habit) => habitCompletionCount(habit) < habitTargetCount(habit))
    .filter((habit) => !taskTitles.has(comparableKey(habit.title)))
    .sort((a, b) => safeTimeValue(a.reminderTime ?? undefined).localeCompare(safeTimeValue(b.reminderTime ?? undefined)))
    .map((habit) => ({
      id: habit.id,
      kind: "habit" as const,
      title: normalizeWhitespace(habit.title),
      icon: habit.icon,
      reminderTime: habit.reminderTime,
    }))[0] ?? null;

  const items = [...tasks, ...(habit ? [habit] : [])].sort((a, b) => {
    const aTime = a.kind === "task" ? a.time : a.reminderTime ?? undefined;
    const bTime = b.kind === "task" ? b.time : b.reminderTime ?? undefined;
    return safeTimeValue(aTime).localeCompare(safeTimeValue(bTime));
  });

  return { tasks, habit, items };
}

export function shouldRefreshHomeSuggestionAfterAction(item: { kind: "task" | "habit"; isAiSuggested?: boolean }): boolean {
  return item.kind === "task" && Boolean(item.isAiSuggested);
}

export function resolveHomeAgendaSuggestionDate(localDate: string, hour: number): string {
  if (hour < 18) {
    return localDate;
  }

  const date = new Date(`${localDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return localDate;
  }

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function extractHomeRepeatContext(message: HomeAiMsg | null): {
  previousMotivacional: string | null;
  previousAutocuidado: string[];
} {
  if (!message) {
    return {
      previousMotivacional: null,
      previousAutocuidado: [],
    };
  }

  return {
    previousMotivacional: normalizeWhitespace(message.motivacional) || null,
    previousAutocuidado: uniqueStrings(message.autocuidado),
  };
}

export function dedupeAgendaBlocks(blocks: AgendaBlock[]): AgendaBlock[] {
  const ALLOWED_TYPES = new Set<AgendaBlock["tipo"]>([
    "trabalho",
    "autocuidado",
    "casa",
    "social",
    "descanso",
    "refeicao",
    "flexivel",
  ]);
  const seenTasks = new Set<string>();

  return blocks
    .filter((block) => block && typeof block === "object")
    .map((block) => {
      const safeType = ALLOWED_TYPES.has(block.tipo) ? block.tipo : "flexivel";
      const safeLabel = normalizeWhitespace(typeof block.label === "string" ? block.label : "");
      const safeReason = normalizeWhitespace(typeof block.razao_ia === "string" ? block.razao_ia : "");
      const safeStart = typeof block.horario_inicio === "string" ? block.horario_inicio : "09:00";
      const safeEnd = typeof block.horario_fim === "string" ? block.horario_fim : "10:00";
      const taskList = Array.isArray(block.tarefas_sugeridas)
        ? block.tarefas_sugeridas.filter((task): task is string => typeof task === "string")
        : [];

      const uniqueTasks = uniqueStrings(taskList).filter((task) => {
        const key = comparableKey(task);
        if (seenTasks.has(key)) return false;
        seenTasks.add(key);
        return true;
      });

      return {
        ...block,
        tipo: safeType,
        horario_inicio: safeStart,
        horario_fim: safeEnd,
        label: safeLabel || "Bloco flexível",
        razao_ia: safeReason || "Ajustado para manter seu ritmo hoje.",
        tarefas_sugeridas: uniqueTasks,
      };
    })
    .filter((block) => block.tarefas_sugeridas.length > 0 || block.tipo === "descanso" || block.tipo === "refeicao")
    .slice(0, 10);
}

export function extractAgendaRepeatContext(blocks: AgendaBlock[]): {
  previousLabels: string[];
  previousTasks: string[];
} {
  return {
    previousLabels: uniqueStrings(blocks.map((block) => block.label)),
    previousTasks: uniqueStrings(blocks.flatMap((block) => block.tarefas_sugeridas)),
  };
}
