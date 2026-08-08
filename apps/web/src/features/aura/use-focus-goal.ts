import { useCallback, useEffect, useState } from "react";

import {
  parsePausedGoalIds,
  readPrimaryGoalId,
  selectFocusGoal,
  writePrimaryGoalId,
  type GoalCardModel,
  type GoalPrioritySource,
} from "../../utils/goal-priority-actions";

/**
 * Qual objetivo ocupa o card grande — resposta única para a tela inteira.
 *
 * Existe porque duas superfícies precisam concordar: o `GoalFocusCard` mostra a
 * primeira ação do objetivo principal, e o `NextActionsCard` logo abaixo precisa
 * PULAR exatamente essa. Se cada um calculasse o foco por conta própria, uma
 * divergência mínima (uma leitura de localStorage defasada, uma reidratação no
 * meio) faria a mesma ação aparecer duas vezes — que é o bug que isto conserta.
 *
 * A escolha manual e os objetivos pausados vivem em localStorage, fora do React.
 * Mudança nesses valores não dispara render sozinha, então há um evento próprio:
 * marcar um objetivo como principal em Objetivos precisa refletir na Home sem
 * recarregar.
 */

export const PAUSED_GOALS_KEY = "airia-paused-goals-v1";
export const FOCUS_GOAL_CHANGED_EVENT = "airia-focus-goal-changed";

function readPausedIds(): string[] {
  try {
    return parsePausedGoalIds(localStorage.getItem(PAUSED_GOALS_KEY));
  } catch {
    return [];
  }
}

/** Marca (ou desmarca) o objetivo principal e avisa quem estiver na tela. */
export function setPrimaryGoal(goalId: string | number | null) {
  writePrimaryGoalId(goalId);
  window.dispatchEvent(new CustomEvent(FOCUS_GOAL_CHANGED_EVENT, { detail: goalId }));
}

export function useFocusGoal(goals: GoalPrioritySource[]): {
  focus: GoalCardModel | null;
  others: GoalCardModel[];
  primaryId: string | null;
} {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener(FOCUS_GOAL_CHANGED_EVENT, bump);
    // `storage` cobre a outra aba; o evento próprio cobre esta.
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(FOCUS_GOAL_CHANGED_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, [bump]);

  // tick força a releitura do localStorage; o valor em si não é usado.
  const primaryId = tick >= 0 ? readPrimaryGoalId() : null;
  const { focus, others } = selectFocusGoal(goals, {
    pausedIds: readPausedIds(),
    preferredId: primaryId,
  });

  return { focus, others, primaryId };
}
