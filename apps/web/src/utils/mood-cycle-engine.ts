/**
 * MoodCycleEngine — Motor de Ciclagem de Humor
 *
 * Calcula algoritmicamente a fase atual do ritmo de humor e energia
 * baseado em dados históricos de checkin.
 *
 * Fundamentação clínica:
 * - TDAH: disregulação emocional, micro-ciclos intradiários
 * - Transtorno bipolar / ciclotimia: ciclos de dias a semanas
 * - Depressão: episódios com remissão parcial/total
 * - Ciclo menstrual: modulador biológico (NÃO o ciclo primário)
 *
 * Algoritmo baseado em:
 * - EWMA (Exponentially Weighted Moving Average)
 * - Tendência de 7 dias vs 7 dias anteriores
 * - Variabilidade (desvio padrão) como indicador de instabilidade
 * - Detecção de fase por limiar sustentado
 */

import type { CheckinEntry } from "../features/aura/types";
import { getLocalDateKey, normalizeDateKey } from "./day-context";

// ── Tipos ──────────────────────────────────────────────────

export type MoodPhase =
  | "elevated"          // Humor elevado sustentado (≥4.2, 3+ dias)
  | "flowing"           // Fluindo bem (3.6-4.2, tendência estável/alta)
  | "stable"            // Eutimia — estado basal equilibrado
  | "falling"           // Descida detectada (tendência negativa)
  | "low"               // Fase baixa (≤2.5, 3+ dias)
  | "depleted"          // Muito baixo / esgotamento (≤1.8, 2+ dias)
  | "recovering"        // Subindo após fase baixa
  | "mixed"             // Alta variabilidade — estado instável
  | "insufficient_data"; // Menos de 3 checkins

export type TrendBand =
  | "fluindo"
  | "em_alta"
  | "estavel"
  | "oscilando"
  | "em_queda"
  | "atencao";

export type EnergyForecast = "high" | "moderate" | "low" | "rest";

export type WarningFlag =
  | "high_volatility"       // Variabilidade acima de 1.2 — ciclo instável
  | "sustained_low"         // 3+ dias abaixo de 3.0 — alerta depressivo crítico
  | "rapid_drop"            // Queda de >1.5 pts em 48h — alerta de episódio
  | "sustained_elevated"    // 5+ dias acima de 4.2 — alerta hipomaníaco
  | "sleep_impact_high"     // Correlação sono-humor > 0.6
  | "low_checkin_frequency" // Menos de 4 checkins nos últimos 7 dias
  | "mixed_features"        // Humor baixo e energia alta ao mesmo tempo
  | "reduced_sleep_need";   // Pouco sono sem queda — marcador de elevação

/**
 * Estabilidade diz que a pessoa está dentro do próprio padrão. Não diz se esse
 * padrão é bom. Quem está deprimido há meses também fica "estável": baixa
 * variação, sem tendência, colado no próprio baseline. Por isso a valência é
 * medida no nível ABSOLUTO do composto, não no desvio do baseline pessoal —
 * senão depressão sustentada é lida como equilíbrio.
 */
export type StabilityValence = "positive" | "neutral" | "negative";

export type StableReading = {
  isStable: boolean;
  valence: StabilityValence;
  label: string;
  description: string;
  /** Dias consecutivos dentro da faixa estável, contados de trás para frente. */
  sustainedDays: number;
};

// Limiares no composto 0-10 (humor*0.6 + energia*0.4).
const STABLE_POSITIVE_MIN = 6.2;
const STABLE_NEGATIVE_MAX = 4.6;

/**
 * Traços mistos: quanto a energia precisa superar o humor, no mesmo dia, para
 * a divergência deixar de ser ruído e virar sinal. 3 pontos numa escala de 10
 * é folgado o bastante para não disparar com oscilação normal.
 */
const MIXED_DIVERGENCE_MIN = 3;
/** A divergência só conta como mista se o humor estiver de fato baixo. */
const MIXED_MOOD_MAX = 4;
/** Abaixo disso o sono é curto o suficiente para ser sinal, não variação. */
const SHORT_SLEEP_HOURS_MAX = 6;

function buildStableReading(
  phase: MoodPhase,
  currentComposite: number,
  daysInPhase: number,
): StableReading {
  const isStable = phase === "stable";
  const valence: StabilityValence = currentComposite >= STABLE_POSITIVE_MIN
    ? "positive"
    : currentComposite <= STABLE_NEGATIVE_MAX
      ? "negative"
      : "neutral";

  if (!isStable) {
    return {
      isStable: false,
      valence,
      label: "",
      description: "",
      sustainedDays: 0,
    };
  }

  if (valence === "positive") {
    return {
      isStable: true,
      valence,
      label: "Estável positivo",
      description: "Constante e num nível bom. É o cenário para avançar em coisas que exigem continuidade.",
      sustainedDays: daysInPhase,
    };
  }

  if (valence === "negative") {
    return {
      isStable: true,
      valence,
      label: "Estável negativo",
      description: "Constante, mas num nível baixo. Pouca oscilação aqui não é equilíbrio — é um platô baixo que se sustenta.",
      sustainedDays: daysInPhase,
    };
  }

  return {
    isStable: true,
    valence,
    label: "Estável",
    description: "Dentro do seu padrão pessoal, num nível intermediário.",
    sustainedDays: daysInPhase,
  };
}

export type PersonalTrendProfile = {
  baselineMood: number;
  baselineEnergy: number;
  baselineComposite: number;
  currentMoodEwma: number;
  currentEnergyEwma: number;
  currentComposite: number;
  previousMoodEwma: number;
  previousEnergyEwma: number;
  previousComposite: number;
  deltaMood: number;
  deltaEnergy: number;
  deltaComposite: number;
  volatility14d: number;
  sustainedDeviationDays: number;
  positiveDeviationDays: number;
  negativeDeviationDays: number;
  criticalDeviationDays: number;
  trendBand: TrendBand;
  trendBandLabel: string;
  trendBandDescription: string;
  trendBandTip: string;
};

