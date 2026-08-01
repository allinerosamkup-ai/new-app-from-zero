type MoodRecord = {
  date: string;
  humor: number;
  energia: number;
  sono?: number;
  factors?: string[];
};

export type ReportConfidence = "insufficient" | "medium" | "high";

export type MoodReportEvidence = {
  windowDays: number;
  sampleCount: number;
  observedDays: number;
  missingDays: number;
  confidence: ReportConfidence;
  label: string;
};

export type StabilityReading = {
  kind: "insufficient" | "stable_positive" | "stable_neutral" | "stable_negative" | "variable";
  sampleCount: number;
  volatility: number | null;
  trend: number | null;
  description: string;
};

export type FactorAssociation = {
  factor: string;
  averageWith: number;
  averageWithout: number;
  difference: number;
  withFactorCount: number;
  withoutFactorCount: number;
  sampleCount: number;
  confidence: Exclude<ReportConfidence, "insufficient">;
  description: string;
};

export type NumericAssociation = {
  coefficient: number;
  sampleCount: number;
  confidence: Exclude<ReportConfidence, "insufficient">;
};

type DailyMoodRecord = {
  date: string;
  humor: number;
  energia: number;
  sono: number | null;
  factors: string[];
};

const MIN_PATTERN_DAYS = 7;
const MIN_COMPARISON_DAYS = 3;

function finiteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number | null {
  const mean = average(values);
  if (mean === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function confidenceFor(sampleCount: number): ReportConfidence {
  if (sampleCount < MIN_PATTERN_DAYS) return "insufficient";
  return sampleCount >= 14 ? "high" : "medium";
}

function confidenceLabel(confidence: ReportConfidence): string {
  if (confidence === "high") return "boa base";
  if (confidence === "medium") return "base inicial";
  return "dados insuficientes";
}

export function aggregateMoodRecords(records: MoodRecord[]): DailyMoodRecord[] {
  const byDay = new Map<string, MoodRecord[]>();
  for (const record of records) {
    if (!record.date || !finiteScore(record.humor) || !finiteScore(record.energia)) continue;
    const day = record.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), record]);
  }

  return [...byDay.entries()]
    .map(([date, entries]) => {
      const humor = average(entries.map((entry) => entry.humor))!;
      const energia = average(entries.map((entry) => entry.energia))!;
      const sono = average(entries.flatMap((entry) => finiteScore(entry.sono) ? [entry.sono] : []));
      const factors = [...new Set(entries.flatMap((entry) => entry.factors ?? []).filter(Boolean))];
      return { date, humor, energia, sono, factors };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildMoodReportEvidence(records: MoodRecord[], windowDays: number): MoodReportEvidence {
  const daily = aggregateMoodRecords(records);
  const safeWindowDays = Math.max(1, Math.floor(windowDays));
  const observedDays = daily.length;
  const confidence = confidenceFor(observedDays);
  return {
    windowDays: safeWindowDays,
    sampleCount: records.length,
    observedDays,
    missingDays: Math.max(0, safeWindowDays - observedDays),
    confidence,
    label: `${confidenceLabel(confidence)} · ${observedDays} dia${observedDays === 1 ? "" : "s"} com registro em ${safeWindowDays}`,
  };
}

export function classifyStability(records: MoodRecord[]): StabilityReading {
  const daily = aggregateMoodRecords(records);
  if (daily.length < MIN_PATTERN_DAYS) {
    return {
      kind: "insufficient",
      sampleCount: daily.length,
      volatility: null,
      trend: null,
      description: "Ainda não há dias suficientes para classificar estabilidade. Continue registrando humor, energia e fatores sem forçar uma conclusão.",
    };
  }

  const values = daily.map((entry) => (entry.humor + entry.energia) / 2);
  const volatility = standardDeviation(values)!;
  const midpoint = Math.ceil(values.length / 2);
  const trend = average(values.slice(midpoint))! - average(values.slice(0, midpoint))!;
  const mean = average(values)!;
  const stable = volatility <= 1 && Math.abs(trend) <= 0.75;

  if (stable && mean >= 6) {
    return {
      kind: "stable_positive",
      sampleCount: daily.length,
      volatility,
      trend,
      description: "Ritmo estável em faixa positiva: humor e energia ficaram consistentes nesta janela. Preserve as âncoras que já funcionam, sem aumentar a carga só porque a fase está boa.",
    };
  }

  if (stable && mean <= 4.5) {
    return {
      kind: "stable_negative",
      sampleCount: daily.length,
      volatility,
      trend,
      description: "Ritmo estável em faixa baixa: os registros permanecem próximos entre si, mas em níveis que merecem atenção e redução de carga. É um padrão observado, não uma conclusão clínica.",
    };
  }

  if (stable) {
    return {
      kind: "stable_neutral",
      sampleCount: daily.length,
      volatility,
      trend,
      description: "Ritmo estável: humor e energia variaram pouco nesta janela. Use essa previsibilidade para manter o plano real do dia.",
    };
  }

  return {
    kind: "variable",
    sampleCount: daily.length,
    volatility,
    trend,
    description: "Há oscilação ou mudança relevante nesta janela. Observe contexto, sono e fatores registrados antes de atribuir uma causa; ajuste a carga para o estado de hoje.",
  };
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const paired = xs
    .map((x, index) => [x, ys[index]] as const)
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (paired.length < MIN_COMPARISON_DAYS) return null;

  const xValues = paired.map(([x]) => x);
  const yValues = paired.map(([, y]) => y);
  const xMean = average(xValues)!;
  const yMean = average(yValues)!;
  const numerator = paired.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const xDeviation = Math.sqrt(xValues.reduce((sum, x) => sum + (x - xMean) ** 2, 0));
  const yDeviation = Math.sqrt(yValues.reduce((sum, y) => sum + (y - yMean) ** 2, 0));
  if (xDeviation === 0 || yDeviation === 0) return null;
  return Math.max(-1, Math.min(1, numerator / (xDeviation * yDeviation)));
}

export function buildNumericAssociation(pairs: Array<{ left: number; right: number }>): NumericAssociation | null {
  if (pairs.length < MIN_PATTERN_DAYS) return null;
  const coefficient = pearsonCorrelation(pairs.map((pair) => pair.left), pairs.map((pair) => pair.right));
  if (coefficient === null) return null;
  return {
    coefficient,
    sampleCount: pairs.length,
    confidence: confidenceFor(pairs.length) as Exclude<ReportConfidence, "insufficient">,
  };
}

export function buildFactorAssociations(records: MoodRecord[]): FactorAssociation[] {
  const daily = aggregateMoodRecords(records);
  if (daily.length < MIN_PATTERN_DAYS) return [];
  const factors = [...new Set(daily.flatMap((entry) => entry.factors))];

  return factors.flatMap((factor) => {
    const withFactor = daily.filter((entry) => entry.factors.includes(factor));
    const withoutFactor = daily.filter((entry) => !entry.factors.includes(factor));
    if (withFactor.length < MIN_COMPARISON_DAYS || withoutFactor.length < MIN_COMPARISON_DAYS) return [];
    const averageWith = average(withFactor.map((entry) => entry.humor))!;
    const averageWithout = average(withoutFactor.map((entry) => entry.humor))!;
    const difference = averageWith - averageWithout;
    const sampleCount = withFactor.length + withoutFactor.length;
    const confidence = confidenceFor(sampleCount);
    if (confidence === "insufficient") return [];
    return [{
      factor,
      averageWith,
      averageWithout,
      difference,
      withFactorCount: withFactor.length,
      withoutFactorCount: withoutFactor.length,
      sampleCount,
      confidence,
      description: `${sampleCount} dias comparados; este fator aparece associado a ${difference >= 0 ? "uma média mais alta" : "uma média mais baixa"} de humor. Associação não prova causa.`,
    }];
  });
}
