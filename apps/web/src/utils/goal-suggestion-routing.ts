import type { Goal } from "../features/aura/types";

type GoalSuggestionTarget = {
  goalId: number | string;
  goalTitle: string;
  subtaskId?: number | string;
  subtaskTitle?: string;
};

type GoalSuggestionRouteState = {
  activeTab: "metas";
  openGoalId: number | string;
  openSubtaskId?: number | string;
  highlightText: string;
};

const STOP_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "ao",
  "aos",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "para",
  "por",
  "pra",
  "pro",
  "uma",
  "um",
]);

export function normalizeSuggestionText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeSuggestionText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function scoreCandidate(source: string, candidate: string): number {
  const normalizedSource = normalizeSuggestionText(source);
  const normalizedCandidate = normalizeSuggestionText(candidate);

  if (!normalizedSource || !normalizedCandidate || normalizedCandidate.length < 4) {
    return -1;
  }

  if (normalizedSource === normalizedCandidate) {
    return 500 + normalizedCandidate.length;
  }

  if (normalizedSource.includes(normalizedCandidate)) {
    return 400 + normalizedCandidate.length;
  }

  const sourceTokens = new Set(tokenize(source));
  const candidateTokens = tokenize(candidate);
  if (candidateTokens.length === 0) {
    return -1;
  }

  const overlap = candidateTokens.filter((token) => sourceTokens.has(token)).length;
  if (overlap === 0) {
    return -1;
  }

  const ratio = overlap / candidateTokens.length;
  if (overlap >= 2 && ratio >= 0.6) {
    return Math.round(ratio * 100) + overlap * 10 + normalizedCandidate.length;
  }

  return -1;
}

export function findGoalSuggestionTarget(
  suggestionText: string,
  goals: Goal[],
): GoalSuggestionTarget | null {
  let bestMatch: { score: number; target: GoalSuggestionTarget } | null = null;

  for (const goal of goals) {
    const goalScore = scoreCandidate(suggestionText, goal.title);
    if (goalScore > 0 && (!bestMatch || goalScore > bestMatch.score)) {
      bestMatch = {
        score: goalScore,
        target: {
          goalId: goal.id,
          goalTitle: goal.title,
        },
      };
    }

    for (const subtask of goal.subtasks) {
      const subtaskScore = scoreCandidate(suggestionText, subtask.title);
      if (subtaskScore > 0 && (!bestMatch || subtaskScore + 25 > bestMatch.score)) {
        bestMatch = {
          score: subtaskScore + 25,
        target: {
          goalId: goal.id,
          goalTitle: goal.title,
          subtaskId: subtask.id,
          subtaskTitle: subtask.title,
        },
        };
      }
    }
  }

  return bestMatch?.target ?? null;
}

export function buildGoalSuggestionRouteState(
  suggestionText: string,
  goals: Goal[],
): GoalSuggestionRouteState | null {
  const target = findGoalSuggestionTarget(suggestionText, goals);
  if (!target) {
    return null;
  }

  return {
    activeTab: "metas",
    openGoalId: target.goalId,
    ...(target.subtaskId ? { openSubtaskId: target.subtaskId } : {}),
    highlightText: target.subtaskTitle ?? target.goalTitle,
  };
}
