/**
 * MoodCycleEngine — Motor de Ciclagem de Humor
 *
 * Calcula algoritmicamente a fase atual do ciclo de humor
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

export type EnergyForecast = "high" | "moderate" | "low" | "rest";

export type WarningFlag =
  | "high_volatility"       // Variabilidade acima de 1.2 — ciclo instável
  | "sustained_low"         // 5+ dias abaixo de 2.5 — alerta depressivo
  | "rapid_drop"            // Queda de >1.5 pts em 48h — alerta de episódio
  | "sustained_elevated"    // 5+ dias acima de 4.2 — alerta hipomaníaco
  | "sleep_impact_high"     // Correlação sono-humor > 0.6
  | "low_checkin_frequency"; // Menos de 4 checkins nos últimos 7 dias

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
  avgSleep7d: number | null; // média de sono 7 dias (null = sem dados)
  energyForecast: EnergyForecast;
  energyForecastLabel: string;
  warningFlags: WarningFlag[];
  cycleEstimate: {
    hasEnoughData: boolean;
    estimatedLengthDays: number | null;
    currentDayInCycle: number | null;
  };
  // Para o prompt da IA
  aiContext: string;
};

// ── Config de fase ─────────────────────────────────────────

const PHASE_CONFIG: Record<MoodPhase, {
  label: string;
  emoji: string;
  description: string;
  tip: string;
  color: string;
  energyForecast: EnergyForecast;
}> = {
  elevated: {
    label: "Fase Elevada",
    emoji: "🚀",
    description: "Humor e energia acima do seu basal habitual. Ótimo para projetos que exigem criatividade e iniciativa.",
    tip: "Aproveite a energia, mas mantenha o ritmo sustentável. Evite decisões impulsivas.",
    color: "var(--accent-sky)",
    energyForecast: "high",
  },
  flowing: {
    label: "Fluindo",
    emoji: "✨",
    description: "Você está no seu melhor ritmo. Clareza mental, motivação e energia alinhadas.",
    tip: "Pico de produtividade. Priorize suas tarefas mais importantes agora.",
    color: "var(--accent-sage)",
    energyForecast: "high",
  },
  stable: {
    label: "Estável",
    emoji: "💚",
    description: "Estado basal equilibrado — eutimia. Ritmo constante e previsível.",
    tip: "Bom momento para construir hábitos e avançar consistentemente.",
    color: "var(--accent-sage)",
    energyForecast: "moderate",
  },
  falling: {
    label: "Descendo",
    emoji: "📉",
    description: "Tendência de queda detectada. Seu humor está abaixo do padrão recente.",
    tip: "Reduza o ritmo. Priorize sono, alimentação e autocuidado agora.",
    color: "var(--accent-peach)",
    energyForecast: "moderate",
  },
  low: {
    label: "Fase Baixa",
    emoji: "🌙",
    description: "Você está numa fase de menor energia e humor. É um padrão natural do ciclo.",
    tip: "Este é o momento de restaurar — não de produzir. Gentileza consigo mesma é a prioridade.",
    color: "var(--accent-peach-strong)",
    energyForecast: "low",
  },
  depleted: {
    label: "Esgotamento",
    emoji: "😴",
    description: "Energia e humor muito baixos. Seu sistema precisa de recuperação ativa.",
    tip: "Cancele o que puder. Descanso não é fraqueza — é necessidade biológica agora.",
    color: "var(--accent-peach-ink)",
    energyForecast: "rest",
  },
  recovering: {
    label: "Recuperando",
    emoji: "🌱",
    description: "Você está saindo de uma fase baixa. Energia retornando gradualmente.",
    tip: "Retome devagar. Comemore cada pequeno avanço — você está no caminho certo.",
    color: "var(--accent-sage)",
    energyForecast: "low",
  },
  mixed: {
    label: "Instável",
    emoji: "⚡",
    description: "Alta variabilidade detectada. Altos e baixos frequentes sem padrão claro.",
    tip: "Cuidado com decisões impulsivas. Foque em rotina e sono — estabilizam o ciclo.",
    color: "var(--accent-peach)",
    energyForecast: "moderate",
  },
  insufficient_data: {
    label: "Sem dados suficientes",
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
        fisico: averageDefined(ordered.map((entry) => entry.fisico)),
        social: averageDefined(ordered.map((entry) => entry.social)),
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

// ── Motor principal ────────────────────────────────────────

export function computeMoodCycle(history: CheckinEntry[]): MoodCycleReport {
  // Ordenar por data (mais antigo → mais recente)
  const sorted = aggregateCheckinsByDay(history);

  // Dados insuficientes
  if (sorted.length < 3) {
    const cfg = PHASE_CONFIG.insufficient_data;
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
      cycleEstimate: { hasEnoughData: false, estimatedLengthDays: null, currentDayInCycle: null },
      aiContext: "Poucos dados para análise — usuária está começando a rastrear o ciclo.",
    };
  }

  // Janelas de dados
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const last14 = sorted.slice(-14);
  const last5 = sorted.slice(-5);
  const last3 = sorted.slice(-3);

  const humors7 = last7.map(e => e.humor);
  const humors14 = last14.map(e => e.humor);
  const humors7prev = prev7.map(e => e.humor);
  const energies7 = last7.map(e => e.energia);

  const avgMood7d = mean(humors7);
  const avgMoodPrev7 = humors7prev.length > 0 ? mean(humors7prev) : avgMood7d;
  const avgEnergy7d = mean(energies7);
  const trend7d = avgMood7d - avgMoodPrev7;
  const volatility14d = stdDev(humors14);
  const ewmaRecent = ewma(last7.map(e => e.humor));
  const recent3avg = mean(last3.map(e => e.humor));
  const recent5avg = mean(last5.map(e => e.humor));

  // Sono
  const sleepValues = last7.map(e => e.sono).filter(s => s !== undefined) as number[];
  const avgSleep7d = sleepValues.length > 0 ? mean(sleepValues) : null;

  // ── Detecção de fase ────────────────────────────────────
  let phase: MoodPhase = "stable";
  let previousPhase: MoodPhase | null = null;

  // Verificar fase anterior (para detectar "recovering")
  if (sorted.length >= 10) {
    const before = sorted.slice(-14, -7);
    const beforeAvg = mean(before.map(e => e.humor));
    if (beforeAvg < 4.0) previousPhase = "depleted";
    else if (beforeAvg < 5.0) previousPhase = "low";
  }

  if (recent3avg >= 8.4 && volatility14d < 2.0) {
    phase = "elevated";
  } else if (recent3avg < 3.6 || recent5avg < 4.0) {
    phase = "depleted";
  } else if (recent5avg < 5.0) {
    phase = "low";
  } else if (
    (previousPhase === "low" || previousPhase === "depleted") &&
    trend7d > 0.6 &&
    avgMood7d >= 5.0
  ) {
    phase = "recovering";
  } else if (volatility14d > 2.4 && humors14.length >= 7) {
    phase = "mixed";
  } else if (trend7d < -0.8 && avgMood7d > 5.0) {
    phase = "falling";
  } else if (ewmaRecent >= 7.2) {
    phase = "flowing";
  } else if (avgMood7d >= 5.6 && volatility14d <= 1.8) {
    phase = "stable";
  } else if (trend7d < -0.4) {
    phase = "falling";
  } else {
    phase = "stable";
  }

  // ── Dias na fase atual ──────────────────────────────────
  let daysInPhase = 1;
  const phaseThresholds: Record<MoodPhase, (h: number) => boolean> = {
    elevated:          h => h >= 8.0,
    flowing:           h => h >= 7.0,
    stable:            h => h >= 5.6 && h < 7.2,
    falling:           _h => true, // baseado em tendência, não em valor absoluto
    low:               h => h < 5.0,
    depleted:          h => h < 4.0,
    recovering:        h => h >= 5.0,
    mixed:             _h => true,
    insufficient_data: _h => true,
  };
  const phaseCheck = phaseThresholds[phase];
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (phaseCheck(sorted[i].humor)) {
      daysInPhase++;
    } else {
      break;
    }
    if (daysInPhase >= 30) break; // limite
  }

  // ── Score de estabilidade (0-100) ──────────────────────
  let stabilityScore = 100;
  stabilityScore -= Math.min(30, volatility14d * 9);       // variabilidade
  stabilityScore -= Math.min(20, Math.abs(trend7d) * 5);  // mudança brusca
  const lowDays = humors14.filter(h => h <= 5.0).length;
  stabilityScore -= Math.min(25, lowDays * 4);              // dias baixos
  const highDays = humors14.filter(h => h >= 9.0).length;
  stabilityScore -= Math.min(10, highDays * 3);             // dias muito altos
  if (sorted.length < 7) stabilityScore -= 15;              // poucos dados
  stabilityScore = Math.max(0, Math.min(100, Math.round(stabilityScore)));

  // ── Warning flags ──────────────────────────────────────
  const warningFlags: WarningFlag[] = [];

  if (volatility14d > 2.4) warningFlags.push("high_volatility");
  if (lowDays >= 5) warningFlags.push("sustained_low");
  if (highDays >= 5) warningFlags.push("sustained_elevated");

  // Queda rápida: últimos 2 dias vs 2 dias anteriores
  if (sorted.length >= 4) {
    const last2avg = mean(sorted.slice(-2).map(e => e.humor));
    const prev2avg = mean(sorted.slice(-4, -2).map(e => e.humor));
    if (prev2avg - last2avg > 3.0) warningFlags.push("rapid_drop");
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
  const aiContext = [
    `FASE DO CICLO DE HUMOR: ${cfg.label} (${phase}) — ${daysInPhase} dia(s) nesta fase.`,
    `Média de humor 7 dias: ${avgMood7d.toFixed(1)}/10 | Energia: ${avgEnergy7d.toFixed(1)}/10.`,
    `Tendência: ${trend7d > 0.2 ? "subindo" : trend7d < -0.2 ? "caindo" : "estável"} (Δ${trend7d > 0 ? "+" : ""}${trend7d.toFixed(2)}).`,
    `Estabilidade: ${stabilityScore}/100 | Volatilidade: ${volatility14d.toFixed(2)}.`,
    avgSleep7d ? `Sono médio: ${avgSleep7d.toFixed(1)}/10.` : "",
    warningFlags.length > 0 ? `Alertas: ${warningFlags.join(", ")}.` : "",
    `Previsão de energia hoje: ${ENERGY_LABELS[cfg.energyForecast]}.`,
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
    energyForecast: cfg.energyForecast,
    energyForecastLabel: ENERGY_LABELS[cfg.energyForecast],
    warningFlags,
    cycleEstimate: {
      hasEnoughData,
      estimatedLengthDays,
      currentDayInCycle,
    },
    aiContext,
  };
}

// ── Cor da fase ────────────────────────────────────────────

export function getPhaseColor(phase: MoodPhase): string {
  return PHASE_CONFIG[phase]?.color ?? "var(--text-3)";
}

// ── Texto do score de estabilidade ────────────────────────

export function getStabilityLabel(score: number): string {
  if (score >= 80) return "Muito estável";
  if (score >= 60) return "Estável";
  if (score >= 40) return "Moderado";
  if (score >= 20) return "Instável";
  return "Muito instável";
}

// ── Previsão EWMA — próximos 7 dias ───────────────────────────
// Usa Double Exponential Smoothing (Holt's method) para projetar
// o humor dos próximos 7 dias com decaimento de tendência.
export function forecastMood7d(history: CheckinEntry[]): number[] {
  const sorted = aggregateCheckinsByDay(history);
  if (sorted.length < 5) return [];

  const humors = sorted.map(e => e.humor);
  const alpha = 0.3, beta = 0.1;
  let level = humors[0];
  let trend = humors.length > 1 ? humors[1] - humors[0] : 0;

  for (let i = 1; i < humors.length; i++) {
    const prevLevel = level;
    level  = alpha * humors[i] + (1 - alpha) * (level + trend);
    trend  = beta  * (level - prevLevel) + (1 - beta) * trend;
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
