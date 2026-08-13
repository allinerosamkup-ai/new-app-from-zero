import { dedupeActions } from "./action-similarity";

export type GoalPriorityAction = {
  id: string;
  text: string;
  source: "goal";
  goalId?: string | number;
  goalTitle?: string;
  subId?: string | number;
};

export type GoalPrioritySource = {
  id: string | number;
  title: string;
  completedPct?: number;
  pausedAt?: string | null;
  subtasks?: Array<{
    id: string | number;
    title: string;
    done: boolean;
    order?: number;
    status?: 'pending' | 'done' | 'rejected' | 'deferred';
  }>;
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

export function buildGoalPriorityActions(
  goals: GoalPrioritySource[],
  options: {
    limit?: number;
    /**
     * Objetivo que já está no card grande da Home.
     *
     * Desse, a lista pula a primeira pendente e mostra a SEGUINTE: a primeira
     * está logo acima, no card, e repetir a mesma ação em dois lugares na mesma
     * tela é ruído — quem lê fica sem saber se são duas coisas ou uma.
     */
    focusGoalId?: string | number | null;
  } = {},
): GoalPriorityAction[] {
  const focusId = options.focusGoalId === undefined || options.focusGoalId === null
    ? null
    : String(options.focusGoalId);

  const goalActions = goals
    .filter((goal) => (goal.completedPct ?? 0) < 100)
    .map((goal) => {
      const pending = orderedSubtasks(goal.subtasks).filter((subtask) => (
        !subtask.done && subtask.status !== 'rejected' && subtask.status !== 'deferred'
      ));
      // O objetivo em foco entra a partir da segunda: se só tem uma pendente,
      // ela já está no card e o objetivo não contribui para a lista.
      const nextSub = String(goal.id) === focusId ? pending[1] : pending[0];
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

  const actions = dedupeActions(goalActions, (action) => action.text);
  return typeof options.limit === "number" ? actions.slice(0, options.limit) : actions;
}

/** Quantas ações a caixa da Home mostra. Cinco cabe na tela sem virar lista. */
export const NEXT_ACTIONS_LIMIT = 5;

/**
 * As próximas ações da pessoa, sem data nenhuma.
 *
 * A regra é conclusão, não prazo: a ação fica disponível até ser concluída, e a
 * ordem é metas antes de itens soltos, porque passo de meta move progresso e
 * item do Inbox só sai da lista.
 */
export function buildNextActions(
  goals: GoalPrioritySource[],
  options: { limit?: number; focusGoalId?: string | number | null } = {},
): GoalPriorityAction[] {
  return buildGoalPriorityActions(goals, {
    limit: options.limit ?? NEXT_ACTIONS_LIMIT,
    focusGoalId: options.focusGoalId,
  });
}

/**
 * Escolhe o objetivo que ocupa o card grande da Home e devolve o resto para a
 * lista compacta.
 *
 * A ordem é determinística sobre dados persistidos; prioridade pessoal e
 * capacidade não vivem no navegador como uma segunda verdade.
 */
export function selectFocusGoal(
  goals: GoalPrioritySource[],
  options: { pausedIds?: Array<string | number>; preferredId?: string | number | null } = {},
): { focus: GoalCardModel | null; others: GoalCardModel[] } {
  const paused = new Set((options.pausedIds ?? []).map(String));

  const models = goals.map(buildGoalCardModel);
  const eligible = models.filter((model) => (
    !paused.has(String(model.id))
    // Concluído não pode ocupar o card: não sobrou ação para fazer ali.
    && !model.completed
    // Sem ação pendente o card grande não teria botão — vai para a lista.
    && model.nextAction !== null
  ));

  const focus = eligible.length === 0 ? null : [...eligible].sort((left, right) => {
    const leftPct = left.totalActions === 0 ? 0 : left.completedActions / left.totalActions;
    const rightPct = right.totalActions === 0 ? 0 : right.completedActions / right.totalActions;
    if (rightPct !== leftPct) return rightPct - leftPct;
    // Empate: quem já andou mais em número absoluto. Depois, ordem de criação,
    // que é como o backend já devolve — desempate estável, sem sorteio.
    return right.completedActions - left.completedActions;
  })[0];

  return {
    focus: focus ?? null,
    others: models.filter((model) => model.id !== focus?.id),
  };
}

export function buildGoalCardModel(goal: GoalPrioritySource): GoalCardModel {
  const subtasks = orderedSubtasks(goal.subtasks);
  const completedActions = subtasks.filter((subtask) => subtask.done).length;
  const nextAction = subtasks.find((subtask) => (
    !subtask.done && subtask.status !== 'rejected' && subtask.status !== 'deferred'
  )) ?? null;
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

export function orderedSubtasks<T extends { id: string | number; order?: number }>(subtasks: T[] | undefined): T[] {
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
