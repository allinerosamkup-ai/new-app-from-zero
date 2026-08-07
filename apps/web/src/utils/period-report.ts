import type { CheckinEntry } from "../features/aura/types";

/**
 * Análise de um intervalo fechado de dias.
 *
 * Existe porque o relatório de período estava sendo montado com a fase de HOJE
 * e o contexto "leitura atual" — então a IA escrevia sobre o dia atual e só
 * mencionava o período de passagem. Aqui nada é do dia de hoje: tudo é agregado
 * sobre a janela escolhida, e a comparação é entre a primeira e a segunda
 * metade dela.
 */

export type PeriodPreset = "7d" | "30d" | "90d" | "180d" | "custom";

export type PeriodRange = { start: string; end: string; label: string };

export type PeriodHalf = {
  days: number;
  observed: number;
  avgMood: number | null;
  avgEnergy: number | null;
};

export type FactorAssociation = {
  factor: string;
  daysWith: number;
  avgMoodWith: number;
  avgMoodWithout: number;
  difference: number;
};

export type PeriodReportData = {
  range: PeriodRange;
  /** Dias do intervalo, incluindo os dois extremos. */
  windowDays: number;
  observedDays: number;
  missingDays: number;
  /** Proporção de dias com registro. Abaixo de 0.3 a leitura é frágil. */
  coverage: number;
  sampling: "low" | "medium" | "high";
  avgMood: number | null;
  avgEnergy: number | null;
  bestDay: { date: string; mood: number; energy: number } | null;
  worstDay: { date: string; mood: number; energy: number } | null;
  volatility: number | null;
  /** Dias em que energia superou humor em 3+ — sinal de traço misto. */
  divergentDays: number;
  firstHalf: PeriodHalf;
  secondHalf: PeriodHalf;
  moodDelta: number | null;
  energyDelta: number | null;
  weekdayAverages: Array<{ weekday: number; avgMood: number; count: number }>;
  topFactors: FactorAssociation[];
  longestGapDays: number;
};

function toDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - avg) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

/** Converte um preset num intervalo fechado terminando hoje. */
export function resolvePeriodRange(
  preset: PeriodPreset,
  options: { today?: string; customStart?: string; customEnd?: string } = {},
): PeriodRange {
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  if (preset === "custom") {
    const start = options.customStart ?? today;
    const end = options.customEnd ?? today;
    // Tolera datas invertidas em vez de devolver janela negativa.
    const [from, to] = start <= end ? [start, end] : [end, start];
    return { start: from, end: to, label: `${from} a ${to}` };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 180;
  const start = toDate(today);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const label = preset === "7d" ? "última semana"
    : preset === "30d" ? "último mês"
      : preset === "90d" ? "últimos 90 dias"
        : "último semestre";

  return { start: dayKey(start), end: today, label };
}

function summarizeHalf(entries: CheckinEntry[], days: number): PeriodHalf {
  return {
    days,
    observed: entries.length,
    avgMood: mean(entries.map((entry) => entry.humor)),
    avgEnergy: mean(entries.map((entry) => entry.energia)),
  };
}

/** Quantos dias seguidos sem nenhum registro dentro da janela. */
function longestGap(sortedDates: string[], range: PeriodRange): number {
  if (sortedDates.length === 0) {
    return Math.round((toDate(range.end).getTime() - toDate(range.start).getTime()) / 86_400_000) + 1;
  }
  const boundaries = [range.start, ...sortedDates, range.end];
  let worst = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const gap = Math.round(
      (toDate(boundaries[i]).getTime() - toDate(boundaries[i - 1]).getTime()) / 86_400_000,
    ) - 1;
    if (gap > worst) worst = gap;
  }
  return Math.max(0, worst);
}

