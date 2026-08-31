/**
 * Contrato visual do workspace de Objetivos.
 *
 * O Elisi junta nota + desdobramento dentro do mesmo objetivo.
 * Na Airia isso já tem nome: Resultado, Agora, Caminho e o texto livre
 * persistido em `description` (o store espelha isso em `progress`).
 * Esta camada só decide o que mostrar; não cria outra fonte de verdade.
 */

export type GoalNoteSource = {
  description?: string | null;
  progress?: string | null;
  currentReality?: string | null;
};

export function resolveGoalNoteDraft(goal: GoalNoteSource): string {
  const description = typeof goal.description === "string" ? goal.description.trim() : "";
  if (description) return description;
  const progress = typeof goal.progress === "string" ? goal.progress.trim() : "";
  if (progress && progress !== "Em andamento" && progress !== "In progress") return progress;
  return "";
}

export function buildGoalNotePatch(note: string): { description: string } {
  return { description: note.trim() };
}

export function shouldShowGoalPathPane(goal: {
  subtasks?: unknown[];
  milestones?: unknown[];
}): boolean {
  return (goal.subtasks?.length ?? 0) > 0 || (goal.milestones?.length ?? 0) > 0;
}

/**
 * Elisi mostra nota e tarefa ao mesmo tempo.
 * Abas que escondem uma para ver a outra são o motivo de o split
 * "ainda não funcionar".
 */
export function resolveGoalWorkspaceLayout(goal: {
  subtasks?: unknown[];
  milestones?: unknown[];
}): { showNote: true; showAgora: true; showPath: boolean } {
  return {
    showNote: true,
    showAgora: true,
    showPath: shouldShowGoalPathPane(goal),
  };
}

/** Desktop split only when the viewport already matches. Avoids a stacked first paint. */
export function readWideGoalsLayout(query?: { matches: boolean } | null): boolean {
  return Boolean(query?.matches);
}

/** The workspace follows the active list. Paused/done ids do not stay selected. */
export function pickActiveWorkspaceGoal<T extends { id: string | number }>(
  activeGoals: T[],
  selectedId?: string | number | null,
  focusedId?: string | number | null,
): T | null {
  const wanted = selectedId ?? focusedId ?? null;
  if (wanted != null) {
    const match = activeGoals.find((goal) => String(goal.id) === String(wanted));
    if (match) return match;
  }
  return activeGoals[0] ?? null;
}
