import { dedupeActions, findEquivalentAction } from "./action-similarity";

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

/** Corrige o texto de um item do Inbox, preservando o resto do registro. */
export function renameStoredGtdAction(itemId: string, title: string) {
  const clean = title.trim();
  if (!clean) return;
  const updated = readStoredGtdActions().map((item) => (
    item.id === itemId ? { ...item, text: clean, titulo: clean } : item
  ));
  localStorage.setItem("gtd-inbox-v1", JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("gtd-inbox-updated", { detail: { id: itemId } }));
}

export function markStoredGtdActionDone(itemId: string) {
  const raw = readStoredGtdActions();
  const updated = raw.map((item) => item.id === itemId ? { ...item, done: true } : item);
  localStorage.setItem("gtd-inbox-v1", JSON.stringify(updated));
}

/**
 * Grava uma ação no Inbox, ou devolve a equivalente que já estava lá.
 *
 * `created: false` significa que nada foi escrito — a chamadora deve dizer à
 * pessoa que aquilo já existe, em vez de fingir que registrou. Sugerir de novo
 * o que já está na lista é como o app perde confiança rápido.
 */
export function appendStoredGtdAction(input: {
  text: string;
  titulo?: string;
  razao?: string;
  source?: string;
}): StoredGtdAction & { created: boolean } {
  const title = (input.titulo || input.text).trim();

  // Só compara com o que ainda está valendo: item concluído ou arquivado não
  // deve impedir a pessoa de registrar a mesma coisa outra vez.
  const active = readStoredGtdActions().filter((item) => !item.done && !item.archived);
  const existing = findEquivalentAction(title, active, (item) => item.titulo || item.text);
  if (existing) return { ...existing, created: false };

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
  return { ...item, created: true };
}

export function buildGoalPriorityActions(
  goals: GoalPrioritySource[],
  options: {
    gtdItems?: StoredGtdAction[];
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
      const pending = orderedSubtasks(goal.subtasks).filter((subtask) => !subtask.done);
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

  const gtdItems = options.gtdItems ?? readStoredGtdActions();
  const captureActions = gtdItems
    .filter((item) => !item.archived && !item.sentToGoal && !item.done && item.clarified && item.tipo === "proxima_acao" && !item.linkedGoalId)
    .map((item) => ({
      id: `capture-${item.id}`,
      text: item.titulo || item.text,
      source: "capture" as const,
      gtdId: item.id,
    }));

  // Metas primeiro, e o dedupe preserva o primeiro de cada grupo: se a mesma
  // ação existe como passo de meta e como item solto do Inbox, quem fica é a
  // versão ligada à meta, que tem contexto e move progresso.
  const actions = dedupeActions([...goalActions, ...captureActions], (action) => action.text);
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
  options: { gtdItems?: StoredGtdAction[]; limit?: number; focusGoalId?: string | number | null } = {},
): GoalPriorityAction[] {
  return buildGoalPriorityActions(goals, {
    gtdItems: options.gtdItems,
    limit: options.limit ?? NEXT_ACTIONS_LIMIT,
    focusGoalId: options.focusGoalId,
  });
}

/** Onde fica o objetivo que a pessoa marcou como principal. */
export const PRIMARY_GOAL_KEY = "airia-primary-goal-v1";

export function readPrimaryGoalId(): string | null {
  try {
    const raw = localStorage.getItem(PRIMARY_GOAL_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function writePrimaryGoalId(goalId: string | number | null) {
  try {
    if (goalId === null) localStorage.removeItem(PRIMARY_GOAL_KEY);
    else localStorage.setItem(PRIMARY_GOAL_KEY, String(goalId));
  } catch {
    /* modo privado: a escolha vale só para esta sessão */
  }
}

/**
 * Escolhe o objetivo que ocupa o card grande da Home e devolve o resto para a
 * lista compacta.
 *
 * A ordem é: o que ela marcou como principal, e só então a heurística.
 *
 * A heurística ("o mais perto de fechar") continua sendo o padrão porque
 * funciona sem pedir nada e resolve de graça a troca de foco — quando o objetivo
 * em destaque conclui, ele sai dos elegíveis e o seguinte assume sozinho. Mas
 * quem sabe o que é urgente é ela, não a porcentagem, então a escolha manual
 * passa na frente.
 *
 * `preferredId` só vale se o objetivo ainda for elegível: existir, não estar
 * pausado, não estar concluído e ter ação pendente. Falhando qualquer uma
 * dessas, cai na heurística — é o que impede a escolha de ontem de virar um card
 * morto hoje.
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

  const preferred = options.preferredId === undefined || options.preferredId === null
    ? null
    : eligible.find((model) => String(model.id) === String(options.preferredId)) ?? null;

  if (preferred) {
    return { focus: preferred, others: models.filter((model) => model.id !== preferred.id) };
  }

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