export function buildPeriodReportData(
  history: CheckinEntry[],
  range: PeriodRange,
): PeriodReportData {
  const windowDays = Math.round(
    (toDate(range.end).getTime() - toDate(range.start).getTime()) / 86_400_000,
  ) + 1;

  const inRange = history
    .filter((entry) => entry.date >= range.start && entry.date <= range.end)
    .sort((left, right) => left.date.localeCompare(right.date));

  const observedDays = inRange.length;
  const coverage = windowDays === 0 ? 0 : Number((observedDays / windowDays).toFixed(2));

  // Amostragem baixa não impede o relatório, mas obriga a dizer isso na cara —
  // conclusão firme sobre 4 dias de 90 é invenção.
  const sampling: PeriodReportData["sampling"] = coverage >= 0.6 ? "high" : coverage >= 0.3 ? "medium" : "low";

  const moods = inRange.map((entry) => entry.humor);
  const energies = inRange.map((entry) => entry.energia);

  const ranked = [...inRange].sort((left, right) => (
    (right.humor * 0.6 + right.energia * 0.4) - (left.humor * 0.6 + left.energia * 0.4)
  ));

  // Metades comparáveis: é o que responde "melhorei ou piorei ao longo do período".
  const midpoint = toDate(range.start);
  midpoint.setUTCDate(midpoint.getUTCDate() + Math.floor(windowDays / 2));
  const midKey = dayKey(midpoint);
  const firstHalfEntries = inRange.filter((entry) => entry.date < midKey);
  const secondHalfEntries = inRange.filter((entry) => entry.date >= midKey);

  const firstHalf = summarizeHalf(firstHalfEntries, Math.floor(windowDays / 2));
  const secondHalf = summarizeHalf(secondHalfEntries, windowDays - Math.floor(windowDays / 2));

  const weekdayBuckets = new Map<number, number[]>();
  for (const entry of inRange) {
    const weekday = toDate(entry.date).getUTCDay();
    if (!weekdayBuckets.has(weekday)) weekdayBuckets.set(weekday, []);
    weekdayBuckets.get(weekday)!.push(entry.humor);
  }

  const factorBuckets = new Map<string, string[]>();
  for (const entry of inRange) {
    for (const factor of entry.factors ?? []) {
      if (!factorBuckets.has(factor)) factorBuckets.set(factor, []);
      factorBuckets.get(factor)!.push(entry.date);
    }
  }

  const topFactors: FactorAssociation[] = [...factorBuckets.entries()]
    // Menos de 3 dias não sustenta associação nenhuma.
    .filter(([, dates]) => dates.length >= 3)
    .map(([factor, dates]) => {
      const withSet = new Set(dates);
      const withMood = mean(inRange.filter((e) => withSet.has(e.date)).map((e) => e.humor)) ?? 0;
      const withoutMood = mean(inRange.filter((e) => !withSet.has(e.date)).map((e) => e.humor)) ?? 0;
      return {
        factor,
        daysWith: dates.length,
        avgMoodWith: withMood,
        avgMoodWithout: withoutMood,
        difference: Number((withMood - withoutMood).toFixed(2)),
      };
    })
    .sort((left, right) => Math.abs(right.difference) - Math.abs(left.difference))
    .slice(0, 6);

  return {
    range,
    windowDays,
    observedDays,
    missingDays: windowDays - observedDays,
    coverage,
    sampling,
    avgMood: mean(moods),
    avgEnergy: mean(energies),
    bestDay: ranked[0] ? { date: ranked[0].date, mood: ranked[0].humor, energy: ranked[0].energia } : null,
    worstDay: ranked.length > 1
      ? { date: ranked[ranked.length - 1].date, mood: ranked[ranked.length - 1].humor, energy: ranked[ranked.length - 1].energia }
      : null,
    volatility: stdDev(moods.map((mood, index) => mood * 0.6 + energies[index] * 0.4)),
    divergentDays: inRange.filter((entry) => entry.energia - entry.humor >= 3 && entry.humor <= 4).length,
    firstHalf,
    secondHalf,
    moodDelta: firstHalf.avgMood !== null && secondHalf.avgMood !== null
      ? Number((secondHalf.avgMood - firstHalf.avgMood).toFixed(2))
      : null,
    energyDelta: firstHalf.avgEnergy !== null && secondHalf.avgEnergy !== null
      ? Number((secondHalf.avgEnergy - firstHalf.avgEnergy).toFixed(2))
      : null,
    weekdayAverages: [...weekdayBuckets.entries()]
      .map(([weekday, values]) => ({ weekday, avgMood: mean(values) ?? 0, count: values.length }))
      .sort((left, right) => left.weekday - right.weekday),
    topFactors,
    longestGapDays: longestGap(inRange.map((entry) => entry.date), range),
  };
}
