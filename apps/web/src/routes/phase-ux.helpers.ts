// Onda 3 — entrega de valor: UI adaptativa por fase, primeiro insight e janela do resumo semanal.
import type { MoodPhase } from "../utils/mood-cycle-engine";
import type { CheckinHistoryLike } from "./checkin-page.helpers";

// ─── UI adaptativa por fase ──────────────────────────────────────────────────
// O app já sabe a fase; a interface reage. Em fase baixa (Recolhimento/Pausa)
// reduz carga visual e aumenta o alvo de toque. Em fase alta, mostra tudo.

export type HomeDensityMode = "minimal" | "default" | "expanded";

export type HomeDensity = {
  mode: HomeDensityMode;
  // esconde cards de pressão (estatística de tarefas) quando a energia está baixa
  hidePressureCards: boolean;
  // botão principal maior em fase baixa = menos esforço motor
  primaryActionMinHeight: number;
  // nota de tom curta exibida na home (null = sem nota)
  toneNote: string | null;
};

const LOW_PHASES: ReadonlySet<MoodPhase> = new Set<MoodPhase>(["low", "depleted"]);
const HIGH_PHASES: ReadonlySet<MoodPhase> = new Set<MoodPhase>(["elevated", "flowing"]);

export function resolveHomeDensity(phase: MoodPhase): HomeDensity {
  if (LOW_PHASES.has(phase)) {
    return {
      mode: "minimal",
      hidePressureCards: true,
      primaryActionMinHeight: 66,
      toneNote: "Modo leve: deixei menos coisa na tela enquanto sua energia volta.",
    };
  }
  if (HIGH_PHASES.has(phase)) {
    return {
      mode: "expanded",
      hidePressureCards: false,
      primaryActionMinHeight: 56,
      toneNote: null,
    };
  }
  return {
    mode: "default",
    hidePressureCards: false,
    primaryActionMinHeight: 56,
    toneNote: null,
  };
}

// ─── Primeiro insight (após 7 dias de check-in) ──────────────────────────────
// Entrega UMA leitura concreta — o momento "uau, isso funciona". Determinístico
// e honesto: prefere padrão de dia da semana, depois descompasso humor/energia;
// se nada se destaca, retorna null (melhor nada do que insight fraco).

export type FirstInsightKind = "weekday_low" | "weekday_high" | "energy_behind" | "mood_behind";

export type FirstInsight = {
  kind: FirstInsightKind;
  headline: string;
  detail: string;
};

const WEEKDAY_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];
const FIRST_INSIGHT_MIN_DAYS = 7;
const FIRST_INSIGHT_WINDOW_DAYS = 56; // ~8 semanas: "nas últimas semanas"
const WEEKDAY_GAP = 1.2;
const ENERGY_MOOD_GAP = 1.5;

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayStamp(dateKey: string): number | null {
  if (!isDateKey(dateKey)) return null;
  const stamp = Date.parse(`${dateKey}T12:00:00.000Z`);
  return Number.isNaN(stamp) ? null : stamp;
}

function weekdayOf(dateKey: string): number | null {
  const stamp = dayStamp(dateKey);
  return stamp == null ? null : new Date(stamp).getUTCDay();
}

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function computeFirstInsight(history: CheckinHistoryLike[], todayKey: string): FirstInsight | null {
  const today = dayStamp(todayKey);
  if (today == null) return null;
  const windowStart = today - FIRST_INSIGHT_WINDOW_DAYS * 86_400_000;

  // 1 ponto por dia (média do dia), dentro da janela
  const byDate = new Map<string, { mood: number; energy: number; n: number }>();
  for (const entry of history) {
    const stamp = dayStamp(entry.date);
    if (stamp == null || stamp > today || stamp < windowStart) continue;
    if (!Number.isFinite(entry.humor) || !Number.isFinite(entry.energia)) continue;
    const current = byDate.get(entry.date) ?? { mood: 0, energy: 0, n: 0 };
    current.mood += entry.humor;
    current.energy += entry.energia;
    current.n += 1;
    byDate.set(entry.date, current);
  }

  const days = [...byDate.entries()].map(([date, value]) => ({
    date,
    mood: value.mood / value.n,
    energy: value.energy / value.n,
  }));
  if (days.length < FIRST_INSIGHT_MIN_DAYS) return null;

  const overallMood = avg(days.map((day) => day.mood));
  const overallEnergy = avg(days.map((day) => day.energy));

  // Padrão por dia da semana (só conta dia com 2+ amostras)
  const buckets = new Map<number, number[]>();
  for (const day of days) {
    const weekday = weekdayOf(day.date);
    if (weekday == null) continue;
    const list = buckets.get(weekday) ?? [];
    list.push(day.mood);
    buckets.set(weekday, list);
  }
  let worst: { weekday: number; mean: number } | null = null;
  let best: { weekday: number; mean: number } | null = null;
  for (const [weekday, list] of buckets) {
    if (list.length < 2) continue;
    const mean = avg(list);
    if (!worst || mean < worst.mean) worst = { weekday, mean };
    if (!best || mean > best.mean) best = { weekday, mean };
  }

  if (worst && overallMood - worst.mean >= WEEKDAY_GAP) {
    const label = WEEKDAY_PLURAL[worst.weekday];
    return {
      kind: "weekday_low",
      headline: `Suas ${label} costumam vir mais pesadas`,
      detail: `Nas últimas semanas, ${label} aparecem com humor abaixo da sua média (${worst.mean.toFixed(1)} contra ${overallMood.toFixed(1)}). Vale aliviar a carga desse dia antes que ele pese.`,
    };
  }
  if (best && best.mean - overallMood >= WEEKDAY_GAP) {
    const label = WEEKDAY_PLURAL[best.weekday];
    return {
      kind: "weekday_high",
      headline: `Suas ${label} costumam ser suas melhores`,
      detail: `${capitalize(label)} vêm com humor acima da sua média (${best.mean.toFixed(1)} contra ${overallMood.toFixed(1)}). É um bom dia pra colocar o que exige mais de você.`,
    };
  }

  if (overallMood - overallEnergy >= ENERGY_MOOD_GAP) {
    return {
      kind: "energy_behind",
      headline: "Sua energia anda atrás do seu humor",
      detail: `Na média, seu humor (${overallMood.toFixed(1)}) vem mais alto que sua energia (${overallEnergy.toFixed(1)}). Querer não é o problema — o corpo pede dose menor.`,
    };
  }
  if (overallEnergy - overallMood >= ENERGY_MOOD_GAP) {
    return {
      kind: "mood_behind",
      headline: "Você tem energia, mas o humor pesa",
      detail: `Sua energia (${overallEnergy.toFixed(1)}) vem acima do humor (${overallMood.toFixed(1)}). Movimento ajuda, mas o que pesa aí é emocional, não físico.`,
    };
  }

  return null;
}

// ─── Janela do resumo semanal automático ─────────────────────────────────────
// A pessoa não deveria caçar gráfico. Domingo à noite ou segunda, a home oferece
// 1 card com a leitura da semana. Dismissal é por semana (volta na seguinte).

export function shouldOfferWeeklySummary(now: Date): boolean {
  const day = now.getDay(); // 0 = domingo ... 6 = sábado
  const hour = now.getHours();
  if (day === 0) return hour >= 18; // domingo a partir das 18h
  return day === 1; // segunda o dia todo
}

// Chave da semana (segunda-feira ISO) para guardar o dismissal sem remostrar.
export function weekKeyOf(now: Date): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = date.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offsetToMonday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}