export type MoodCycleReport = {
  phase: MoodPhase;
  phaseLabel: string;
  phaseEmoji: string;
  phaseDescription: string;
  phaseTip: string;
  daysInPhase: number;
  stabilityScore: number;   // 0-100 (100 = muito estável)
  trend7d: number;          // positivo = subindo, negativo = caindo
  volatility14d: number;    // desvio padrão dos últimos 14 dias
  avgMood7d: number;        // média de humor 7 dias
  avgEnergy7d: number;      // média de energia 7 dias
  avgSleep7d: number | null; // média de sono 7 dias (null = sem base)
  energyForecast: EnergyForecast;
  energyForecastLabel: string;
  warningFlags: WarningFlag[];
  /** Valência da estabilidade: platô bom, intermediário ou baixo. */
  stableReading: StableReading;
  cycleEstimate: {
    hasEnoughData: boolean;
    estimatedLengthDays: number | null;
    currentDayInCycle: number | null;
  };
  personalTrend: PersonalTrendProfile;
  baselineMood: number;
  baselineEnergy: number;
  baselineComposite: number;
  currentMoodEwma: number;
  currentEnergyEwma: number;
  currentComposite: number;
  personalTrendLabel: string;
  personalTrendDescription: string;
  personalTrendTip: string;
  personalTrendBand: TrendBand;
  baselineDeltaMood: number;
  baselineDeltaEnergy: number;
  baselineDeltaComposite: number;
  // Para o prompt da IA
  aiContext: string;
  // Modulador biológico do ciclo menstrual
  menstrualModulator: MenstrualModulator;
};

// ── Modulador do ciclo menstrual ───────────────────────────

export type MenstrualCyclePhase =
  | 'menstrual'       // D1-D5 (fluxo ativo)
  | 'follicular'      // D6-D13 (estrogênio crescente)
  | 'ovulatory'       // D14-D16 (pico de LH/estrogênio)
  | 'luteal_early'    // D17-D22 (progesterona alta, estável)
  | 'luteal_late'     // D23-D28 (queda hormonal, TPM)
  | 'unknown';

export type MenstrualModulator = {
  detected: boolean;
  cyclePhase: MenstrualCyclePhase;
  cyclePhaseLabel: string;
  estimatedCycleDay: number | null;   // D1, D2 ... D28
  daysSinceLastFlow: number | null;
  energyModifier: number;             // -1 a +1
  moodModifier: number;               // -1 a +1
  contextNote: string;                // injetado no aiContext
};

// ── Config de fase ─────────────────────────────────────────

export type PhaseConfigEntry = {
  label: string;
  emoji: string;
  description: string;
  tip: string;
  color: string;
  energyForecast: EnergyForecast;
};

export const PHASE_CONFIG: Record<MoodPhase, PhaseConfigEntry> = {
  elevated: {
    label: "Voo Alto",
    emoji: "🚀",
    description: "Humor e energia acima do seu padrão pessoal recente. A leitura indica aceleração sem perder o fio da estabilidade.",
    tip: "Aproveite o pico sem exagerar na carga. O ganho agora é usar a energia com intenção.",
    color: "var(--accent-sky)",
    energyForecast: "high",
  },
  flowing: {
    label: "Fluindo",
    emoji: "✨",
    description: "Você está acima do seu padrão e com ritmo estável. Clareza, motivação e energia caminham juntas.",
    tip: "Ótimo momento para priorizar o que realmente move a semana.",
    color: "var(--accent-sage)",
    energyForecast: "high",
  },
  stable: {
    label: "Estável",
    emoji: "💚",
    description: "Você está dentro do seu padrão pessoal. O app entende esse intervalo como seu chão normal.",
    tip: "Bom momento para rotina, previsibilidade e avanço consistente.",
    color: "var(--accent-sage)",
    energyForecast: "moderate",
  },
  falling: {
    label: "Desacelerando",
    emoji: "📉",
    description: "A tendência caiu abaixo do seu padrão pessoal recente. A leitura aponta perda de tração.",
    tip: "Reduza atrito e proteja energia antes que a queda aprofunde.",
    color: "var(--accent-peach)",
    energyForecast: "moderate",
  },
  low: {
    label: "Recolhimento",
    emoji: "🌙",
    description: "Seu padrão pessoal entrou numa faixa abaixo do normal. Aqui a leitura pede cuidado, não cobrança.",
    tip: "Priorize o básico e corte o excesso. Pequenos passos contam mais do que empurrar força.",
    color: "var(--accent-peach-strong)",
    energyForecast: "low",
  },
  depleted: {
    label: "Pausa",
    emoji: "😴",
    description: "Humor e energia estão bem abaixo do seu padrão pessoal. O sinal é de recuperação, não de cobrança.",
    tip: "Cancele o que puder e trate descanso como parte do plano.",
    color: "var(--accent-peach-ink)",
    energyForecast: "rest",
  },
  recovering: {
    label: "Retomada",
    emoji: "🌱",
    description: "Você está saindo de uma faixa baixa. O padrão já começa a voltar para perto do seu normal.",
    tip: "Retome devagar e consolide cada melhora antes de subir a carga.",
    color: "var(--accent-sage)",
    energyForecast: "low",
  },
  mixed: {
    label: "Turbulência",
    emoji: "⚡",
    description: "A leitura variou mais do que o normal. O padrão ainda existe, mas está menos estável agora.",
    tip: "Volte para rotina simples e reduza decisões desnecessárias por enquanto.",
    color: "var(--accent-peach)",
    energyForecast: "moderate",
  },
  insufficient_data: {
    label: "Começando a calibrar",
    emoji: "📊",
    description: "Faça check-ins por pelo menos 3 dias para começar a rastrear seu ciclo.",
    tip: "Quanto mais consistente o check-in, mais precisa a análise do seu ciclo.",
    color: "var(--text-3)",
    energyForecast: "moderate",
  },
};

const ENERGY_LABELS: Record<EnergyForecast, string> = {
  high: "Alta — aproveite o pico",
  moderate: "Moderada — ritmo sustentável",
  low: "Baixa — preserve energia",
  rest: "Recuperação — descanse",
};

// ── Utilitários matemáticos ────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function weightedComposite(mood: number, energy: number): number {
  return Number((mood * 0.6 + energy * 0.4).toFixed(2));
}

function countSignChanges(values: number[], baseline: number): number {
  const signs = values
    .map((value) => Math.sign(value - baseline))
    .filter((value) => value !== 0);

  let changes = 0;
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== signs[i - 1]) changes++;
  }
  return changes;
}

function getBaselineWindow(sorted: CheckinEntry[]): CheckinEntry[] {
  if (sorted.length <= 4) return sorted;
  const holdout = Math.min(3, sorted.length - 1);
  return sorted.slice(0, sorted.length - holdout);
}

