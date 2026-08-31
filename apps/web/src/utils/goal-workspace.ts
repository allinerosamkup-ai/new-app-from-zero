/**
 * Contrato visual do workspace de Objetivos.
 *
 * O Elisi junta nota + desdobramento dentro do mesmo objetivo.
 * Na Airia isso já tem nome: Resultado, Agora, Caminho e o texto livre
 * persistido em `description` (o store espelha isso em `progress`).
 * Esta camada só decide o que mostrar; não cria outra fonte de verdade.
 */

export type GoalWorkspacePane = "agora" | "caminho" | "nota";

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

export function shouldShowGoalPathPane(_goal: {
  subtasks?: unknown[];
  milestones?: unknown[];
}): boolean {
  return true;
}

export const GOAL_WORKSPACE_PANES: Array<{
  id: GoalWorkspacePane;
  pt: string;
  en: string;
}> = [
  { id: "agora", pt: "Agora", en: "Now" },
  { id: "caminho", pt: "Caminho", en: "Path" },
  { id: "nota", pt: "Nota", en: "Note" },
];
