type InsightActionSource = "weekly_endpoint" | "local_fallback";

export type InsightActionDecisionInput = {
  checkins: number;
  action: string;
  actionTitle: string;
  category: string;
  source: InsightActionSource;
};

export type InsightActionDecision = InsightActionDecisionInput & {
  canSaveToPlanner: boolean;
  evidence: string;
  reason: string | null;
};

export type MoodDayHighlight = {
  day: string;
  mood: number;
};

export function resolveMoodDayHighlights<T extends MoodDayHighlight>(
  bestDay: T | null,
  worstDay: T | null,
): { bestDay: T | null; worstDay: T | null } {
  return {
    bestDay,
    worstDay: worstDay && worstDay.day !== bestDay?.day ? worstDay : null,
  };
}

export function formatEstimatedMenstrualPhase(
  phaseLabel: string,
  estimatedCycleDay: number | null,
): string {
  const dayLabel = estimatedCycleDay === null ? "" : ` · D${estimatedCycleDay}`;
  return `Estimativa: ${phaseLabel}${dayLabel}`;
}

export function buildInsightActionDecision(input: InsightActionDecisionInput): InsightActionDecision {
  const checkins = Math.max(0, Math.floor(input.checkins || 0));
  const hasMinimumEvidence = checkins >= 3;

  return {
    ...input,
    checkins,
    canSaveToPlanner: hasMinimumEvidence,
    evidence: input.source === "weekly_endpoint"
      ? `Base: ${checkins} check-ins no período e recomendação semanal.`
      : `Base: ${checkins} check-ins no período e leitura local de fase.`,
    reason: hasMinimumEvidence ? null : "Precisa de pelo menos 3 check-ins para virar ação no Planner.",
  };
}
