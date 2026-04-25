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