function computePersonalTrendProfile(sorted: CheckinEntry[]): PersonalTrendProfile {
  const baselineWindow = getBaselineWindow(sorted);
  const baselineMoodValues = baselineWindow.map((entry) => entry.humor);
  const baselineEnergyValues = baselineWindow.map((entry) => entry.energia);

  const recentWindow = sorted.slice(-7);
  const previousWindow = sorted.slice(-14, -7);
  const compositeRecent = recentWindow.map((entry) => weightedComposite(entry.humor, entry.energia));
  const composite14d = sorted.slice(-14).map((entry) => weightedComposite(entry.humor, entry.energia));

  const baselineMood = baselineMoodValues.length >= 2 ? ewma(baselineMoodValues, 0.12) : mean(sorted.map((entry) => entry.humor));
  const baselineEnergy = baselineEnergyValues.length >= 2 ? ewma(baselineEnergyValues, 0.12) : mean(sorted.map((entry) => entry.energia));
  const baselineComposite = weightedComposite(baselineMood, baselineEnergy);

  const currentMoodEwma = ewma(recentWindow.map((entry) => entry.humor), 0.32);
  const currentEnergyEwma = ewma(recentWindow.map((entry) => entry.energia), 0.32);
  const currentComposite = weightedComposite(currentMoodEwma, currentEnergyEwma);

  const previousMoodEwma = previousWindow.length > 0 ? ewma(previousWindow.map((entry) => entry.humor), 0.32) : currentMoodEwma;
  const previousEnergyEwma = previousWindow.length > 0 ? ewma(previousWindow.map((entry) => entry.energia), 0.32) : currentEnergyEwma;
  const previousComposite = weightedComposite(previousMoodEwma, previousEnergyEwma);

  const deltaMood = Number((currentMoodEwma - baselineMood).toFixed(2));
  const deltaEnergy = Number((currentEnergyEwma - baselineEnergy).toFixed(2));
  const deltaComposite = Number((currentComposite - baselineComposite).toFixed(2));
  const volatility14d = stdDev(composite14d);
  const sustainedDeviationDays = compositeRecent.filter((value) => Math.abs(value - baselineComposite) >= 0.75).length;
  const positiveDeviationDays = compositeRecent.filter((value) => value - baselineComposite >= 0.75).length;
  const negativeDeviationDays = compositeRecent.filter((value) => baselineComposite - value >= 0.75).length;
  const criticalDeviationDays = compositeRecent.filter((value) => baselineComposite - value >= 1.4).length;
  const signChanges = countSignChanges(compositeRecent, baselineComposite);

  let trendBand: TrendBand = "estavel";
  if (criticalDeviationDays >= 3 || (negativeDeviationDays >= 4 && deltaComposite <= -1.0)) {
    trendBand = "atencao";
  } else if (volatility14d >= 1.8 || signChanges >= 2) {
    trendBand = "oscilando";
  } else if (deltaComposite >= 1.25 && positiveDeviationDays >= 3) {
    trendBand = "fluindo";
  } else if (deltaComposite >= 0.65) {
    trendBand = "em_alta";
  } else if (deltaComposite <= -1.0) {
    trendBand = "em_queda";
  }

  const trendBandLabelMap: Record<TrendBand, { label: string; description: string; tip: string }> = {
    fluindo: {
      label: "Fluindo",
      description: "Seu padrão pessoal está acima do normal com estabilidade. A leitura aponta um momento de tração boa.",
      tip: "Aproveite para avançar nas tarefas que pedem foco e presença.",
    },
    em_alta: {
      label: "Voo Alto",
      description: "Seu padrão pessoal está acima da linha de base. Ainda é um bom momento, só sem forçar demais.",
      tip: "Use esse extra de energia para destravar o que estava parado.",
    },
    estavel: {
      label: "Estável",
      description: "Seu padrão está dentro da sua faixa normal. Aqui o sinal é consistência, não urgência.",
      tip: "Bom momento para seguir rotina e consolidar o que já está andando.",
    },
    oscilando: {
      label: "Turbulência",
      description: "A leitura oscilou mais do que o seu normal recente. O padrão existe, mas está menos firme agora.",
      tip: "Volte para um plano simples e deixe o dia menos barulhento.",
    },
    em_queda: {
      label: "Desacelerando",
      description: "Seu padrão pessoal caiu abaixo da base recente. Há desvio, mas ainda não necessariamente colapso.",
      tip: "Corte atrito e proteja energia antes de pedir mais de você.",
    },
    atencao: {
      label: "Recolhimento",
      description: "O padrão ficou bem abaixo do seu normal recente. Aqui o app está sinalizando risco de sobrecarga.",
      tip: "Pare de empurrar. Priorize descanso, clareza e o básico do dia.",
    },
  };

  const bandMeta = trendBandLabelMap[trendBand];

  return {
    baselineMood,
    baselineEnergy,
    baselineComposite,
    currentMoodEwma,
    currentEnergyEwma,
    currentComposite,
    previousMoodEwma,
    previousEnergyEwma,
    previousComposite,
    deltaMood,
    deltaEnergy,
    deltaComposite,
    volatility14d,
    sustainedDeviationDays,
    positiveDeviationDays,
    negativeDeviationDays,
    criticalDeviationDays,
    trendBand,
    trendBandLabel: bandMeta.label,
    trendBandDescription: bandMeta.description,
    trendBandTip: bandMeta.tip,
  };
}

function mapTrendBandToPhase(
  trendBand: TrendBand,
  trendProfile: PersonalTrendProfile,
  previousPhase: MoodPhase | null,
): MoodPhase {
  if (previousPhase && (previousPhase === "low" || previousPhase === "depleted") && trendProfile.deltaComposite >= -0.2 && trendProfile.trendBand !== "atencao") {
    return "recovering";
  }

  switch (trendBand) {
    case "fluindo":
      return "flowing";
    case "em_alta":
      return "elevated";
    case "oscilando":
      return "mixed";
    case "em_queda":
      return trendProfile.deltaComposite <= -1.35 || trendProfile.criticalDeviationDays >= 2 ? "low" : "falling";
    case "atencao":
      return trendProfile.deltaComposite <= -1.8 || trendProfile.criticalDeviationDays >= 3 ? "depleted" : "low";
    case "estavel":
    default:
      return "stable";
  }
}

/**
 * EWMA — Exponentially Weighted Moving Average
 * Pesos maiores para dados mais recentes (alpha = 0.3 por default)
 */
function ewma(values: number[], alpha = 0.3): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

const SLOT_ORDER: Record<string, number> = {
  morning: 0,
  midday: 1,
  evening: 2,
};

function averageDefined(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => typeof value === "number");
  if (present.length === 0) return undefined;
  return Number(mean(present).toFixed(2));
}

function getCheckinMoment(entry: CheckinEntry): number {
  if (entry.recordedAt) {
    const stamp = new Date(entry.recordedAt).getTime();
    if (!Number.isNaN(stamp)) return stamp;
  }
  if (entry.checkinSlot?.startsWith("morning")) return SLOT_ORDER.morning;
  if (entry.checkinSlot?.startsWith("midday")) return SLOT_ORDER.midday;
  if (entry.checkinSlot?.startsWith("evening")) return SLOT_ORDER.evening;
  return 0;
}

