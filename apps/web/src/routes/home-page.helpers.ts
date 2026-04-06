export type AgendaBlock = {
  horario_inicio: string;
  horario_fim: string;
  tipo: "trabalho" | "autocuidado" | "casa" | "social" | "descanso" | "refeicao" | "flexivel";
  label: string;
  tarefas_sugeridas: string[];
  razao_ia: string;
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
  const seenTasks = new Set<string>();

  return blocks.map((block) => {
    const uniqueTasks = uniqueStrings(block.tarefas_sugeridas).filter((task) => {
      const key = comparableKey(task);
      if (seenTasks.has(key)) return false;
      seenTasks.add(key);
      return true;
    });

    return {
      ...block,
      label: normalizeWhitespace(block.label),
      razao_ia: normalizeWhitespace(block.razao_ia),
      tarefas_sugeridas: uniqueTasks,
    };
  });
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
