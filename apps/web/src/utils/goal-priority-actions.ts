export type GoalPriorityAction = {
  id: string;
  text: string;
  source: "goal" | "capture";
  goalId?: string | number;
  goalTitle?: string;
  subId?: string | number;
  gtdId?: string;
};

export type GoalPrioritySource = {
  id: string | number;
  title: string;
  completedPct?: number;
  subtasks?: Array<{ id: string | number; title: string; done: boolean; order?: number }>;
};

export type GoalCardModel = {
  id: string | number;
  result: string;
  nextAction: { id: string | number; title: string } | null;
  completedActions: number;
  totalActions: number;
  progressLabel: string;
  completed: boolean;
};

export type GoalTaskPlacement = "now" | "later" | "tomorrow";

export type StoredGtdAction = {
  id: string;
  text: string;
  titulo?: string;
  razao?: string;
  source?: string;
  capturedAt?: string;
  meta_sugerida?: string;
  tipo?: string;
  done?: boolean;
  archived?: boolean;
  sentToGoal?: boolean;
  linkedGoalId?: string | number | null;
  clarified?: boolean;
};

export function readStoredGtdActions(): StoredGtdAction[] {
  try {
    const raw = JSON.parse(localStorage.getItem("gtd-inbox-v1") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function markStoredGtdActionDone(itemId: string) {
  const raw = readStoredGtdActions();
  const updated = raw.map((item) => item.id === itemId ? { ...item, done: true } : item);
  localStorage.setItem("gtd-inbox-v1", JSON.stringify(updated));
}

export function appendStoredGtdAction(input: {
  text: string;
  titulo?: string;
  razao?: string;
  source?: string;
}): StoredGtdAction {
  const title = (input.titulo || input.text).trim();
  const item: StoredGtdAction = {
    id: `gtd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: title,
    titulo: title,
    razao: input.razao,
    source: input.source,
    capturedAt: new Date().toISOString(),
    clarified: true,
    tipo: "proxima_acao",
    done: false,
    archived: false,
  };
  const updated = [item, ...readStoredGtdActions()];
  localStorage.setItem("gtd-inbox-v1", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("gtd-inbox-updated", { detail: item }));
  return item;
}

export function buildGoalPriorityActions(
  goals: GoalPrioritySource[],
  options: { gtdItems?: StoredGtdAction[]; limit?: number } = {},
): GoalPriorityAction[] {
  const goalActions = goals
    .filter((goal) => (goal.completedPct ?? 0) < 100)
    .map((goal) => {
      const nextSub = orderedSubtasks(goal.subtasks).find((subtask) => !subtask.done);
      if (!nextSub) return null;

      return {
        id: `goal-${goal.id}-${nextSub.id}`,
        text: nextSub.title,
        source: "goal" as const,
        goalId: goal.id,
        goalTitle: goal.title,
        subId: nextSub.id,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const gtdItems = options.gtdItems ?? readStoredGtdActions();
  const captureActions = gtdItems
    .filter((item) => !item.archived && !item.sentToGoal && !item.done && item.clarified && item.tipo === "proxima_acao" && !item.linkedGoalId)
    .map((item) => ({
      id: `capture-${item.id}`,
      text: item.titulo || item.text,
      source: "capture" as const,
      gtdId: item.id,
    }));

  const actions = [...goalActions, ...captureActions];
  return typeof options.limit === "number" ? actions.slice(0, options.limit) : actions;
}

export function buildGoalCardModel(goal: GoalPrioritySource): GoalCardModel {
  const subtasks = orderedSubtasks(goal.subtasks);
  const completedActions = subtasks.filter((subtask) => subtask.done).length;
  const nextAction = subtasks.find((subtask) => !subtask.done) ?? null;
  const completed = (goal.completedPct ?? 0) >= 100;

  const progressLabel = completed
    ? "Resultado alcançado"
    : subtasks.length === 0
      ? "Pronto para definir o primeiro passo"
      : completedActions === 0
        ? "Primeiro movimento pronto"
        : `${completedActions} ${completedActions === 1 ? "movimento concluído" : "movimentos concluídos"}`;

  return {
    id: goal.id,
    result: goal.title,
    nextAction: nextAction ? { id: nextAction.id, title: nextAction.title } : null,
    completedActions,
    totalActions: subtasks.length,
    progressLabel,
    completed,
  };
}

function orderedSubtasks<T extends { id: string | number; order?: number }>(subtasks: T[] | undefined): T[] {
  return [...(subtasks ?? [])]
    .map((subtask, index) => ({ subtask, index }))
    .sort((left, right) => (left.subtask.order ?? left.index) - (right.subtask.order ?? right.index) || left.index - right.index)
    .map(({ subtask }) => subtask);
}

export function parsePausedGoalIds(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(
      parsed
        .filter((value) => typeof value === "string" || typeof value === "number")
        .map(String),
    )];
  } catch {
    return [];
  }
}

export function togglePausedGoalId(current: string[], goalId: string | number): string[] {
  const normalizedId = String(goalId);
  return current.includes(normalizedId)
    ? current.filter((id) => id !== normalizedId)
    : [...current, normalizedId];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeKey(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildGoalTaskSchedule(
  placement: GoalTaskPlacement,
  now = new Date(),
): { date: string; time: string } {
  if (placement === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return { date: localDateKey(tomorrow), time: "09:00" };
  }

  if (placement === "later") {
    if (now.getHours() < 18) {
      return { date: localDateKey(now), time: "18:00" };
    }
    if (now.getHours() >= 23) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return { date: localDateKey(tomorrow), time: "09:00" };
    }
    const nextHour = Math.min(now.getHours() + 1, 23);
    return { date: localDateKey(now), time: timeKey(nextHour, 0) };
  }

  const rounded = new Date(now);
  const minutes = Math.ceil((now.getMinutes() + 1) / 15) * 15;
  rounded.setMinutes(minutes, 0, 0);
  return {
    date: localDateKey(rounded),
    time: timeKey(rounded.getHours(), rounded.getMinutes()),
  };
}