export function aggregateCheckinsByDay(history: CheckinEntry[]): CheckinEntry[] {
  const grouped = new Map<string, CheckinEntry[]>();

  for (const entry of history) {
    const dateKey = normalizeDateKey(entry.date);
    if (!dateKey) continue;
    if (!Number.isFinite(Number(entry.humor)) || !Number.isFinite(Number(entry.energia))) continue;
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push({
      ...entry,
      date: dateKey,
      humor: Number(entry.humor),
      energia: Number(entry.energia),
    });
  }

  return Array.from(grouped.entries())
    .map(([date, entries]) => {
      const ordered = [...entries].sort((a, b) => getCheckinMoment(a) - getCheckinMoment(b));
      const latest = ordered[ordered.length - 1];

      return {
        date,
        humor: Number(mean(ordered.map((entry) => entry.humor)).toFixed(2)),
        energia: Number(mean(ordered.map((entry) => entry.energia)).toFixed(2)),
        emotion: latest?.emotion ?? ordered[0]?.emotion ?? "calm",
        recordedAt: latest?.recordedAt,
        checkinSlot: latest?.checkinSlot,
        sono: averageDefined(ordered.map((entry) => entry.sono)),
        // Horas de sono estavam sendo descartadas aqui: o check-in coletava e a
        // agregação perdia, então nada a jusante conseguia usá-las. É o dado que
        // separa necessidade de sono reduzida (marcador de elevação) de privação.
        sleepHours: averageDefined(ordered.map((entry) => entry.sleepHours)),
        fisico: averageDefined(ordered.map((entry) => entry.fisico)),
        social: averageDefined(ordered.map((entry) => entry.social)),
        irritabilidade: averageDefined(ordered.map((entry) => entry.irritabilidade)),
        cyclePhase: latest?.cyclePhase,
        cycleDay: latest?.cycleDay,
        isFlowing: latest?.isFlowing,
        flowDay: latest?.flowDay,
        flowIntensity: latest?.flowIntensity,
        symptomLevels: latest?.symptomLevels,
      } satisfies CheckinEntry;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Detecção de fase do ciclo menstrual ────────────────────

function computeMenstrualModulator(sorted: CheckinEntry[]): MenstrualModulator {
  const UNKNOWN: MenstrualModulator = {
    detected: false,
    cyclePhase: 'unknown',
    cyclePhaseLabel: 'Não informado',
    estimatedCycleDay: null,
    daysSinceLastFlow: null,
    energyModifier: 0,
    moodModifier: 0,
    contextNote: '',
  };

  // Encontrar a entrada mais recente com isFlowing = true
  const lastFlowingEntry = [...sorted].reverse().find(e => e.isFlowing === true);
  if (!lastFlowingEntry) return UNKNOWN;

  // Encontrar o INÍCIO desse episódio de fluxo (primeiro dia consecutivo)
  const lastFlowingIdx = sorted.findIndex(e => e.date === lastFlowingEntry.date);
  let flowStartIdx = lastFlowingIdx;
  for (let i = lastFlowingIdx - 1; i >= 0; i--) {
    if (sorted[i].isFlowing === true) {
      flowStartIdx = i;
    } else {
      break;
    }
  }
  const flowStartDate = sorted[flowStartIdx].date;

  // Dias desde o início do último fluxo (= dia do ciclo - 1)
  const todayStr = getLocalDateKey(new Date());
  const msPerDay = 86_400_000;
  const daysSince = Math.round(
    (new Date(todayStr).getTime() - new Date(flowStartDate).getTime()) / msPerDay,
  );

  // Ciclo inválido ou muito antigo
  if (daysSince < 0 || daysSince > 34) return UNKNOWN;

  const cycleDay = daysSince + 1; // D1 = primeiro dia de fluxo

  let cyclePhase: MenstrualCyclePhase;
  let cyclePhaseLabel: string;
  let energyModifier: number;
  let moodModifier: number;
  let contextNote: string;

  if (cycleDay <= 5) {
    cyclePhase = 'menstrual';
    cyclePhaseLabel = 'Menstruação';
    energyModifier = -0.5;
    moodModifier = -0.3;
    contextNote = `Fase da menstruação (D${cycleDay}) — energia tipicamente reduzida e sensibilidade aumentada. Respeitar o ritmo natural é estratégico.`;
  } else if (cycleDay <= 13) {
    cyclePhase = 'follicular';
    cyclePhaseLabel = 'Pós-menstruação';
    energyModifier = 0.3;
    moodModifier = 0.2;
    contextNote = `Fase pós-menstruação (D${cycleDay}) — energia e clareza mental tendem a subir.`;
  } else if (cycleDay <= 16) {
    cyclePhase = 'ovulatory';
    cyclePhaseLabel = 'Ovulação';
    energyModifier = 0.5;
    moodModifier = 0.3;
    contextNote = `Fase da ovulação (D${cycleDay}) — pico de energia, foco e disposição social.`;
  } else if (cycleDay <= 22) {
    cyclePhase = 'luteal_early';
    cyclePhaseLabel = 'Pós-ovulação';
    energyModifier = 0;
    moodModifier = 0;
    contextNote = `Fase pós-ovulação (D${cycleDay}) — ritmo mais introspectivo, bom para tarefas que pedem concentração.`;
  } else {
    cyclePhase = 'luteal_late';
    cyclePhaseLabel = 'TPM';
    energyModifier = -0.3;
    moodModifier = -0.4;
    contextNote = `Fase da TPM (D${cycleDay}) — sensibilidade emocional elevada e energia mais baixa são esperadas. Não é piora permanente, é o ciclo.`;
  }

  return {
    detected: true,
    cyclePhase,
    cyclePhaseLabel,
    estimatedCycleDay: cycleDay,
    daysSinceLastFlow: daysSince,
    energyModifier,
    moodModifier,
    contextNote,
  };
}

// ── Motor principal ────────────────────────────────────────

export function computeMoodCycle(
  history: CheckinEntry[],
  userContext?: { diagnoses?: string[] },
): MoodCycleReport {
  const hasBipolarII =
    userContext?.diagnoses?.some((d) => d === 'bipolar_ii' || d === 'cyclothymia') ?? false;
  const hasAdhd = userContext?.diagnoses?.includes('adhd') ?? false;
  // Ordenar por data (mais antigo → mais recente)
  const sorted = aggregateCheckinsByDay(history);

  // Dados insuficientes
  if (sorted.length < 3) {
    const cfg = PHASE_CONFIG.insufficient_data;
    const emptyTrend: PersonalTrendProfile = {
      baselineMood: 0,
      baselineEnergy: 0,
      baselineComposite: 0,
      currentMoodEwma: 0,
      currentEnergyEwma: 0,
      currentComposite: 0,
      previousMoodEwma: 0,
      previousEnergyEwma: 0,
      previousComposite: 0,
      deltaMood: 0,
      deltaEnergy: 0,
      deltaComposite: 0,
      volatility14d: 0,
      sustainedDeviationDays: 0,
      positiveDeviationDays: 0,
      negativeDeviationDays: 0,
      criticalDeviationDays: 0,
      trendBand: "estavel",
      trendBandLabel: "Estável",
      trendBandDescription: "Ainda não há dados suficientes para personalizar a leitura.",
      trendBandTip: "Faça alguns check-ins para o app aprender seu padrão pessoal.",
    };
    return {
      phase: "insufficient_data",
      phaseLabel: cfg.label,
      phaseEmoji: cfg.emoji,
      phaseDescription: cfg.description,
      phaseTip: cfg.tip,
      daysInPhase: 0,
      stabilityScore: 50,
      trend7d: 0,
      volatility14d: 0,
      avgMood7d: 0,
      avgEnergy7d: 0,
      avgSleep7d: null,
      energyForecast: cfg.energyForecast,
      energyForecastLabel: ENERGY_LABELS[cfg.energyForecast],
      warningFlags: [],
      stableReading: { isStable: false, valence: "neutral", label: "", description: "", sustainedDays: 0 },
      cycleEstimate: { hasEnoughData: false, estimatedLengthDays: null, currentDayInCycle: null },
      personalTrend: emptyTrend,
      baselineMood: 0,
      baselineEnergy: 0,
      baselineComposite: 0,
      currentMoodEwma: 0,
      currentEnergyEwma: 0,
      currentComposite: 0,
      personalTrendLabel: emptyTrend.trendBandLabel,
      personalTrendDescription: emptyTrend.trendBandDescription,
      personalTrendTip: emptyTrend.trendBandTip,
      personalTrendBand: emptyTrend.trendBand,
      baselineDeltaMood: 0,
      baselineDeltaEnergy: 0,
      baselineDeltaComposite: 0,
      aiContext: "Poucos dados para análise — usuária está começando a rastrear o ciclo.",
      menstrualModulator: computeMenstrualModulator(sorted),
    };
  }

  // Janelas de dados
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const last14 = sorted.slice(-14);

  const humors7 = last7.map(e => e.humor);
  const energies7 = last7.map(e => e.energia);
  const composite14 = last14.map((entry) => weightedComposite(entry.humor, entry.energia));

  const avgMood7d = mean(humors7);
  const avgEnergy7d = mean(energies7);
  const avgComposite7d = mean(last7.map((entry) => weightedComposite(entry.humor, entry.energia)));
  const avgCompositePrev7 = prev7.length > 0 ? mean(prev7.map((entry) => weightedComposite(entry.humor, entry.energia))) : avgComposite7d;
  const trend7d = avgComposite7d - avgCompositePrev7;
  const trendProfile = computePersonalTrendProfile(sorted);
  const volatility14d = trendProfile.volatility14d;
  const currentComposite = trendProfile.currentComposite;
  const currentMoodEwma = trendProfile.currentMoodEwma;
  const currentEnergyEwma = trendProfile.currentEnergyEwma;
  const baselineComposite = trendProfile.baselineComposite;
  const baselineMood = trendProfile.baselineMood;
  const baselineEnergy = trendProfile.baselineEnergy;
  const baselineDeltaMood = trendProfile.deltaMood;
  const baselineDeltaEnergy = trendProfile.deltaEnergy;
  const baselineDeltaComposite = trendProfile.deltaComposite;

  // Sono
  const sleepValues = last7.map(e => e.sono).filter(s => s !== undefined) as number[];
  const avgSleep7d = sleepValues.length > 0 ? mean(sleepValues) : null;

  // ── Detecção de fase ────────────────────────────────────
  let phase: MoodPhase = "stable";
  let previousPhase: MoodPhase | null = null;

  // Verificar fase anterior (para detectar "recovering")
  if (sorted.length >= 10) {
    const before = sorted.slice(-14, -7);
    const beforeAvg = mean(before.map((entry) => weightedComposite(entry.humor, entry.energia)));
    if (beforeAvg < baselineComposite - 1.8) previousPhase = "depleted";
    else if (beforeAvg < baselineComposite - 1.0) previousPhase = "low";
  }

  phase = mapTrendBandToPhase(trendProfile.trendBand, trendProfile, previousPhase);
  if (
    (previousPhase === "low" || previousPhase === "depleted") &&
    baselineDeltaComposite > -0.35 &&
    trend7d > 0.2
  ) {
    phase = "recovering";
  }
  if (phase === "stable" && trendProfile.deltaComposite >= 0.95) {
    phase = "flowing";
  }
  if (phase === "stable" && trendProfile.deltaComposite <= -0.65) {
    phase = "falling";
  }

  // ── Dias na fase atual ──────────────────────────────────
  let daysInPhase = 1;
  const phaseThresholds: Record<MoodPhase, (h: number) => boolean> = {
    elevated: h => h >= baselineComposite + 0.95,
    flowing: h => h >= baselineComposite + 1.2,
    stable: h => h >= baselineComposite - 0.45 && h <= baselineComposite + 0.65,
    falling: h => h <= baselineComposite - 0.45,
    low: h => h <= baselineComposite - 1.0,
    depleted: h => h <= baselineComposite - 1.65,
    recovering: h => h >= baselineComposite - 0.35,
    // "mixed" = alta variabilidade: conta dias que ficaram em zona de oscilação (não claramente alto nem baixo)
    mixed: h => Math.abs(h - baselineComposite) < 1.4,
    insufficient_data: _h => true,
  };
  const phaseCheck = phaseThresholds[phase];
  for (let i = sorted.length - 2; i >= 0; i--) {
    const dayComposite = weightedComposite(sorted[i].humor, sorted[i].energia);
    if (phaseCheck(dayComposite)) {
      daysInPhase++;
    } else {
      break;
    }
    if (daysInPhase >= 30) break; // limite
  }
  // Para "mixed" (Turbulência): a fase é definida por volatilidade de 14 dias,
  // não por contagem linear. Limita ao máximo da janela de análise.
  if (phase === "mixed") daysInPhase = Math.min(daysInPhase, 14);

  // ── Score de estabilidade (0-100) ──────────────────────
  let stabilityScore = 100;
  stabilityScore -= Math.min(30, volatility14d * 9);       // variabilidade
  stabilityScore -= Math.min(20, Math.abs(trend7d) * 5);  // mudança brusca
  const lowDays = composite14.filter((value) => value <= baselineComposite - 0.75).length;
  const criticalDays = composite14.filter((value) => value <= baselineComposite - 1.35).length;
  stabilityScore -= Math.min(25, lowDays * 5);              // dias baixos
  stabilityScore -= Math.min(35, criticalDays * 10);        // dias críticos
  const highDays = composite14.filter((value) => value >= baselineComposite + 1.0).length;
  stabilityScore -= Math.min(10, highDays * 3);             // dias muito altos
  if (sorted.length < 7) stabilityScore -= 15;              // poucos dados
  stabilityScore = Math.max(0, Math.min(100, Math.round(stabilityScore)));

  // ── Warning flags ──────────────────────────────────────
  const warningFlags: WarningFlag[] = [];

  // ADHD: use a shorter 7-day volatility window (more reactive to recent swings)
  const volatilityWindowData = hasAdhd ? last7 : last14;
  const volatilityForFlags = stdDev(
    volatilityWindowData.map((e) => weightedComposite(e.humor, e.energia)),
  );
  const volatilityThreshold = hasAdhd ? 1.4 : 1.8; // lower threshold for ADHD
  if (volatilityForFlags > volatilityThreshold) warningFlags.push("high_volatility");

  // sustained_low: só dispara se o humor ainda está baixo AGORA.
  // Se a tendência é positiva ou a fase é de recuperação, não alarmar por dias antigos.
  const isTrendingUpNow = trend7d > 0.4;
  // "stable" só protege do alerta quando o platô não é baixo. Quem está
  // deprimido há semanas fica estável no próprio baseline rebaixado: sem esta
  // checagem de nível absoluto, o alerta era engolido justamente no caso que
  // mais precisa dele.
  const isStableAtLowLevel = phase === "stable" && currentComposite <= STABLE_NEGATIVE_MAX;
  const isInPositivePhase = !isStableAtLowLevel && (
    phase === "recovering" || phase === "stable" || phase === "flowing" || phase === "elevated"
  );
  if (!isTrendingUpNow && !isInPositivePhase) {
    if (criticalDays >= 3) warningFlags.push("sustained_low");
    if (lowDays >= 5 && criticalDays < 3) warningFlags.push("sustained_low");
  }

  // lowDays/criticalDays medem desvio do baseline PESSOAL. Quem está deprimido
  // há meses tem o baseline já rebaixado: os dias ruins deixam de "desviar" e
  // os dois contadores zeram justamente no quadro mais grave. Este segundo
  // critério olha o nível ABSOLUTO — platô longo em faixa baixa acende o alerta
  // mesmo sem nenhum desvio, que é como depressão sustentada de fato se parece.
  const absoluteLowDays = composite14.filter((value) => value <= STABLE_NEGATIVE_MAX).length;
  if (!isTrendingUpNow && absoluteLowDays >= 7 && !warningFlags.includes("sustained_low")) {
    warningFlags.push("sustained_low");
  }

  // bipolar_ii / cyclothymia: lower sustained_elevated threshold (3 days vs 5)
  const sustainedElevatedThreshold = hasBipolarII ? 3 : 5;
  if (highDays >= sustainedElevatedThreshold) warningFlags.push("sustained_elevated");

  // ── Traços mistos ───────────────────────────────────────
  // Estado misto é definido por simultaneidade: elementos de polos opostos no
  // MESMO dia — humor deprimido junto com energia e agitação altas. É o que o
  // separa de ciclagem rápida, onde os polos se alternam.
  //
  // O composto (humor*0.6 + energia*0.4) DESTRÓI esse sinal: humor 2 com
  // energia 8 vira 4.4 e passa por dia intermediário. Como o app registra os
  // dois separadamente, a divergência está disponível de graça — só não estava
  // sendo olhada.
  const mixedDays = last14.filter(
    (entry) => entry.energia - entry.humor >= MIXED_DIVERGENCE_MIN && entry.humor <= MIXED_MOOD_MAX,
  ).length;
  if (mixedDays >= 3) warningFlags.push("mixed_features");

  // ── Necessidade de sono reduzida ────────────────────────
  // O marcador de hipomania incipiente não é dormir pouco — é dormir pouco E
  // ESTAR BEM. Dormir pouco com humor baixo é privação e já conta como fator
  // negativo em outro lugar; aqui só interessa o caso em que a pessoa corta
  // sono e mesmo assim fica acima do próprio baseline.
  const shortSleepElevatedDays = last7.filter((entry) => (
    typeof entry.sleepHours === "number"
    && entry.sleepHours <= SHORT_SLEEP_HOURS_MAX
    && weightedComposite(entry.humor, entry.energia) >= baselineComposite + 0.6
  )).length;
  if (shortSleepElevatedDays >= 2) warningFlags.push("reduced_sleep_need");

  // Queda rápida: últimos 2 dias vs 2 dias anteriores
  // Só dispara se a queda é recente E o humor não está subindo agora
  if (sorted.length >= 4 && !isTrendingUpNow) {
    const last2avg = mean(sorted.slice(-2).map((entry) => weightedComposite(entry.humor, entry.energia)));
    const prev2avg = mean(sorted.slice(-4, -2).map((entry) => weightedComposite(entry.humor, entry.energia)));
    if (prev2avg - last2avg > 1.25) warningFlags.push("rapid_drop");
  }

  // Correlação sono-humor
  if (sleepValues.length >= 5) {
    const humorsForSleep = last7.slice(-sleepValues.length).map(e => e.humor);
    if (humorsForSleep.length === sleepValues.length) {
      const meanH = mean(humorsForSleep);
      const meanS = mean(sleepValues);
      const num = humorsForSleep.reduce((acc, h, i) => acc + (h - meanH) * (sleepValues[i] - meanS), 0);
      const denH = Math.sqrt(humorsForSleep.reduce((acc, h) => acc + Math.pow(h - meanH, 2), 0));
      const denS = Math.sqrt(sleepValues.reduce((acc, s) => acc + Math.pow(s - meanS, 2), 0));
      const corr = (denH > 0 && denS > 0) ? num / (denH * denS) : 0;
      if (Math.abs(corr) > 0.6) warningFlags.push("sleep_impact_high");
    }
  }

  // Frequência de checkin
  if (sorted.length < 4) warningFlags.push("low_checkin_frequency");

  // ── Estimativa do ciclo ────────────────────────────────
  let estimatedLengthDays: number | null = null;
  let currentDayInCycle: number | null = null;
  const hasEnoughData = sorted.length >= 14;

  if (hasEnoughData) {
    // Detectar vales (pontos de baixo local) para estimar comprimento do ciclo
    const allHumors = sorted.map(e => e.humor);
    const valleys: number[] = []; // índices dos vales

    for (let i = 1; i < allHumors.length - 1; i++) {
      if (allHumors[i] < allHumors[i - 1] && allHumors[i] < allHumors[i + 1] && allHumors[i] <= 5.6) {
        valleys.push(i);
      }
    }

    if (valleys.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < valleys.length; i++) {
        gaps.push(valleys[i] - valleys[i - 1]);
      }
      estimatedLengthDays = Math.round(mean(gaps));
      const lastValley = valleys[valleys.length - 1];
      currentDayInCycle = sorted.length - 1 - lastValley;
    }
  }

  // ── Contexto para IA ───────────────────────────────────
  const cfg = PHASE_CONFIG[phase];

  // Modulador biológico: ciclo menstrual
  const menstrualModulator = computeMenstrualModulator(sorted);

  // Ajusta energyForecast se o ciclo menstrual indica fase de baixa energia
  let energyForecast = cfg.energyForecast;
  if (menstrualModulator.detected) {
    if (menstrualModulator.energyModifier <= -0.4) {
      // menstrual ou lútea tardia forte: rebaixa uma casa
      if (energyForecast === 'high') energyForecast = 'moderate';
      else if (energyForecast === 'moderate') energyForecast = 'low';
    } else if (menstrualModulator.energyModifier >= 0.4 && energyForecast === 'low') {
      // folicular / ovulatória: eleva uma casa se estava baixo
      energyForecast = 'moderate';
    }
  }

  const stableReading = buildStableReading(phase, currentComposite, daysInPhase);

  const aiContext = [
    `Padrão pessoal: ${cfg.label} (${phase}) — ${daysInPhase} dia(s) nesta faixa.`,
    stableReading.isStable
      ? `Valência da estabilidade: ${stableReading.label} (${stableReading.valence}) — ${stableReading.description}`
      : "",
    `Baseline pessoal: humor ${baselineMood.toFixed(1)}/10 | energia ${baselineEnergy.toFixed(1)}/10 | combinado ${baselineComposite.toFixed(1)}/10.`,
    `Leitura atual: humor ${currentMoodEwma.toFixed(1)}/10 | energia ${currentEnergyEwma.toFixed(1)}/10 | combinado ${currentComposite.toFixed(1)}/10.`,
    `Desvio do baseline: Δhumor ${baselineDeltaMood > 0 ? "+" : ""}${baselineDeltaMood.toFixed(2)} | Δenergia ${baselineDeltaEnergy > 0 ? "+" : ""}${baselineDeltaEnergy.toFixed(2)} | Δcombinado ${baselineDeltaComposite > 0 ? "+" : ""}${baselineDeltaComposite.toFixed(2)}.`,
    `Tendência: ${trend7d > 0.2 ? "subindo" : trend7d < -0.2 ? "caindo" : "estável"} (Δ${trend7d > 0 ? "+" : ""}${trend7d.toFixed(2)}).`,
    `Estabilidade: ${stabilityScore}/100 | Volatilidade: ${volatility14d.toFixed(2)} | faixa pessoal: ${trendProfile.trendBandLabel}.`,
    avgSleep7d ? `Sono médio: ${avgSleep7d.toFixed(1)}/10.` : "",
    warningFlags.length > 0 ? `Alertas: ${warningFlags.join(", ")}.` : "",
    // Traduz as flags clínicas em conduta, porque o nome da flag sozinho não
    // diz à IA o que fazer com ela. Base em docs/product/base-clinica-padroes-e-acoes.md
    warningFlags.includes("mixed_features")
      ? "Traços mistos (humor baixo com energia alta no mesmo dia): não proponha nada que exija decisão rápida nem que possa aumentar irritação. Ação de baixa exigência e sem consequência irreversível."
      : "",
    warningFlags.includes("reduced_sleep_need")
      ? "Necessidade de sono reduzida (dormiu pouco e seguiu acima do baseline): marcador de elevação. Conduta é desacelerar — adie compromisso novo e meta ambiciosa, não some carga."
      : "",
    warningFlags.includes("sustained_elevated")
      ? "Elevação sustentada: propor meta grande agora é contraproducente. Priorize proteger sono e conter impulso."
      : "",
    `Previsão de energia hoje: ${ENERGY_LABELS[energyForecast]}.`,
    menstrualModulator.detected ? `Modulador menstrual: ${menstrualModulator.contextNote}` : "",
  ].filter(Boolean).join(" ");

  return {
    phase,
    phaseLabel: cfg.label,
    phaseEmoji: cfg.emoji,
    phaseDescription: cfg.description,
    phaseTip: cfg.tip,
    daysInPhase,
    stabilityScore,
    trend7d,
    volatility14d,
    avgMood7d,
    avgEnergy7d,
    avgSleep7d,
    energyForecast,
    energyForecastLabel: ENERGY_LABELS[energyForecast],
    warningFlags,
    stableReading,
    cycleEstimate: {
      hasEnoughData,
      estimatedLengthDays,
      currentDayInCycle,
    },
    personalTrend: trendProfile,
    baselineMood,
    baselineEnergy,
    baselineComposite,
    currentMoodEwma,
    currentEnergyEwma,
    currentComposite,
    personalTrendLabel: trendProfile.trendBandLabel,
    personalTrendDescription: trendProfile.trendBandDescription,
    personalTrendTip: trendProfile.trendBandTip,
    personalTrendBand: trendProfile.trendBand,
    baselineDeltaMood,
    baselineDeltaEnergy,
    baselineDeltaComposite,
    aiContext,
    menstrualModulator,
  };
}

// ── Cor da fase ────────────────────────────────────────────

export function getPhaseColor(phase: MoodPhase): string {
  return PHASE_CONFIG[phase]?.color ?? "var(--text-3)";
}

// ── Texto do score de estabilidade ────────────────────────

export function getStabilityLabel(score: number): string {
  if (score >= 80) return "muito alta";
  if (score >= 60) return "moderada";
  if (score >= 40) return "baixa";
  if (score >= 20) return "muito baixa";
  return "crítica";
}

// ── Previsão EWMA — próximos 7 dias ───────────────────────────
// Usa Double Exponential Smoothing (Holt's method) para projetar
// os próximos 7 dias com decaimento de tendência.
function forecastMetric7d(history: CheckinEntry[], getValue: (entry: CheckinEntry) => number): number[] {
  const sorted = aggregateCheckinsByDay(history);
  if (sorted.length < 5) return [];

  const values = sorted.map(getValue);
  const alpha = 0.3, beta = 0.1;
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const forecast: number[] = [];
  let l = level, t = trend;
  for (let i = 1; i <= 7; i++) {
    l += t;
    t *= 0.82; // decaimento da tendência
    forecast.push(Math.max(1, Math.min(10, l)));
  }
  return forecast;
}

export function forecastMood7d(history: CheckinEntry[]): number[] {
  return forecastMetric7d(history, (entry) => entry.humor);
}

export function forecastEnergy7d(history: CheckinEntry[]): number[] {
  return forecastMetric7d(history, (entry) => entry.energia);
}

// ── Score de consistência semanal (0-100) ──────────────────────
// check-ins (40) + hábitos diários completados (40) + journal (20)
export function computeConsistencyScore(
  history: CheckinEntry[],
  habits: Array<{ frequency: string; completions?: Array<{ date?: string | null }> }>,
  journalSessions: number,
): number {
  const today = new Date();
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return getLocalDateKey(d);
  });

  // 40 pts: check-ins esta semana (max 7, cada = ~5.7 pts)
  const checkinDates = new Set(history.map(h => h.date));
  const checkinsThisWeek = weekDates.filter(d => checkinDates.has(d)).length;
  const checkinScore = Math.round((checkinsThisWeek / 7) * 40);

  // 40 pts: hábitos diários completados esta semana
  const dailyHabits = habits.filter(h => h.frequency === "daily");
  if (dailyHabits.length > 0) {
    let totalSlots = 0, completedSlots = 0;
    for (const d of weekDates) {
      totalSlots += dailyHabits.length;
      completedSlots += dailyHabits.filter(h =>
        h.completions?.some(c => c.date?.startsWith(d))
      ).length;
    }
    var habitScore = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 40) : 20;
  } else {
    var habitScore = 20; // sem hábitos = neutro
  }

  // 20 pts: journals esta semana (1+ = 10, 3+ = 20)
  const journalScore = journalSessions >= 3 ? 20 : journalSessions >= 1 ? 10 : 0;

  return Math.min(100, checkinScore + habitScore + journalScore);
}

