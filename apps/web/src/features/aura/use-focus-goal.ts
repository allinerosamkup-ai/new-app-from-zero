import {
  selectFocusGoal,
  type GoalCardModel,
  type GoalPrioritySource,
} from "../../utils/goal-priority-actions";

/**
 * Qual objetivo ocupa o card grande — resposta única para a tela inteira.
 *
 * Existe porque duas superfícies precisam concordar: o `GoalFocusCard` mostra a
 * primeira ação do objetivo principal, e o `NextActionsCard` logo abaixo precisa
 * PULAR exatamente essa. Se cada um calculasse o foco por conta própria, uma
 * A prioridade não é uma escolha local: a Airia mantém uma única proposta, e
 * o foco secundário é uma ordenação determinística dos Objetivos persistidos.
 * Assim dois aparelhos não exibem ações concorrentes.
 */

export function useFocusGoal(goals: GoalPrioritySource[]): {
  focus: GoalCardModel | null;
  others: GoalCardModel[];
  primaryId: string | null;
} {
  const pausedIds = goals
    .filter((goal) => Boolean((goal as GoalPrioritySource & { pausedAt?: string | null }).pausedAt))
    .map((goal) => goal.id);
  const { focus, others } = selectFocusGoal(goals, { pausedIds });

  return { focus, others, primaryId: null };
}
