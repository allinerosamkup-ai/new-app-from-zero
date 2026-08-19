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

export type TemporalMoodEntry = {
  date: string;
  humor: number;
  energia: number;
};

export type TemporalRhythmSignal = {
  observedDays: number;
  confidence: "insufficient" | "early" | "supported";
  moodChange: number | null;
  energyChange: number | null;
  lowerRhythmStreak: number;
  recovery: number | null;
};

/**
 * Produz somente sinais descritivos entre registros da própria pessoa.
 * Não usa calendário: dia da semana e dia do mês não são previsão de humor.
 */
export function buildTemporalRhythmSignal(entries: TemporalMoodEntry[]): TemporalRhythmSignal {
  const byDate = new Map<string, TemporalMoodEntry>();
  for (const entry of entries) byDate.set(entry.date, entry);
  const sorted = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  const observedDays = sorted.length;
  const confidence = observedDays < 7 ? "insufficient" : observedDays < 14 ? "early" : "supported";

  if (observedDays < 7) {
    return { observedDays, confidence, moodChange: null, energyChange: null, lowerRhythmStreak: 0, recovery: null };
  }

  const windowSize = observedDays >= 14 ? 3 : 2;
  const recent = sorted.slice(-windowSize);
  const previous = sorted.slice(-windowSize * 2, -windowSize);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const moodChange = previous.length === windowSize
    ? average(recent.map((entry) => entry.humor)) - average(previous.map((entry) => entry.humor))
    : null;
  const energyChange = previous.length === windowSize
    ? average(recent.map((entry) => entry.energia)) - average(previous.map((entry) => entry.energia))
    : null;

  const prior = sorted.slice(0, -windowSize);
  const priorComposite = prior.length > 0
    ? average(prior.map((entry) => (entry.humor + entry.energia) / 2))
    : null;
  let lowerRhythmStreak = 0;
  if (priorComposite !== null) {
    for (const entry of [...sorted].reverse()) {
      if ((entry.humor + entry.energia) / 2 <= priorComposite - 0.8) lowerRhythmStreak += 1;
      else break;
    }
  }

  const recentComposites = sorted.slice(-Math.min(7, observedDays)).map((entry) => (entry.humor + entry.energia) / 2);
  const recovery = recentComposites.length >= 3
    ? recentComposites[recentComposites.length - 1] - Math.min(...recentComposites.slice(0, -1))
    : null;

  return {
    observedDays,
    confidence,
    moodChange: moodChange === null ? null : Number(moodChange.toFixed(1)),
    energyChange: energyChange === null ? null : Number(energyChange.toFixed(1)),
    lowerRhythmStreak,
    recovery: recovery === null || recovery < 0.8 ? null : Number(recovery.toFixed(1)),
  };
}

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
      ? `Usei ${checkins} check-ins para compor esta leitura da semana.`
      : `Usei ${checkins} check-ins para compor esta leitura do seu ritmo.`,
    reason: hasMinimumEvidence ? null : "Ainda faltam alguns check-ins para transformar isso em um próximo passo.",
  };
}