// ── Histórico de fases (timeline) ─────────────────────────
// Roda computeMoodCycle em janelas deslizantes para reconstituir as fases
// que o usuário atravessou nos últimos `windowDays` dias.
// Retorna segmentos consecutivos da mesma fase (ex: [stable 5d][falling 2d][depleted 3d]).
export type PhaseHistorySegment = {
  phase: MoodPhase;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
};

export function computePhaseHistory(
  history: CheckinEntry[],
  windowDays = 30,
): PhaseHistorySegment[] {
  const aggregated = aggregateCheckinsByDay(history);
  if (aggregated.length === 0) return [];

  // Limitar à janela desejada
  const sliced = aggregated.slice(-windowDays);
  if (sliced.length < 3) return [];

  // Para cada dia, computa fase usando todos os dados ATÉ aquele dia
  const dailyPhases: Array<{ date: string; phase: MoodPhase }> = [];
  for (let i = 2; i < sliced.length; i++) {
    const upTo = sliced.slice(0, i + 1);
    const report = computeMoodCycle(upTo);
    dailyPhases.push({ date: sliced[i].date, phase: report.phase });
  }

  if (dailyPhases.length === 0) return [];

  // Agrupar dias consecutivos da mesma fase
  const segments: PhaseHistorySegment[] = [];
  let current: PhaseHistorySegment = {
    phase: dailyPhases[0].phase,
    startDate: dailyPhases[0].date,
    endDate: dailyPhases[0].date,
    daysCount: 1,
  };
  for (let i = 1; i < dailyPhases.length; i++) {
    const day = dailyPhases[i];
    if (day.phase === current.phase) {
      current.endDate = day.date;
      current.daysCount += 1;
    } else {
      segments.push(current);
      current = { phase: day.phase, startDate: day.date, endDate: day.date, daysCount: 1 };
    }
  }
  segments.push(current);
  return segments;
}

