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
  subtasks?: Array<{ id: string | number; title: string; done: boolean }>;
};

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
      const nextSub = goal.subtasks?.find((subtask) => !subtask.done);
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
    .filter((item): item is GoalPriorityAction => Boolean(item));

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