// ── Mapa diário de fases ─────────────────────────────────
// Para cada dia do histórico, devolve a fase computada por sliding window.
// Útil para colorir pontos de gráficos (mensal/forecast) com a fase real do dia.
export function computeDailyPhaseMap(
  history: CheckinEntry[],
  windowDays = 30,
): Record<string, MoodPhase> {
  const aggregated = aggregateCheckinsByDay(history);
  if (aggregated.length === 0) return {};

  const sliced = aggregated.slice(-windowDays);
  if (sliced.length < 3) return {};

  const out: Record<string, MoodPhase> = {};
  for (let i = 2; i < sliced.length; i++) {
    const upTo = sliced.slice(0, i + 1);
    const report = computeMoodCycle(upTo);
    out[sliced[i].date] = report.phase;
  }
  return out;
}

// ── Fase a partir de um valor de humor único (sem janela) ──
// Usado para colorir pontos do FORECAST onde só temos a previsão pontual.
// Aplica thresholds simplificados (não considera volatility/trend).
export function phaseFromMoodValue(humor: number): MoodPhase {
  if (humor >= 8.4) return "elevated";
  if (humor >= 7.2) return "flowing";
  if (humor < 3.0) return "depleted";
  if (humor < 5.0) return "low";
  if (humor >= 5.6) return "stable";
  return "falling";
}

// ── Agregar histórico por granularidade (day/week/month) ──
// Usado pelo chart drill-down (mensal/trimestral/semestral/anual).
export function aggregateByGranularity(
  history: CheckinEntry[],
  granularity: "day" | "week" | "month",
): CheckinEntry[] {
  const daily = aggregateCheckinsByDay(history);
  if (granularity === "day" || daily.length === 0) return daily;

  // Helper: chave de bucket
  const bucketKey = (dateIso: string): string => {
    const d = new Date(dateIso + "T12:00:00");
    if (granularity === "month") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }
    // week: ancorar em domingo
    const day = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);
    return sunday.toISOString().slice(0, 10);
  };

  const buckets = new Map<string, CheckinEntry[]>();
  for (const entry of daily) {
    const key = bucketKey(entry.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(entry);
  }

  return Array.from(buckets.entries())
    .map(([date, entries]) => ({
      date,
      humor: Number(mean(entries.map(e => e.humor)).toFixed(2)),
      energia: Number(mean(entries.map(e => e.energia)).toFixed(2)),
      emotion: entries[entries.length - 1]?.emotion ?? "calm",
      sono: averageDefined(entries.map(e => e.sono)),
      fisico: averageDefined(entries.map(e => e.fisico)),
      social: averageDefined(entries.map(e => e.social)),
    } satisfies CheckinEntry))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Streak — dias consecutivos com check-in ─────────────────
// Conta de hoje para trás quantos dias seguidos têm entrada no histórico.
export function computeStreak(history: CheckinEntry[]): number {
  if (history.length === 0) return 0;
  const dateSet = new Set(history.map(h => h.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = getLocalDateKey(d);
    if (dateSet.has(iso)) streak++;
    else break;
  }
  return streak;
}
