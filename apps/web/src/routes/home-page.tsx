// Home Page v4 — babá digital IA + mensagens personalizadas + agenda por blocos
import { FEATURES } from "../config/features";
import { GoalFocusCard } from "../components/GoalFocusCard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { supabase } from "../lib/supabase";
import { HabitIdeasModal, type HabitModalPayload } from "../features/aura/HabitIdeasModal";
import { api, setAdaptiveSnapshot } from "../lib/api";
import { trackEvent } from "../lib/track";
import { tryParseAiSuggestion } from "../lib/ai";
import { AiriaLogoBg } from "../components/AuraIcon";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { PhaseLegendSheet } from "../components/PhaseLegendSheet";
import { JornadaHomeCard } from "../components/JornadaHomeCard";
import { ProgressStrip } from "../components/ProgressStrip";
import { aggregateCheckinsByDay, computeDailyPhaseMap, computeMoodCycle, forecastEnergy7d, forecastMood7d, getPhaseColor, getStabilityLabel, phaseFromMoodValue, PHASE_CONFIG, type MoodPhase } from "../utils/mood-cycle-engine";
import { Card, SectionTitle, Stat } from "../components/ui/card";
import { computeDaysSinceLastCheckin, REENTRY_GAP_DAYS } from "./checkin-page.helpers";
import {
  computeFirstInsight,
  resolveHomeDensity,
  shouldOfferWeeklySummary,
  weekKeyOf,
  type FirstInsight,
} from "./phase-ux.helpers";
import { computeMenstrualPhase } from "../utils/menstrual-phase";
import { getClientDayContext, getLocalDateKey, normalizeDateKey } from "../utils/day-context";
import { resolveIntlLocale, useLocalizedCopy } from "../i18n";
import { buildGoalSuggestionRouteState } from "../utils/goal-suggestion-routing";
import { createNativeTodayWidgetPayload, postNativeWidgetSync } from "../utils/native-shell";
import { dismissProactiveNudgeForToday } from "../utils/proactive-nudge-dismissal";
import {
  type HomeAiMsg,
  buildHomeAgendaPreview,
  buildHomeAiRequestKey,
  buildQuarterHourRefreshBucket,
  deriveHomePrimaryAction,
  extractBlockedHomeAutonomyTitles,
  extractHomeRepeatContext,
  isHomeAutonomyTitleBlocked,
  readHomeAutonomyFeedback,
  rememberHomeAutonomyActionFeedback,
} from "./home-page.helpers";
import { findSmartPlannerSlot } from "./planner-page.helpers";
import { 
  MessageSquareText,
  LayoutDashboard,
  Activity,
  Target,
  Timer,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import { ActivationChecklist } from "../components/activation/ActivationChecklist";
import { FirstRunGuide } from "../components/activation/FirstRunGuide";
import { getActivationState } from "../features/aura/activation";
import { isHabitDueOnDate } from "../features/aura/habit-helpers";
import { NotificationPromptBanner } from "../components/NotificationPromptBanner";
import { PresenceCard } from "../components/PresenceCard";
import { GoalNudgeCard } from "../components/GoalNudgeCard";
// import { ReferralCard } from "../components/ReferralCard"; // reserved for referral section
import "../styles/aura.css";
import "../styles/editorial.css";

const STATE_CONFIG = {
  stable:  { emoji: "💚", label: "Estável",   color: "var(--accent-sage)",    bg: "rgba(180,185,169,.10)" },
  rising:  { emoji: "📈", label: "Subindo",   color: "var(--accent-sky)",    bg: "rgba(176,180,196,.10)"  },
  falling: { emoji: "📉", label: "Caindo",    color: "var(--accent-peach)", bg: "rgba(197,165,147,.10)" },
  alert:   { emoji: "⚠️", label: "Atenção",   color: "#A17D6C",          bg: "rgba(161,125,108,.08)"  },
} as const;

type ImportantAlert = {
  key: string;
  title: string;
  description: string;
  evidence: string;
  tone: "info" | "warning" | "critical";
  actionLabel?: string;
  actionPath?: string;
};

type HomeScheduleModalAction = {
  title: string;
  category: string;
  date: string;
  time: string;
  isNextDay: boolean;
};

type ChartPoint = {
  x: number;
  humorY: number | null;
  energiaY: number | null;
  label: string;
  phase?: MoodPhase;
  isHighlight?: boolean;
};

type HomeChartMode = "week" | "monthly" | "day" | "forecast";

const HOME_CHART_TABS: Array<{ id: HomeChartMode; label: string }> = [
  { id: "week", label: "Semana" },
  { id: "monthly", label: "Mensal" },
  { id: "day", label: "Hoje" },
  { id: "forecast", label: "7 dias" },
];

function polishHomeMicroAction(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const withoutFinalPeriod = trimmed.replace(/[.。]+$/, "");
  const emojiMatch = withoutFinalPeriod.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?\s*)/u);
  const emoji = emojiMatch?.[1] ?? "";
  const text = emoji ? withoutFinalPeriod.slice(emoji.length).trim() : withoutFinalPeriod;
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/enxagu(e|ar).+maos.+20s|maos.+20s/.test(normalized)) {
    return `${emoji || "🧼"} Lave bem as mãos por 20 segundos.`;
  }

  if (/som baixo/.test(normalized) && /(sem alternar|sem aumentar|continue)/.test(normalized)) {
    return `${emoji || "🕯️"} Escute um som baixo por 15 minutos sem aumentar o volume.`;
  }

  return `${emoji}${text}${text.endsWith(".") ? "" : "."}`.trim();
}

function polishHomeActionTitle(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");

  // Remove ponto final — títulos de ação não precisam de pontuação terminal
  const withoutPeriod = trimmed.replace(/[.。]+$/, "");

  // Capitaliza primeira letra
  const capitalized = withoutPeriod.charAt(0).toUpperCase() + withoutPeriod.slice(1);

  // Detecta verbos em 3ª pessoa do presente no início da frase
  // (padrão indesejado: "fecha uma caixa por 20 min" → corrige para "Feche uma caixa por 20 min")
  const normalized = capitalized
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  const imperativoMap: Record<string, string> = {
    fecha: "Feche", abre: "Abra", envia: "Envie", responde: "Responda",
    faz: "Faça", termina: "Termine", conclui: "Conclua", inicia: "Inicie",
    comeca: "Comece", revisa: "Revise", define: "Defina", liga: "Ligue",
    manda: "Mande", separa: "Separe", verifica: "Verifique", anota: "Anote",
    passa: "Passe", retoma: "Retome", avanca: "Avance", bloqueia: "Bloqueie",
    deleta: "Delete", cancela: "Cancele", agenda: "Agende", organiza: "Organize",
    registra: "Registre", escreve: "Escreva", resolve: "Resolva", testa: "Teste",
  };

  const firstWord = normalized.split(" ")[0];
  const imperative = imperativoMap[firstWord];
  if (imperative) {
    return imperative + capitalized.slice(firstWord.length);
  }

  return capitalized;
}

function normalizeHomeAiMessage(payload: unknown): HomeAiMsg | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Partial<HomeAiMsg> & { proactive?: unknown };
  const motivacional = typeof source.motivacional === "string" ? source.motivacional.trim() : "";
  const autocuidado = Array.isArray(source.autocuidado)
    ? source.autocuidado.filter((item): item is string => typeof item === "string").map(polishHomeMicroAction).filter(Boolean).slice(0, 3)
    : [];

  if (!motivacional && autocuidado.length === 0) return null;

  const proactiveRaw = source.proactive && typeof source.proactive === "object"
    ? source.proactive as { emoji?: unknown; title?: unknown; desc?: unknown; actionPath?: unknown }
    : null;

  return {
    motivacional: motivacional || "Hoje vale escolher uma única ação concreta e começar por ela.",
    autocuidado: autocuidado.length > 0 ? autocuidado : ["🌿 Respire por 1 minuto e alongue os ombros."],
    proactive: {
      emoji: typeof proactiveRaw?.emoji === "string" ? proactiveRaw.emoji : "🎯",
      title: typeof proactiveRaw?.title === "string" ? polishHomeActionTitle(proactiveRaw.title) : "Ação rápida",
      desc: typeof proactiveRaw?.desc === "string" ? proactiveRaw.desc : "Escolha um próximo passo simples para agora.",
      actionPath: typeof proactiveRaw?.actionPath === "string" ? proactiveRaw.actionPath : null,
    },
  };
}


const IMPORTANT_ALERT_CONFIG: Record<ImportantAlert["tone"], { accent: string; bg: string; border: string; emoji: string }> = {
  info: {
    accent: "var(--accent-sky)",
    bg: "rgba(176,180,196,.08)",
    border: "rgba(176,180,196,.22)",
    emoji: "ℹ️",
  },
  warning: {
    accent: "var(--accent-peach)",
    bg: "rgba(197,165,147,.08)",
    border: "rgba(197,165,147,.26)",
    emoji: "⚠️",
  },
  critical: {
    accent: "#A17D6C",
    bg: "rgba(161,125,108,.10)",
    border: "rgba(161,125,108,.28)",
    emoji: "🚨",
  },
};

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}





function valueToChartY(value: number | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const Y_TOP = 12;
  const Y_BOTTOM = 63;
  const Y_RANGE = Y_BOTTOM - Y_TOP;
  return Y_BOTTOM - ((numeric - 1) / 9) * Y_RANGE;
}

function getMoodFaceEmoji(value: number): string {
  if (value >= 7) return "😊";
  if (value < 4.5) return "😔";
  return "😐";
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function getCheckinMoment(entry: { recordedAt?: string; checkinSlot?: string }) {
  if (entry.recordedAt) {
    const stamp = new Date(entry.recordedAt).getTime();
    if (!Number.isNaN(stamp)) return stamp;
  }
  if (entry.checkinSlot?.startsWith("morning")) return 0;
  if (entry.checkinSlot?.startsWith("midday")) return 1;
  if (entry.checkinSlot?.startsWith("evening")) return 2;
  return 99;
}

function formatCheckinMomentLabel(
  entry: { recordedAt?: string; checkinSlot?: string },
  locale: string,
  labels: { morning: string; afternoon: string; evening: string; now: string },
) {
  if (entry.recordedAt) {
    const stamp = new Date(entry.recordedAt);
    if (!Number.isNaN(stamp.getTime())) {
      return stamp.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    }
  }

  if (entry.checkinSlot?.startsWith("morning")) return labels.morning;
  if (entry.checkinSlot?.startsWith("midday")) return labels.afternoon;
  if (entry.checkinSlot?.startsWith("evening")) return labels.evening;
  return labels.now;
}

function evidenceExcerpt(value: string, fallback = "Sem trecho suficiente para exibir."): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  return normalized.length > 150 ? `${normalized.slice(0, 147)}...` : normalized;
}

// ── Helpers de tempo ──────────────────────────────────────
function getGreetingKey(h: number): "home.greetingMorning" | "home.greetingAfternoon" | "home.greetingNight" {
  if (h >= 5 && h < 12) return "home.greetingMorning";
  if (h >= 12 && h < 18) return "home.greetingAfternoon";
  return "home.greetingNight";
}

function getGreetingEmoji(h: number) {
  if (h >= 5 && h < 12) return "🌅";
  if (h >= 12 && h < 18) return "☀️";
  return "🌙";
}

function formatStabilityStatus(score: number) {
  return `Estabilidade ${getStabilityLabel(score)} · ${score}/100`;
}


const moodMap: Record<string, { emoji: string; label: string; description: string; tip: string; chipLabel: string }> = {
  equilibrada: {
    emoji: "😌",
    label: "Em Equilíbrio",
    description: "Ritmo tranquilo e constante. Boa base para tarefas do dia.",
    tip: "Comece com tarefas leves e vá aumentando o ritmo gradualmente.",
    chipLabel: "Em equilíbrio",
  },
  focada: {
    emoji: "✨",
    label: "Energia Radiante",
    description: "Humor e energia em equilíbrio. Clareza mental acima da média.",
    tip: "Aproveite o pico para suas tarefas mais importantes antes das 14h.",
    chipLabel: "Focada",
  },
  tensa: {
    emoji: "😰",
    label: "Dia Tenso",
    description: "Tensão elevada detectada. Preste atenção ao seu ritmo.",
    tip: "Faça pausas curtas e evite decisões importantes agora.",
    chipLabel: "Tensa",
  },
  cansada: {
    emoji: "😴",
    label: "Dia Cansativo",
    description: "Energia baixa hoje. Respeite seu ritmo.",
    tip: "Se possível, inclua 20 min de descanso no seu planner hoje.",
    chipLabel: "Cansada",
  },
  sensivel: {
    emoji: "🌸",
    label: "Dia Sensível",
    description: "Energia pede cuidado extra. Sensibilidade elevada hoje.",
    tip: "Priorize autocuidado e evite decisões importantes agora.",
    chipLabel: "Delicado",
  },
  sobrecarregada: {
    emoji: "😤",
    label: "Dia Difícil",
    description: "Indicadores pedem descanso. Sobrecarga detectada.",
    tip: "Cancele o que puder e reserve espaço para recuperação.",
    chipLabel: "Intenso",
  },
};

// Ritmo de respiração do hero por fase (design emocional P1).
// Fases altas respiram mais vivas; baixas e turbulência, mais lentas —
// a Aura co-regula, não acompanha a aceleração.
const BREATHE_DURATION: Record<string, string> = {
  elevated: "3.6s",
  flowing: "3.8s",
  stable: "4.4s",
  recovering: "4.4s",
  falling: "5s",
  low: "5.6s",
  depleted: "6s",
  mixed: "6s",
  insufficient_data: "4.4s",
};

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {String(now.getHours()).padStart(2,"0")}:{String(now.getMinutes()).padStart(2,"0")}
      <span style={{ fontSize: "13px", opacity: 0.8 }}>:{String(now.getSeconds()).padStart(2,"0")}</span>
    </>
  );
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const l = useLocalizedCopy();
  const { state, addTask, addHabit, refreshData, setPendingFollowUp, setProactiveNudge, hydrated } = useAuraStore();
  const [phaseLegendOpen, setPhaseLegendOpen] = useState(false);
  const handlePullRefresh = useCallback(() => refreshData(), [refreshData]);
  const { containerRef, pullDistance, isRefreshing, isReady } = usePullToRefresh(handlePullRefresh);

  // Push notifications — get userId from supabase session
  const [pushUserId, setPushUserId] = useState<string | null>(null);
  const [hasLocalJournalEntry, setHasLocalJournalEntry] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPushUserId(session?.user?.id ?? null);
    });
  }, []);
  usePushNotifications(pushUserId);

  useEffect(() => {
    setHasLocalJournalEntry(window.localStorage.getItem("airia.journal.hasEntry") === "true");
  }, []);

  // Força re-render quando o relatório semanal é dispensado
  const [weeklyReportDismissed, setWeeklyReportDismissed] = useState(false);
  useEffect(() => {
    const handler = () => setWeeklyReportDismissed(prev => !prev);
    window.addEventListener("airia-weekly-dismissed", handler);
    return () => window.removeEventListener("airia-weekly-dismissed", handler);
  }, []);

  // Refresh on mount to pick up any check-ins done since the app loaded
  useEffect(() => { refreshData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const homeOpenedRef = useRef(false);
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [addedActionTitles, setAddedActionTitles] = useState<Set<string>>(new Set());
  const [addingActionTitle, setAddingActionTitle] = useState<string | null>(null);
  const [scheduleModalAction, setScheduleModalAction] = useState<HomeScheduleModalAction | null>(null);
  const [skippedActionTitles, setSkippedActionTitles] = useState<Set<string>>(new Set());
  const [homeChartMode, setHomeChartMode] = useState<HomeChartMode>("week");
  // Gráfico tátil (design emocional P3): dedo/cursor sobre o gráfico acende o ponto.
  const [chartFocusIdx, setChartFocusIdx] = useState<number | null>(null);
  useEffect(() => { setChartFocusIdx(null); }, [homeChartMode]);
  const [showHabitIdeasModal, setShowHabitIdeasModal] = useState(false);

  // Relógio e Contexto de Tempo (necessários para IDs e filtros)
  const [clockTime, setClockTime] = useState(() => new Date());
  const dayContext = useMemo(
    () => getClientDayContext(clockTime, resolveIntlLocale(i18n.language)),
    [
      clockTime.getFullYear(),
      clockTime.getMonth(),
      clockTime.getDate(),
      clockTime.getHours(),
      clockTime.getMinutes(),
      i18n.language,
    ],
  );
  const refreshBucket = useMemo(
    () => buildQuarterHourRefreshBucket(clockTime),
    [
      clockTime.getFullYear(),
      clockTime.getMonth(),
      clockTime.getDate(),
      clockTime.getHours(),
      clockTime.getMinutes(),
    ],
  );


  const rawMood = moodMap[state.mood] ?? moodMap.equilibrada;
  const moodLabelsEn: Record<string, string> = {
    equilibrada: "Balanced", focada: "Focused", tensa: "Tense", cansada: "Tired", sensivel: "Sensitive", sobrecarregada: "Overloaded",
  };
  const mood = { ...rawMood, label: l(rawMood.label, moodLabelsEn[state.mood] ?? "Balanced") };
  const habits = useMemo(
    () => (state.habits || []).filter((habit) => isHabitDueOnDate(habit, clockTime)),
    [clockTime, state.habits],
  );
  const activationState = useMemo(
    () => getActivationState(state, { hasLocalJournalEntry }),
    [hasLocalJournalEntry, state],
  );
  const showActivationHome = activationState.isNewUser && activationState.activationLevel !== "active";
  const aggregatedCheckinHistory = useMemo(
    () => aggregateCheckinsByDay(state.checkinHistory || []),
    [state.checkinHistory]
  );

  // ── Relatório semanal (domingo) ──────────────────────────
  const weeklyReport = useMemo(() => {
    const today = new Date();
    const weekday = today.getDay(); // 0 = domingo
    // Mostrar domingo (0) e segunda (1) até meio-dia
    const showOnMonday = weekday === 1 && today.getHours() < 13;
    if (weekday !== 0 && !showOnMonday) return null;

    const history = state.checkinHistory || [];
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const weekEntries = history.filter(h => {
      const ts = h.recordedAt ? new Date(h.recordedAt).getTime() : new Date(`${h.date}T12:00`).getTime();
      return ts >= sevenDaysAgo;
    });
    if (weekEntries.length < 3) return null;

    // Gerar chave da semana para dismissal
    const yr = today.getFullYear();
    const weekNum = Math.ceil((Math.floor((today.getTime() - new Date(yr, 0, 1).getTime()) / 86_400_000) + new Date(yr, 0, 1).getDay() + 1) / 7);
    const weekKey = `${yr}-W${weekNum}`;
    const dismissed = localStorage.getItem(`airia_weekly_report_dismissed_${weekKey}`) === "1";
    if (dismissed) return null;

    const avgMood = weekEntries.reduce((s, h) => s + h.humor, 0) / weekEntries.length;
    const avgEnergy = weekEntries.reduce((s, h) => s + h.energia, 0) / weekEntries.length;
    const sleepEntries = weekEntries.filter(h => (h as any).horasSono > 0);
    const avgSleep = sleepEntries.length > 0
      ? sleepEntries.reduce((s, h) => s + (h as any).horasSono, 0) / sleepEntries.length
      : null;

    // Fase dominante
    const phaseCounts: Record<string, number> = {};
    weekEntries.forEach(h => {
      const hp = (h as any).phase as string | undefined;
      if (hp) phaseCounts[hp] = (phaseCounts[hp] ?? 0) + 1;
    });
    const dominantPhase = Object.entries(phaseCounts).sort(([,a],[,b]) => b-a)[0]?.[0] ?? null;

    // Fator mais frequente
    const factorCounts: Record<string, number> = {};
    weekEntries.forEach(h => {
      ((h as any).factors ?? []).forEach((f: string) => {
        factorCounts[f] = (factorCounts[f] ?? 0) + 1;
      });
    });
    const topFactor = Object.entries(factorCounts).sort(([,a],[,b]) => b-a)[0]?.[0] ?? null;

    // Tendência: comparar primeira metade vs segunda metade da semana
    const half = Math.floor(weekEntries.length / 2);
    const sorted = [...weekEntries].sort((a,b) => a.date.localeCompare(b.date));
    const firstHalfAvg = sorted.slice(0, half).reduce((s,h) => s+h.humor, 0) / Math.max(half, 1);
    const secondHalfAvg = sorted.slice(half).reduce((s,h) => s+h.humor, 0) / Math.max(sorted.length - half, 1);
    const moodTrend: "up" | "down" | "stable" =
      secondHalfAvg - firstHalfAvg > 0.5 ? "up" :
      firstHalfAvg - secondHalfAvg > 0.5 ? "down" : "stable";

    return { weekKey, avgMood, avgEnergy, avgSleep, dominantPhase, topFactor, moodTrend, count: weekEntries.length };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.checkinHistory, weeklyReportDismissed]);

  // ── Motor de Ciclagem de Humor ────────────────────────────
  const cycleReport = useMemo(
    () => computeMoodCycle(aggregatedCheckinHistory),
    [aggregatedCheckinHistory]
  );
  // Ciclo menstrual — modulador secundário, nunca foco principal
  const menstrualReport = useMemo(
    () => computeMenstrualPhase({
      cycleStart: state.cycleStart,
      cycleLength: state.cycleLength,
      lutealLength: state.lutealLength,
    }),
    [state.cycleStart, state.cycleLength, state.lutealLength],
  );
  const moodCycleContextForAi = useMemo(() => {
    const parts = [cycleReport.aiContext];
    if (menstrualReport?.aiContext) parts.push(menstrualReport.aiContext);
    return parts.filter(Boolean).join(" · ");
  }, [cycleReport.aiContext, menstrualReport?.aiContext]);
  const daysSinceLastCheckin = useMemo(
    () => computeDaysSinceLastCheckin(aggregatedCheckinHistory, dayContext.localDate),
    [aggregatedCheckinHistory, dayContext.localDate],
  );
  const isCheckinReentry = (daysSinceLastCheckin ?? 0) >= REENTRY_GAP_DAYS;
  const phaseColor = getPhaseColor(cycleReport.phase);
  const currentPhaseLabel = cycleReport.phase !== "insufficient_data"
    ? t(`phases.${cycleReport.phase}.label`, cycleReport.phaseLabel)
    : cycleReport.phaseLabel;
  const moodForecast = useMemo(() => forecastMood7d(aggregatedCheckinHistory), [aggregatedCheckinHistory]);
  const energyForecast = useMemo(() => forecastEnergy7d(aggregatedCheckinHistory), [aggregatedCheckinHistory]);

  // Sync adaptive snapshot global — api.ts injeta em todo POST/PATCH/PUT pra Aura calibrar
  useEffect(() => {
    const forecastValues = Array.isArray(moodForecast) ? moodForecast.slice(0, 3) : [];
    const forecastSummary = forecastValues.length > 0
      ? `Mood próximos 3 dias: ${forecastValues.map((v) => (typeof v === "number" ? v.toFixed(1) : "-")).join(", ")}`
      : null;
    setAdaptiveSnapshot({
      phase: cycleReport.phase,
      warningFlags: cycleReport.warningFlags,
      forecast7dSummary: forecastSummary,
    });
  }, [cycleReport.phase, cycleReport.warningFlags, moodForecast]);
  const dailyPhaseMap = useMemo(() => computeDailyPhaseMap(aggregatedCheckinHistory, 400), [aggregatedCheckinHistory]);
  const todayDateKey = useMemo(() => getLocalDateKey(clockTime), [
    clockTime.getFullYear(),
    clockTime.getMonth(),
    clockTime.getDate(),
  ]);
  const monthlyWindow = useMemo(() => {
    const endDate = todayDateKey;
    const startDate = shiftDateKey(endDate, -29);
    return { startDate, endDate };
  }, [todayDateKey]);
  const monthlyWindowDailyHistory = useMemo(
    () => [...aggregatedCheckinHistory]
      .filter((entry) => entry.date >= monthlyWindow.startDate && entry.date <= monthlyWindow.endDate)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [aggregatedCheckinHistory, monthlyWindow.endDate, monthlyWindow.startDate],
  );
  const monthlyHistory = monthlyWindowDailyHistory;
  const monthlyPointPhaseMap = useMemo(() => {
    const out: Record<string, MoodPhase> = {};
    monthlyHistory.forEach((entry) => {
      out[entry.date] = dailyPhaseMap[entry.date] ?? phaseFromMoodValue(entry.humor);
    });
    return out;
  }, [dailyPhaseMap, monthlyHistory]);
  const goalTitles = useMemo(
    () => (state.goals || []).filter((goal) => goal.completedPct < 100).map((goal) => goal.title),
    [state.goals],
  );
  const pendingTaskTitles = useMemo(
    () => (state.tasks || []).filter((task) => !task.done).slice(0, 6).map((task) => task.title),
    [state.tasks],
  );
  const homeAgendaPreview = useMemo(
    () => buildHomeAgendaPreview({ tasks: state.tasks || [], habits, referenceDate: clockTime }),
    [clockTime, habits, state.tasks],
  );

  // ── Gráfico semanal — média diária dos últimos 7 dias ─────────────────────
  const weeklyCheckinData = useMemo<ChartPoint[]>(() => {
    const history = aggregatedCheckinHistory;
    const today = new Date();
    const X_START = 16, X_END = 264;
    const X_STEP = (X_END - X_START) / 6;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = getLocalDateKey(d);
      const weekdayLabel = d.toLocaleDateString(resolveIntlLocale(i18n.language), { weekday: "short" }).replace(".", "");
      const entry = history.find(h => h.date === dateStr);
      const x = X_START + i * X_STEP;
      if (!entry) return { x, humorY: null, energiaY: null, label: weekdayLabel, isHighlight: i === 6 };
      return {
        x,
        humorY: valueToChartY(entry.humor),
        energiaY: valueToChartY(entry.energia),
        label: weekdayLabel,
        phase: dailyPhaseMap[dateStr] ?? phaseFromMoodValue(entry.humor),
        isHighlight: i === 6,
      };
    });
  }, [aggregatedCheckinHistory, dailyPhaseMap, i18n.language]);

  const todayCheckinData = useMemo<ChartPoint[]>(() => {
    const todayEntries = [...(state.checkinHistory || [])]
      .filter((entry) => normalizeDateKey(entry.date) === dayContext.localDate)
      .sort((a, b) => getCheckinMoment(a) - getCheckinMoment(b));

    if (todayEntries.length === 0) return [];

    const X_START = 40;
    const X_END = 240;
    const step = todayEntries.length > 1 ? (X_END - X_START) / (todayEntries.length - 1) : 0;

    return todayEntries.map((entry, index) => ({
      x: todayEntries.length === 1 ? 140 : X_START + step * index,
      humorY: valueToChartY(entry.humor),
      energiaY: valueToChartY(entry.energia),
      label: formatCheckinMomentLabel(entry, resolveIntlLocale(i18n.language), {
        morning: t("home.momentMorning"),
        afternoon: t("home.momentAfternoon"),
        evening: t("home.momentEvening"),
        now: t("home.momentNow"),
      }),
      phase: cycleReport.phase !== "insufficient_data" ? cycleReport.phase : phaseFromMoodValue(entry.humor),
      isHighlight: index === todayEntries.length - 1,
    }));
  }, [cycleReport.phase, dayContext.localDate, i18n.language, state.checkinHistory, t]);

  // ── 1 ação principal por momento do dia ────────────────────────────────────
  const hasEveningCheckinToday = useMemo(
    () => (state.checkinHistory || []).some(
      (entry) => normalizeDateKey(entry.date) === dayContext.localDate && getCheckinMoment(entry) === 2,
    ),
    [dayContext.localDate, state.checkinHistory],
  );
  const primaryAction = useMemo(
    () => deriveHomePrimaryAction({
      hour: clockTime.getHours(),
      hasCheckinToday: todayCheckinData.length > 0,
      hasEveningCheckinToday,
      isReentry: isCheckinReentry,
      // Chave aplicada aqui, no chamador: deriveHomePrimaryAction e pura e tem
      // suite propria — contamina-la com estado de produto quebraria os testes.
      nextTask: FEATURES.planner && homeAgendaPreview.tasks[0]
        ? { title: homeAgendaPreview.tasks[0].title, time: homeAgendaPreview.tasks[0].time }
        : null,
      dueHabit: FEATURES.habits && homeAgendaPreview.habit
        ? { title: homeAgendaPreview.habit.title, icon: homeAgendaPreview.habit.icon }
        : null,
    }),
    [clockTime, hasEveningCheckinToday, homeAgendaPreview, isCheckinReentry, todayCheckinData.length],
  );

  // ── UI adaptativa por fase (Onda 3) ─────────────────────────────────────────
  const density = useMemo(() => resolveHomeDensity(cycleReport.phase), [cycleReport.phase]);

  // ── Today view: detalhes do dia colapsados por padrão (lembra a preferência) ──
  const DAY_DETAILS_KEY = "airia.home.dayDetailsOpen.v1";
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);
  useEffect(() => {
    try { setDayDetailsOpen(localStorage.getItem(DAY_DETAILS_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  function toggleDayDetails() {
    setDayDetailsOpen((open) => {
      const next = !open;
      try { localStorage.setItem(DAY_DETAILS_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // ── Primeiro insight após 7 dias — mostrado uma única vez ───────────────────
  const FIRST_INSIGHT_SEEN_KEY = "airia.firstInsight.seen.v1";
  const [firstInsightDismissed, setFirstInsightDismissed] = useState(false);
  useEffect(() => {
    try { setFirstInsightDismissed(localStorage.getItem(FIRST_INSIGHT_SEEN_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  const firstInsight = useMemo<FirstInsight | null>(
    () => (firstInsightDismissed ? null : computeFirstInsight(aggregatedCheckinHistory, dayContext.localDate)),
    [aggregatedCheckinHistory, dayContext.localDate, firstInsightDismissed],
  );
  function dismissFirstInsight() {
    try { localStorage.setItem(FIRST_INSIGHT_SEEN_KEY, "1"); } catch { /* ignore */ }
    setFirstInsightDismissed(true);
  }

  // ── Resumo semanal automático (domingo à noite / segunda) ───────────────────
  const WEEKLY_SUMMARY_DISMISS_KEY = "airia.weeklySummary.dismissedWeek.v1";
  const weekKey = useMemo(() => weekKeyOf(clockTime), [clockTime]);
  const [weeklySummary, setWeeklySummary] = useState<{ analysis: string; recommendation: string | null } | null>(null);
  const [weeklySummaryDismissed, setWeeklySummaryDismissed] = useState(true);
  useEffect(() => {
    try { setWeeklySummaryDismissed(localStorage.getItem(WEEKLY_SUMMARY_DISMISS_KEY) === weekKey); } catch { /* ignore */ }
  }, [weekKey]);
  const offerWeeklySummary = shouldOfferWeeklySummary(clockTime) && !weeklySummaryDismissed && cycleReport.phase !== "insufficient_data";
  useEffect(() => {
    if (!offerWeeklySummary || weeklySummary) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/insights/weekly") as { aiAnalysis?: string; recommendations?: Array<{ text?: string }> };
        if (cancelled) return;
        const analysis = (res?.aiAnalysis ?? "").trim();
        if (!analysis) return;
        setWeeklySummary({ analysis, recommendation: res?.recommendations?.[0]?.text?.trim() || null });
      } catch { /* silencioso: resumo é bônus, não bloqueia a home */ }
    })();
    return () => { cancelled = true; };
  }, [offerWeeklySummary, weeklySummary]);
  function dismissWeeklySummary() {
    try { localStorage.setItem(WEEKLY_SUMMARY_DISMISS_KEY, weekKey); } catch { /* ignore */ }
    setWeeklySummaryDismissed(true);
  }

  function buildSparkPath(points: ChartPoint[], getter: (p: ChartPoint) => number | null): string {
    const valid = points
      .map(p => ({ x: p.x, y: getter(p) }))
      .filter((p): p is { x: number; y: number } => p.y !== null);
    if (valid.length === 0) return "";
    if (valid.length === 1) return `M ${valid[0].x} ${valid[0].y}`;
    let path = `M ${valid[0].x} ${valid[0].y}`;
    for (let i = 1; i < valid.length; i++) {
      const prev = valid[i - 1], curr = valid[i];
      const cp = (curr.x - prev.x) * 0.45;
      path += ` C ${prev.x + cp} ${prev.y} ${curr.x - cp} ${curr.y} ${curr.x} ${curr.y}`;
    }
    return path;
  }

  const activeChartData = homeChartMode === "day" ? todayCheckinData : weeklyCheckinData;
  const hasActiveChartData = activeChartData.some(
    (point) => point.humorY !== null || point.energiaY !== null,
  );
  const homeChartSubtitle = (() => {
    if (homeChartMode === "monthly") return "Histórico — últimos 30 dias";
    if (homeChartMode === "forecast") return "Previsão — próximos 7 dias";
    if (homeChartMode === "day") {
      return todayCheckinData.length > 0
        ? `${todayCheckinData.length} check-in${todayCheckinData.length > 1 ? "s" : ""} hoje`
        : "Hoje ainda não há check-ins registrados";
    }
    return t("home.moodEnergyAvg");
  })();
  const advanceHomeChartMode = () => {
    const currentIndex = HOME_CHART_TABS.findIndex((tab) => tab.id === homeChartMode);
    const nextIndex = (currentIndex + 1) % HOME_CHART_TABS.length;
    setHomeChartMode(HOME_CHART_TABS[nextIndex].id);
  };

  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [homeAiMsg, setHomeAiMsg] = useState<HomeAiMsg | null>(null);
  const [homeAiLoading, setHomeAiLoading] = useState(true);
  const [autonomyExpanded, setAutonomyExpanded] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [homeAutonomyFeedbackTick, setHomeAutonomyFeedbackTick] = useState(0);
  const previousHomeAiMsgRef = useRef<HomeAiMsg | null>(null);
  const lastHomeAiRequestKeyRef = useRef<string | null>(null);
  const homeAutonomyBlockedTitles = useMemo(() => {
    const feedback = readHomeAutonomyFeedback();
    return [
      ...extractBlockedHomeAutonomyTitles(feedback),
      ...(state.tasks || []).filter((task) => task.done).map((task) => task.title),
      ...(state.habits || []).filter((habit) => (habit.completions || []).length > 0).map((habit) => habit.title),
      ...(state.goals || []).filter((goal) => goal.completedPct >= 100).map((goal) => goal.title),
      ...(state.goals || []).flatMap((goal) => goal.subtasks || []).filter((subgoal) => subgoal.done).map((subgoal) => subgoal.title),
    ].filter(Boolean);
  }, [homeAutonomyFeedbackTick, state.goals, state.habits, state.tasks]);
  const isHomeAutonomyActionBlocked = useCallback(
    (title: string) => isHomeAutonomyTitleBlocked(title, homeAutonomyBlockedTitles),
    [homeAutonomyBlockedTitles],
  );
  const recordHomeAutonomyFeedback = useCallback(
    (title: string, status: "done" | "dismissed" | "deleted" | "scheduled") => {
      rememberHomeAutonomyActionFeedback(title, status);
      void api.post("/ai/action-feedback", {
        title,
        status,
        surface: "home",
        sourceType: "stability-analysis",
        localDate: dayContext.localDate,
      }).catch(() => undefined);
      setHomeAutonomyFeedbackTick((value) => value + 1);
    },
    [dayContext.localDate],
  );
  const latestCheckinKey = useMemo(() => {
    const history = state.checkinHistory || [];
    if (history.length === 0) return null;
    const latest = history.reduce<{
      stamp: number;
      key: string;
    } | null>((acc, entry) => {
      const baseStamp = getCheckinMoment(entry);
      const stamp = Number.isFinite(baseStamp) ? baseStamp : 0;
      const key = entry.recordedAt || `${normalizeDateKey(entry.date)}:${entry.checkinSlot || "agora"}`;
      if (!acc || stamp > acc.stamp) return { stamp, key };
      if (stamp === acc.stamp && key > acc.key) return { stamp, key };
      return acc;
    }, null);
    return latest?.key ?? null;
  }, [state.checkinHistory]);
  const latestTodayCheckin = useMemo(() => {
    const todayEntries = [...(state.checkinHistory || [])]
      .filter((entry) => normalizeDateKey(entry.date) === dayContext.localDate)
      .sort((a, b) => getCheckinMoment(a) - getCheckinMoment(b));

    return todayEntries[todayEntries.length - 1] ?? null;
  }, [dayContext.localDate, state.checkinHistory]);
  const homeAiRequestKey = useMemo(
    () =>
      buildHomeAiRequestKey({
        localDate: dayContext.localDate,
        partOfDay: dayContext.partOfDay,
        mood: state.mood,
        taskCount: state.tasks.length,
        goalTitles,
        pendingTaskTitles,
        latestCheckinKey,
        refreshBucket,
      }),
    [
      dayContext.localDate,
      dayContext.partOfDay,
      goalTitles,
      latestCheckinKey,
      pendingTaskTitles,
      refreshBucket,
      state.mood,
      state.tasks.length,
    ],
  );

  useEffect(() => {
    if (!hydrated) return;

    postNativeWidgetSync(
      createNativeTodayWidgetPayload({
        stateLabel: latestTodayCheckin?.stateLabel,
        stateType: latestTodayCheckin?.stateLabelType ?? latestTodayCheckin?.emotion,
        moodScore: latestTodayCheckin?.humor,
        energyScore: latestTodayCheckin?.energia,
        updatedAt: latestTodayCheckin?.recordedAt ?? new Date().toISOString(),
        planner: (state.tasks || [])
          .filter((task) => !task.done)
          .sort((a, b) => a.time.localeCompare(b.time))
          .slice(0, 3)
          .map((task) => ({
            time: task.time,
            title: task.title,
          })),
      }),
    );
  }, [hydrated, latestTodayCheckin, state.tasks]);

  useEffect(() => {
    if (!hydrated) return;
    if (lastHomeAiRequestKeyRef.current === homeAiRequestKey) return;

    let cancelled = false;
    const previousHomeContext = extractHomeRepeatContext(previousHomeAiMsgRef.current);
    if (!homeAiMsg) {
      setHomeAiLoading(true);
    }

    const timer = setTimeout(async () => {
      try {
        const res: any = await api.post("/ai/suggest", {
          type: "home-messages",
          context: {
            mood: state.mood,
            moodLabel: mood.label,
            energia: state.energia,
            taskCount: state.tasks.length,
            pendingTaskTitles,
            goals: goalTitles,
            hour: dayContext.hour,
            partOfDay: dayContext.partOfDay,
            weekday: dayContext.weekday,
            localDate: dayContext.localDate,
            emotions: latestTodayCheckin?.emotions || [],
            factors: latestTodayCheckin?.factors || [],
            note: latestTodayCheckin?.note || "",
            sleepScore: latestTodayCheckin?.sono ?? null,
            bodyScore: latestTodayCheckin?.fisico ?? null,
            checkinHumor: latestTodayCheckin?.humor ?? null,
            checkinEnergy: latestTodayCheckin?.energia ?? null,
            moodCycleContext: moodCycleContextForAi,
            previousMotivacional: previousHomeContext.previousMotivacional,
            previousAutocuidado: previousHomeContext.previousAutocuidado,
            refreshBucket,
          },
        });
        const parsed = tryParseAiSuggestion<unknown>(res.suggestion);
        const normalizedMessage = normalizeHomeAiMessage(parsed);
        if (!cancelled && normalizedMessage) {
          previousHomeAiMsgRef.current = normalizedMessage;
          lastHomeAiRequestKeyRef.current = homeAiRequestKey;
          setHomeAiMsg(normalizedMessage);
        }
      } catch {
        /* IA indisponível — sem fallback estático */
      } finally {
        if (!cancelled) {
          setHomeAiLoading(false);
        }
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cycleReport.aiContext,
    dayContext.hour,
    dayContext.localDate,
    dayContext.partOfDay,
    dayContext.weekday,
    goalTitles,
    homeAiRequestKey,
    hydrated,
    latestTodayCheckin,
    mood.label,
    pendingTaskTitles,
    refreshBucket,
    state.energia,
    state.mood,
    state.tasks.length,
  ]);

  useEffect(() => {
    if (!hydrated || homeOpenedRef.current) return;
    homeOpenedRef.current = true;
    trackEvent("home_opened", {
      tasks_count: state.tasks.length,
      habits_count: (state.habits || []).length,
      checkins_count: (state.checkinHistory || []).length,
    });
  }, [hydrated, state.checkinHistory, state.habits, state.tasks.length]);

  // Mensagem motivacional — apenas IA
  const motivacionalFinal = homeAiMsg?.motivacional ?? null;
  // Task stats
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter(t => t.done).length;
  const pendingTasks = state.tasks.filter(t => !t.done).length;


  async function handleHabitSave(payload: HabitModalPayload) {
    try {
      await addHabit(payload);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel adicionar o habito.");
      return false;
    }
  }






  function openHomeScheduleModal(action: { title: string; category: string }) {
    const slot = findSmartPlannerSlot(state.tasks || [], new Date());
    const title = polishHomeActionTitle(action.title);
    setScheduleModalAction({
      title,
      category: action.category,
      date: slot.date,
      time: slot.time,
      isNextDay: slot.isNextDay,
    });
  }

  async function confirmHomeScheduleModal() {
    if (!scheduleModalAction || addingActionTitle) return;
    setAddingActionTitle(scheduleModalAction.title);
    try {
      const saved = await addTask(scheduleModalAction.title, scheduleModalAction.time, scheduleModalAction.category, {
        forceSave: true,
        date: scheduleModalAction.date,
      });
      if (!saved) throw new Error("A sugestao nao entrou no planner.");
      trackEvent("tasks_added_to_planner", {
        source: "home",
        item_count: 1,
        next_day: scheduleModalAction.isNextDay,
      });
      setAddedActionTitles((prev) => new Set([...prev, scheduleModalAction.title]));
      recordHomeAutonomyFeedback(scheduleModalAction.title, "scheduled");
      if (scheduleModalAction.isNextDay) {
        showSuccess(`Agendado para amanhã às ${scheduleModalAction.time}`);
      }
      const scheduledFor = new Date(`${scheduleModalAction.date}T${scheduleModalAction.time}:00`).toISOString();
      setPendingFollowUp({
        suggestionTitle: scheduleModalAction.title,
        suggestionCategory: scheduleModalAction.category,
        scheduledFor,
        response: null,
        followUpMessage: null,
        source: "autonomous",
      });
      setScheduleModalAction(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel salvar a sugestao no planner.");
    } finally {
      setAddingActionTitle(null);
    }
  }

  const importantAlerts = useMemo(() => {
    const alerts: ImportantAlert[] = [];
    const nowMinutes = clockTime.getHours() * 60 + clockTime.getMinutes();
    const overdueTasks = state.tasks.filter((task) => !task.done && timeToMinutes(task.time) + 45 < nowMinutes);
    const stagnantGoals = state.goals.filter((goal) => goal.completedPct === 0 && goal.subtasks.length > 0);
    const insightText = `${state.autonomousInsight?.pattern ?? ""} ${state.autonomousInsight?.insight ?? ""}`.toLowerCase();
    const hasCompulsionSignal = /(compuls|impuls|compra|comprando|gasto|excesso)/i.test(insightText);

    if (overdueTasks.length > 0) {
      const firstTask = overdueTasks[0];
      alerts.push({
        key: "overdue-tasks",
        title: overdueTasks.length === 1 ? "Um compromisso ficou para trás" : `${overdueTasks.length} compromissos ficaram para trás`,
        description:
          overdueTasks.length === 1
            ? `"${firstTask.title}" já passou do horário e ainda está pendente.`
            : `Existem ${overdueTasks.length} itens do planner fora do horário hoje. Vale reorganizar antes que virem peso acumulado.`,
        evidence:
          overdueTasks.length === 1
            ? `Base: "${firstTask.title}" estava marcado para ${firstTask.time} e ainda não foi concluído.`
            : `Base: ${overdueTasks.length} itens com horário vencido e status pendente no Planner de hoje.`,
        tone: overdueTasks.length >= 3 ? "critical" : "warning",
        actionLabel: "Montar meu dia",
        actionPath: "/planner",
      });
    }

    if (stagnantGoals.length > 0) {
      alerts.push({
        key: "stagnant-goals",
        title: stagnantGoals.length === 1 ? "Uma meta está parada" : `${stagnantGoals.length} metas estão paradas`,
        description:
          stagnantGoals.length === 1
            ? `"${stagnantGoals[0].title}" ainda não saiu do lugar, mesmo já tendo próximos passos definidos.`
            : "Há metas com próximos passos definidos, mas sem avanço real. Talvez seja hora de reduzir o escopo ou destravar a primeira ação.",
        evidence:
          stagnantGoals.length === 1
            ? `Base: a meta "${stagnantGoals[0].title}" tem ${stagnantGoals[0].subtasks.length} próxima(s) ação(ões) e progresso 0%.`
            : `Base: ${stagnantGoals.length} metas ativas têm próximas ações e progresso 0%.`,
        tone: "warning",
        actionLabel: "Ver metas",
        actionPath: "/goals",
      });
    }

    const moodIsActivelyPositive = ["recovering", "stable", "flowing", "elevated"].includes(cycleReport.phase) || cycleReport.trend7d > 0.4;
    if (!moodIsActivelyPositive && (cycleReport.warningFlags.includes("sustained_low") || cycleReport.warningFlags.includes("rapid_drop") || cycleReport.stabilityScore <= 35)) {
      const sustainedLow = cycleReport.warningFlags.includes("sustained_low");
      const rapidDrop = cycleReport.warningFlags.includes("rapid_drop");
      alerts.push({
        key: "mood-risk",
        title: sustainedLow
          ? `Seu padrão pessoal entrou em ${currentPhaseLabel.toLowerCase()} há ${cycleReport.daysInPhase} ${cycleReport.daysInPhase !== 1 ? "dias" : "dia"}`
          : rapidDrop
            ? `Desvio brusco do seu padrão pessoal — fase ${currentPhaseLabel}`
            : `Estabilidade baixa — fase ${currentPhaseLabel}`,
        description: sustainedLow
          ? "O EWMA individual ficou abaixo do baseline pessoal por vários registros. Vale registrar isso no diário e diminuir a carga de hoje."
          : rapidDrop
            ? "A mudança nas últimas 48h saiu da sua linha de base. Proteja energia e leia com mais cuidado o que está pesando agora."
            : "Seu padrão entrou em zona de atenção. Quanto antes você reduzir atrito, menor a chance de afundar o resto da semana.",
        evidence: `Base: baseline pessoal ${cycleReport.baselineComposite.toFixed(1)}/10, EWMA atual ${cycleReport.currentComposite.toFixed(1)}/10, estabilidade ${cycleReport.stabilityScore}/100 e sinal(is): ${cycleReport.warningFlags.join(", ") || "estabilidade baixa"}.`,
        tone: sustainedLow || cycleReport.stabilityScore <= 30 ? "critical" : "warning",
        actionLabel: "Abrir meu diário",
        actionPath: "/journal",
      });
    }

    if (hasCompulsionSignal) {
      alerts.push({
        key: "compulsion-signal",
        title: "A Airia percebeu sinal de impulso ou compulsão",
        description: "O padrão recente sugere comportamento mais automático do que o normal. Vale pausar estímulos e nomear isso no diário antes de agir.",
        evidence: `Base: ${evidenceExcerpt(state.autonomousInsight?.pattern || state.autonomousInsight?.insight || "")}`,
        tone: "critical",
        actionLabel: "Registrar agora",
        actionPath: "/journal",
      });
    }

    return alerts.slice(0, 4);
  }, [
    clockTime,
    currentPhaseLabel,
    cycleReport.daysInPhase,
    cycleReport.phase,
    cycleReport.stabilityScore,
    cycleReport.trend7d,
    cycleReport.warningFlags,
    state.autonomousInsight?.insight,
    state.autonomousInsight?.pattern,
    state.goals,
    state.tasks,
  ]);
  const displayName = state.name
    ? state.name.split(/\s+/)[0].charAt(0).toUpperCase() + state.name.split(/\s+/)[0].slice(1).toLowerCase()
    : "você";
  const quickAccessSection = (
    <>
            <p className="aura-section-kicker">{t("home.quickAccess")}</p>
      <div className="shortcut-grid">
        <button className="shortcut-card" onClick={() => navigate("/journal")}>
          <div className="icon-badge shortcut-icon shortcut-icon-journal">
            <MessageSquareText size={18} color="var(--terracotta)" />
          </div>
          <span className="shortcut-label">{t("nav.journal")}</span>
          <span className="shortcut-sub">{t("home.talkToAi")}</span>
        </button>
        {FEATURES.planner && (
          <button className="shortcut-card" onClick={() => navigate("/planner")}>
            <div className="icon-badge shortcut-icon shortcut-icon-planner">
              <LayoutDashboard size={18} color="var(--horizon)" />
            </div>
            <span className="shortcut-label">Planner</span>
            <span className="shortcut-sub">{t("home.organize")}</span>
          </button>
        )}
        <button className="shortcut-card" onClick={() => navigate("/daily-summary")}>
          <div className="icon-badge" style={{ background: "rgba(197,165,147,.16)" }}>
            <ClipboardCheck size={18} color="var(--accent-peach)" />
          </div>
          <span className="shortcut-label">{t("home.closeDay")}</span>
                    <span className="shortcut-sub">{t("home.tomorrow")}</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/insights")}>
          <div className="icon-badge shortcut-icon shortcut-icon-insights">
            <Activity size={18} color="var(--atomic-tangerine)" />
          </div>
                    <span className="shortcut-label">{t("nav.insights")}</span>
          <span className="shortcut-sub">{t("home.harmony")}</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/goals")}>
          <div className="icon-badge shortcut-icon shortcut-icon-goals">
            <Target size={18} color="var(--sweet-mint)" />
          </div>
          <span className="shortcut-label">{t("home.objectives")}</span>
                    <span className="shortcut-sub">{t("home.yourGoals")}</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/pomodoro")}>
          <div className="icon-badge shortcut-icon shortcut-icon-pomodoro">
            <Timer size={18} color="var(--terracotta)" />
          </div>
          <span className="shortcut-label">Pomodoro</span>
          <span className="shortcut-sub">{t("home.focus")}</span>
        </button>
        {FEATURES.habits && (
          <button className="shortcut-card" onClick={() => navigate("/habits")}>
            <div className="icon-badge" style={{ background: "rgba(150,199,179,.18)" }}>
              <Sparkles size={18} color="var(--accent-sage)" />
            </div>
            <span className="shortcut-label">{t("home.habits")}</span>
            <span className="shortcut-sub">{t("home.rituals")}</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
    <FirstRunGuide activation={activationState} userId={pushUserId} />
    {scheduleModalAction && (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(17,24,39,.24)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          width: "min(100%, 360px)",
          borderRadius: 22,
          background: "rgba(255,253,249,.98)",
          border: "1px solid var(--warm-border)",
          boxShadow: "0 24px 60px rgba(17,24,39,.18)",
          padding: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach)" }}>
                {t("home.scheduleSuggestion")}
              </p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.35 }}>
                {t("home.markFor", { when: scheduleModalAction.date === dayContext.localDate ? t("common.today").toLocaleLowerCase(i18n.language) : t("home.thisDate"), time: scheduleModalAction.time })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScheduleModalAction(null)}
              style={{ border: "none", background: "transparent", color: "var(--text-3)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              aria-label={t("home.closeModal")}
            >
              ×
            </button>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            {scheduleModalAction.title}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 112px", gap: 8, marginBottom: 14 }}>
            <input
              type="date"
              value={scheduleModalAction.date}
              onChange={(event) => setScheduleModalAction((current) => current ? { ...current, date: event.target.value, isNextDay: event.target.value !== dayContext.localDate } : current)}
              style={{ height: 40, borderRadius: 12, padding: "0 10px", fontSize: 12, fontWeight: 700 }}
            />
            <input
              type="time"
              value={scheduleModalAction.time}
              onChange={(event) => setScheduleModalAction((current) => current ? { ...current, time: event.target.value } : current)}
              style={{ height: 40, borderRadius: 12, padding: "0 10px", fontSize: 12, fontWeight: 700 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setScheduleModalAction(null)}
              style={{ flex: 1, height: 40, borderRadius: 12, border: "1px solid var(--warm-border-2)", background: "transparent", color: "var(--text-2)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
            >
              {t("common.no")}
            </button>
            <button
              type="button"
              onClick={() => void confirmHomeScheduleModal()}
              disabled={addingActionTitle === scheduleModalAction.title}
              style={{ flex: 1, height: 40, borderRadius: 12, border: "none", background: "var(--accent-peach)", color: "#fff", fontSize: 12, fontWeight: 900, cursor: addingActionTitle === scheduleModalAction.title ? "default" : "pointer", opacity: addingActionTitle === scheduleModalAction.title ? 0.7 : 1 }}
            >
              {addingActionTitle === scheduleModalAction.title ? t("home.saving") : t("common.yes")}
            </button>
          </div>
        </div>
      </div>
    )}
    <div ref={containerRef as React.RefObject<HTMLDivElement>} style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)", position: "relative", WebkitOverflowScrolling: "touch" }}>
      {/* Watermark híbrida — logo da Airia quase transparente */}
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 0 }}>
        <AiriaLogoBg size={420} opacity={0.055} />
      </div>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className={`pull-indicator${isReady ? " ready" : ""}`} style={{ height: isRefreshing ? 44 : pullDistance, overflow: "hidden" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.54" />
          </svg>
          {isRefreshing ? t("home.updating") : isReady ? t("home.releaseRefresh") : t("home.pullRefresh")}
        </div>
      )}
      <div className="screen-content" style={{ position: "relative", zIndex: 1 }}>

        {/* Header com relógio */}
        <div className="home-header" style={{ position: "relative", paddingBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p className="home-header-eyebrow">
                {getGreetingEmoji(clockTime.getHours())} {t(getGreetingKey(clockTime.getHours()))},
              </p>
              <h1 style={{ marginBottom: 4 }}>{displayName}</h1>
              <p style={{ fontSize: "11px", color: "var(--text-2)", margin: 0 }}>
                {dayContext.dateWithWeekdayLabel}
              </p>
            </div>
            {/* Config (gear) + Relógio */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate("/preferences")}
                    aria-label={t("home.settingsAria")}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.76)",
                  border: "1px solid rgba(17,24,39,.05)",
                  boxShadow: "0 10px 18px rgba(17,24,39,.05)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-2)",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10.91 3H11a2 2 0 1 1 4 0h.09a1.65 1.65 0 0 0 1.51 1h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21 10.91V11a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </button>
              {/* Relógio */}
              <div style={{
                background: "rgba(255,255,255,.76)",
                borderRadius: "16px",
                padding: "10px 14px",
                textAlign: "center",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(17,24,39,.05)",
                boxShadow: "0 10px 18px rgba(17,24,39,.05)",
                minWidth: 90,
              }}>
                <p style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "var(--text-1)",
                  margin: 0,
                  lineHeight: 1,
                  letterSpacing: "1px",
                }}>
                  <LiveClock />
                </p>
              </div>
            </div>
          </div>
          {/* Hero de fase — o centro da today view. Respira no ritmo da fase:
              fases altas = respiração mais viva; fases baixas/turbulência =
              respiração lenta (co-regulação, nunca excitação). */}
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <div
              className="aura-breathe"
              style={{
                width: 76, height: 76, borderRadius: "50%",
                background: "rgba(255,255,255,.80)",
                border: `2px solid ${phaseColor}`,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, marginBottom: 12,
                boxShadow: "0 10px 22px rgba(17,24,39,.05)",
                ["--breathe-dur" as string]: BREATHE_DURATION[cycleReport.phase] ?? "4.4s",
                ["--breathe-glow" as string]: `${phaseColor}38`,
              }}
            >
              {cycleReport.phaseEmoji}
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.2 }}>
              {currentPhaseLabel}
            </p>
            <p style={{ margin: "8px auto 0", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 250 }}>
              {t(`phases.${cycleReport.phase}.tip`, PHASE_CONFIG[cycleReport.phase]?.tip ?? l("Airia organiza seu dia respeitando seu humor e energia.", "Airia organizes your day around your mood and energy."))}
            </p>
            {menstrualReport && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12,
                background: "rgba(247,230,230,.55)",
                border: "1px solid rgba(184,109,124,.12)",
                borderRadius: 999, padding: "4px 10px",
                opacity: 0.88,
              }}
              title={`Ciclo menstrual: ${menstrualReport.label} · dia ${menstrualReport.dayOfCycle}/${menstrualReport.cycleLength}`}
              >
                <span style={{ fontSize: 11 }}>{menstrualReport.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#8B5B68", letterSpacing: ".01em" }}>
                  {menstrualReport.label} · d{menstrualReport.dayOfCycle}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Momentum sem cobrança (design emocional P2): 14 dias, dias com
            registro acendem na cor da fase; dias vazios ficam neutros —
            ausência é dado, nunca dívida. ── */}
        {(() => {
          const registered = new Set(aggregatedCheckinHistory.map((entry) => entry.date));
          const days = Array.from({ length: 14 }, (_, i) => shiftDateKey(todayDateKey, i - 13));
          const count = days.filter((d) => registered.has(d)).length;
          if (count === 0) return null;
          return (
            <div style={{ margin: "14px 2px 4px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {days.map((d) => {
                  const has = registered.has(d);
                  const isToday = d === todayDateKey;
                  return (
                    <span
                      key={d}
                      title={d}
                      style={{
                        width: isToday ? 8 : 6,
                        height: isToday ? 8 : 6,
                        borderRadius: "50%",
                        background: has ? phaseColor : "transparent",
                        border: has ? "none" : "1.5px solid rgba(17,24,39,.12)",
                        opacity: has ? 0.9 : 1,
                        transition: "background .3s",
                      }}
                    />
                  );
                })}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--text-3)", fontWeight: 600, letterSpacing: ".02em" }}>
                {l(
                  `Seu ritmo se construindo — ${count} ${count === 1 ? "registro" : "registros"} em 14 dias`,
                  `Your rhythm taking shape — ${count} ${count === 1 ? "entry" : "entries"} in 14 days`,
                )}
              </p>
            </div>
          );
        })()}

        {/* Nível, XP e sequência. Só o que já aconteceu — sem meta diária, sem
            aviso de sequência em risco, sem comparação com ontem. */}
        <div style={{ margin: "0 0 12px" }}>
          <ProgressStrip />
        </div>

        <JornadaHomeCard />

        {/* Ação principal do momento — 1 só, conforme hora do dia e estado real */}
        {primaryAction && !showActivationHome && (
          <>
            <button
              type="button"
              onClick={() => navigate(primaryAction.route)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                minHeight: density.primaryActionMinHeight,
                padding: "15px 16px",
                marginBottom: density.toneNote ? 8 : "calc(var(--a) * 1.1)",
                borderRadius: 16,
                border: "1.5px solid rgba(215,137,127,0.35)",
                background: "rgba(215,137,127,0.08)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{primaryAction.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "var(--accent-peach-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {primaryAction.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
                    {primaryAction.subtitle}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 18, color: "var(--accent-peach)", fontWeight: 800, flexShrink: 0, marginLeft: 8 }}>→</span>
            </button>
            {density.toneNote && (
              <p style={{ margin: "0 0 calc(var(--a) * 1.1)", fontSize: 11, color: "var(--text-3)", lineHeight: 1.4, paddingLeft: 4 }}>
                {density.toneNote}
              </p>
            )}
          </>
        )}

        {/* ── Primeiro insight (após 7 dias) — momento "isso funciona" ── */}
        {firstInsight && (
          <Card accent="sage" style={{ marginBottom: "calc(var(--a) * 1.1)" }}>
            <SectionTitle
              eyebrow={l("Primeiro padrão que a Airia notou", "The first pattern Airia noticed")}
              accent="sage"
              icon="🔎"
              action={
                <button
                  type="button"
                  onClick={dismissFirstInsight}
                  aria-label="Dispensar insight"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}
                >
                  ×
                </button>
              }
            />
            <p style={{ margin: "8px 0 4px", fontSize: 15, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.3 }}>
              {firstInsight.headline}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>
              {firstInsight.detail}
            </p>
          </Card>
        )}

        {/* ── Resumo semanal automático (domingo à noite / segunda) ── */}
        {offerWeeklySummary && weeklySummary && (
          <Card accent="sky" style={{ marginBottom: "calc(var(--a) * 1.1)" }}>
            <SectionTitle
              eyebrow={l("Sua semana, em 1 leitura", "Your week in one reading")}
              accent="sky"
              icon="🗓️"
              action={
                <button
                  type="button"
                  onClick={dismissWeeklySummary}
                  aria-label="Dispensar resumo"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}
                >
                  ×
                </button>
              }
            />
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
              {weeklySummary.analysis}
            </p>
            {weeklySummary.recommendation && (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55, fontWeight: 600 }}>
                ↳ {weeklySummary.recommendation}
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate("/insights")}
              style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", color: "var(--accent-sky)", fontSize: 12.5, fontWeight: 800, padding: 0 }}
            >
              Ver detalhes da semana →
            </button>
          </Card>
        )}

        {showActivationHome && (
          <div
            className="aura-card"
            style={{
              marginBottom: "calc(var(--a) * 1.1)",
              padding: 16,
              borderRadius: 22,
              border: "1.5px solid rgba(244,190,168,.28)",
              background: "rgba(255,253,249,.94)",
            }}
          >
            <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach-ink)" }}>
              Comece por aqui
            </p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "var(--text-1)", lineHeight: 1.25 }}>
              {activationState.nextAction.title}
            </h2>
            <p style={{ margin: "0 0 13px", fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>
              {activationState.nextAction.description}
            </p>
            <ActivationChecklist activation={activationState} />
            <AuraButtonV2
              variant="primary"
              size="md"
              onClick={() => navigate(activationState.nextAction.route)}
              style={{ width: "100%", minHeight: 44, marginTop: 12 }}
            >
              {activationState.nextAction.label}
            </AuraButtonV2>
          </div>
        )}

        {/* ── Ver meu dia — detalhes colapsados (today view) ── */}
        <button
          type="button"
          onClick={toggleDayDetails}
          aria-expanded={dayDetailsOpen}
          style={{
            width: "100%",
            marginTop: 4,
            marginBottom: dayDetailsOpen ? "calc(var(--a))" : 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--text-3)",
            fontSize: 13,
            fontWeight: 700,
            padding: "14px 0",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {dayDetailsOpen ? "Recolher" : "Ver meu dia"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dayDetailsOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {dayDetailsOpen && (<>

        {/* ── Gráfico de check-ins ── */}
        <div className="mini-chart-area" style={showActivationHome && activationState.checkinCount === 0 ? { padding: 12 } : undefined}>
          <div className="chart-header" style={{ alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <TrendingUp size={13} color="var(--horizon)" />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="chart-title">Humor e energia</span>
                  {homeChartMode === "forecast" && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--text-3)",
                      background: "rgba(255,255,255,.72)",
                      border: "1px solid var(--warm-border)",
                      borderRadius: 999,
                      padding: "2px 7px",
                      lineHeight: 1.2,
                    }}>
                      {t("home.forecast")}
                    </span>
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--text-3)" }}>
                  {homeChartSubtitle}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" }}>
              <div style={{ display: "flex", padding: 3, borderRadius: 999, background: "rgba(255,255,255,.82)", border: "1px solid var(--warm-border)" }}>
                {HOME_CHART_TABS.map((option) => {
                  const active = homeChartMode === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setHomeChartMode(option.id)}
                      style={{
                        border: "none",
                        background: active ? "var(--accent-peach)" : "transparent",
                        color: active ? "#fff" : "var(--text-2)",
                        borderRadius: 999,
                        padding: "5px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={advanceHomeChartMode}
                    aria-label={t("home.nextChartAria")}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: "1px solid var(--warm-border)",
                  background: "rgba(255,255,255,.72)",
                  color: "var(--text-3)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <ChevronRight size={14} />
              </button>
              <div className="chart-legend">
                <div className="legend-item">
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--horizon)",
                      display: "inline-block",
                    }}
                  />
                  Humor
                </div>
                <div className="legend-item">
                  <span
                    style={{
                      width: "10px",
                      height: "2px",
                      background: "var(--buttercup)",
                      opacity: 0.6,
                      display: "inline-block",
                    }}
                  />
                  Energia
                </div>
              </div>
            </div>
          </div>

          {(homeChartMode === "week" || homeChartMode === "day") && (
            !hasActiveChartData ? (
              <div style={{
                height: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                color: "var(--text-3)", fontSize: "0.82rem",
              }}>
                <span style={{ fontSize: 20 }}>{homeChartMode === "day" ? "🌅" : "📊"}</span>
                <span style={{ fontStyle: "italic" }}>
                  {homeChartMode === "day"
                    ? l("Isso aparece depois do check-in de hoje.", "This appears after today's check-in.")
                    : l("Isso aparece depois do seu primeiro check-in.", "This appears after your first check-in.")}
                </span>
              </div>
            ) : (
              <>
                <svg
                  width="100%"
                  viewBox="0 0 280 72"
                  style={{ overflow: "visible", touchAction: "pan-y" }}
                  onPointerMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const xView = ((event.clientX - rect.left) / rect.width) * 280;
                    let best: number | null = null;
                    let bestDist = Infinity;
                    activeChartData.forEach((point, index) => {
                      if (point.humorY === null) return;
                      const dist = Math.abs(point.x - xView);
                      if (dist < bestDist) { bestDist = dist; best = index; }
                    });
                    setChartFocusIdx(best);
                  }}
                  onPointerLeave={() => setChartFocusIdx(null)}
                >
                  <defs>
                    <linearGradient id="moodLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--horizon)" />
                      <stop offset="50%" stopColor="var(--sweet-mint)" />
                      <stop offset="100%" stopColor="var(--atomic-tangerine)" />
                    </linearGradient>
                    <linearGradient id="moodFillGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--horizon)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--horizon)" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  {[12, 29, 46, 63].map(y => (
                    <line key={y} x1="16" y1={y} x2="264" y2={y} stroke="rgba(0,0,0,.04)" strokeWidth="1" strokeDasharray="3,3" />
                  ))}

                  {buildSparkPath(activeChartData, (point) => point.energiaY) && (
                    <path
                      d={buildSparkPath(activeChartData, (point) => point.energiaY)}
                      fill="none"
                      stroke="var(--olive)"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      opacity={0.5}
                      strokeLinecap="round"
                    />
                  )}

                  {buildSparkPath(activeChartData, (point) => point.humorY) && (
                    <>
                      <path
                        d={buildSparkPath(activeChartData, (point) => point.humorY)}
                        fill="none"
                        stroke="url(#moodLineGradient)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {(() => {
                        const linePath = buildSparkPath(activeChartData, (point) => point.humorY);
                        const validPts = activeChartData.filter((point) => point.humorY !== null);
                        if (validPts.length < 2) return null;
                        const first = validPts[0];
                        const last = validPts[validPts.length - 1];
                        return (
                          <path
                            d={`${linePath} L ${last.x} 72 L ${first.x} 72 Z`}
                            fill="url(#moodFillGradient)"
                            opacity={0.35}
                          />
                        );
                      })()}
                    </>
                  )}

                  {activeChartData.map((point, index) => {
                    if (point.humorY === null) return null;
                    return point.isHighlight ? (
                      <g key={index}>
                        <circle cx={point.x} cy={point.humorY} r="4.5" fill="var(--atomic-tangerine)" stroke="white" strokeWidth="2" />
                        <circle cx={point.x} cy={point.humorY} r="9" fill="none" stroke="var(--atomic-tangerine)" strokeWidth="1.5" opacity={0.35}>
                          <animate attributeName="r" values="9;14;9" dur="2.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values=".4;0;.4" dur="2.5s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    ) : (
                      <circle key={index} cx={point.x} cy={point.humorY} r="3.5" fill="var(--horizon)" stroke="white" strokeWidth="1.5" opacity={0.75} />
                    );
                  })}

                  {/* Brilho tátil no ponto sob o dedo (Revolut-style, discreto) */}
                  {chartFocusIdx !== null && activeChartData[chartFocusIdx]?.humorY != null && (() => {
                    const focusPoint = activeChartData[chartFocusIdx];
                    return (
                      <g pointerEvents="none">
                        <circle cx={focusPoint.x} cy={focusPoint.humorY!} r="11" fill={phaseColor} opacity={0.16} />
                        <circle cx={focusPoint.x} cy={focusPoint.humorY!} r="5" fill="white" stroke={phaseColor} strokeWidth="2" />
                        {focusPoint.energiaY !== null && (
                          <circle cx={focusPoint.x} cy={focusPoint.energiaY} r="4" fill="var(--olive)" opacity={0.55} />
                        )}
                      </g>
                    );
                  })()}
                </svg>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, paddingInline: 6 }}>
                  {activeChartData.map((point, index) => (
                    <div key={`${point.label}-${index}`} style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: point.isHighlight || chartFocusIdx === index ? 700 : 500, color: chartFocusIdx === index ? phaseColor : point.isHighlight ? "var(--text-1)" : "var(--text-3)", transition: "color .15s" }}>
                        {point.label}
                      </span>
                      {point.phase && (
                        <span style={{ display: "block", marginTop: 1, fontSize: 10, lineHeight: 1 }}>
                          {PHASE_CONFIG[point.phase].emoji}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )
          )}

          {homeChartMode === "monthly" && (() => {
            if (monthlyHistory.length === 0) {
              return (
                <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 20 }}>📊</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>Isso aparece depois de alguns check-ins.</span>
                </div>
              );
            }

            const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
            const MW = 300, MH = 140, MPX = 22, MPY = 14, MBOT = 38;
            const mh = MH - MPY - MBOT;
            const n = monthlyHistory.length;
            const mxToX = (i: number) => MPX + (n > 1 ? (i / (n - 1)) : 0.5) * (MW - MPX * 2);
            const mVals = monthlyHistory.map(e => e.humor);
            const eVals = monthlyHistory.map(e => e.energia);
            const combinedVals = [...mVals, ...eVals];
            const mRawMin = Math.min(...combinedVals), mRawMax = Math.max(...combinedVals);
            const moodRawMin = Math.min(...mVals), moodRawMax = Math.max(...mVals);
            const mPad = Math.max(0.6, (mRawMax - mRawMin) * 0.25);
            const mMin = Math.max(1, mRawMin - mPad), mMax = Math.min(10, mRawMax + mPad);
            const mRange = mMax - mMin || 1;
            const mToY = (v: number) => MPY + mh - ((v - mMin) / mRange) * mh;

            const mLine = monthlyHistory.reduce((acc, e, i) => {
              const x = mxToX(i), y = mToY(e.humor);
              if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
              const px = mxToX(i - 1), py = mToY(monthlyHistory[i - 1].humor);
              const cp = (x - px) * 0.45;
              return `${acc} C${(px + cp).toFixed(1)} ${py.toFixed(1)} ${(x - cp).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }, '');
            const mEnergyLine = monthlyHistory.reduce((acc, e, i) => {
              const x = mxToX(i), y = mToY(e.energia);
              if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
              const px = mxToX(i - 1), py = mToY(monthlyHistory[i - 1].energia);
              const cp = (x - px) * 0.45;
              return `${acc} C${(px + cp).toFixed(1)} ${py.toFixed(1)} ${(x - cp).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }, '');
            const mArea = mLine
              + ` L${mxToX(n - 1).toFixed(1)} ${(MPY + mh).toFixed(1)} L${mxToX(0).toFixed(1)} ${(MPY + mh).toFixed(1)} Z`;

            const maxIdx = mVals.indexOf(moodRawMax);
            const minIdx = mVals.indexOf(moodRawMin);
            const lastIdx = n - 1;
            const keyIdxs = new Set([maxIdx, minIdx, lastIdx]);
            const tickStep = Math.max(1, Math.floor(n / 5));
            const tickIdxs = Array.from({ length: n }, (_, i) => i).filter(i => i % tickStep === 0 || i === lastIdx);

            return (
              <>
                <svg width="100%" viewBox={`0 0 ${MW} ${MH}`} style={{ overflow: "visible", display: "block" }}>
                  {[0.2, 0.5, 0.8].map(pct => {
                    const v = mMin + pct * mRange;
                    return <line key={pct} x1={MPX} x2={MW - MPX} y1={mToY(v)} y2={mToY(v)}
                      stroke="rgba(0,0,0,.055)" strokeWidth={0.7} strokeDasharray="3,3" />;
                  })}
                  <path d={mArea} fill="rgba(150,199,179,.09)" />
                  <path d={mEnergyLine} fill="none" stroke="var(--olive)" strokeWidth="1.5" strokeDasharray="4,3" opacity={0.5} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={mLine} fill="none" stroke="var(--accent-sage)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />

                  {monthlyHistory.map((e, i) => {
                    const x = mxToX(i), y = mToY(e.humor);
                    const isKey = keyIdxs.has(i);
                    const phase: MoodPhase = monthlyPointPhaseMap[e.date] ?? phaseFromMoodValue(e.humor);
                    const dotColor = PHASE_CONFIG[phase].color;
                    return (
                      <circle key={i} cx={x} cy={y} r={isKey ? 0 : 2.5}
                        fill={dotColor} stroke="white" strokeWidth={isKey ? 0 : 1} opacity={0.85} />
                    );
                  })}

                  {monthlyHistory.map((e, i) => {
                    if (!keyIdxs.has(i)) return null;
                    const x = mxToX(i), y = mToY(e.humor);
                    const phase: MoodPhase = monthlyPointPhaseMap[e.date] ?? phaseFromMoodValue(e.humor);
                    const emoji = getMoodFaceEmoji(e.humor);
                    const scoreColor = PHASE_CONFIG[phase].color;
                    return (
                      <g key={`key-${i}`}>
                        <text x={x} y={y + 6} textAnchor="middle" fontSize={15} style={{ userSelect: "none" }}>{emoji}</text>
                        <text x={x} y={y + 20} textAnchor="middle" fontSize={8.5} fill={scoreColor}
                          fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{e.humor.toFixed(1)}</text>
                      </g>
                    );
                  })}

                  {tickIdxs.map(i => {
                    const x = mxToX(i);
                    const dt = new Date(monthlyHistory[i].date + "T12:00:00");
                    const phase = monthlyPointPhaseMap[monthlyHistory[i].date] ?? phaseFromMoodValue(monthlyHistory[i].humor);
                    const primaryLabel = String(dt.getDate());
                    const secondaryLabel = DAY_NAMES[dt.getDay()];
                    return (
                      <g key={`tick-${i}`}>
                        <text x={x} y={MH - 23} textAnchor="middle" fontSize={8.5} fill="var(--text-2)"
                          fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{primaryLabel}</text>
                        <text x={x} y={MH - 13} textAnchor="middle" fontSize={7} fill="var(--text-3)"
                          fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">{secondaryLabel}</text>
                        <text x={x} y={MH - 1} textAnchor="middle" fontSize={10} style={{ userSelect: "none" }}>{PHASE_CONFIG[phase].emoji}</text>
                      </g>
                    );
                  })}
                </svg>

                {(() => {
                  // Conta fases visíveis no período mensal
                  const phaseCounts = new Map<MoodPhase, number>();
                  monthlyHistory.forEach(e => {
                    const ph = monthlyPointPhaseMap[e.date] ?? phaseFromMoodValue(e.humor);
                    phaseCounts.set(ph, (phaseCounts.get(ph) ?? 0) + 1);
                  });
                  const topPhases = Array.from(phaseCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([p]) => p);
                  return (
                    <div style={{
                      display: "flex",
                      gap: 4,
                      marginTop: 9,
                      justifyContent: "center",
                      flexWrap: "wrap",
                      padding: "5px 6px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,.62)",
                      border: "1px solid rgba(74,59,55,.06)",
                    }}>
                      {topPhases.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPhaseLegendOpen(true)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: 9.5, color: PHASE_CONFIG[p].color, fontWeight: 800,
                            background: "transparent",
                            border: "none",
                            padding: "2px 4px", borderRadius: 999,
                            cursor: "pointer",
                            fontFamily: "var(--font-sans, sans-serif)",
                          }}
                        >
                          {PHASE_CONFIG[p].emoji} {t(`phases.${p}.label`, PHASE_CONFIG[p].label)}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <p style={{ fontSize: 10, color: "var(--text-3)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  {monthlyWindowDailyHistory.length} check-in{monthlyWindowDailyHistory.length !== 1 ? "s" : ""} · carinhas por humor, fase abaixo da data
                </p>
              </>
            );
          })()}

          {homeChartMode === "forecast" && (() => {
            if (moodForecast.length !== 7 || energyForecast.length !== 7) {
              return (
                <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 20 }}>📈</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", textAlign: "center" }}>
                    {t("home.forecastNeedsCheckins")}
                  </span>
                </div>
              );
            }

            const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
            const today = new Date();
            const W = 300, H = 140, PX = 22, PY = 14;
            const BOTTOM_RESERVE = 44;
            const h = H - PY - BOTTOM_RESERVE;
            const combinedVals = [...moodForecast, ...energyForecast];
            const rawMin = Math.min(...combinedVals);
            const rawMax = Math.max(...combinedVals);
            const padding = Math.max(0.6, (rawMax - rawMin) * 0.3);
            const scaleMin = Math.max(1, rawMin - padding);
            const scaleMax = Math.min(10, rawMax + padding);
            const range = scaleMax - scaleMin || 1;
            const toX = (i: number) => PX + (i / 6) * (W - PX * 2);
            const toY = (v: number) => PY + h - ((v - scaleMin) / range) * h;

            const areaPath = moodForecast.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')
              + ` L${toX(6).toFixed(1)} ${(PY + h).toFixed(1)} L${toX(0).toFixed(1)} ${(PY + h).toFixed(1)} Z`;
            const linePath = moodForecast.reduce((acc, v, i) => {
              const x = toX(i), y = toY(v);
              if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
              const px = toX(i - 1), py = toY(moodForecast[i - 1]);
              const cp = (x - px) * 0.45;
              return `${acc} C${(px + cp).toFixed(1)} ${py.toFixed(1)} ${(x - cp).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }, '');
            const energyLinePath = energyForecast.reduce((acc, v, i) => {
              const x = toX(i), y = toY(v);
              if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
              const px = toX(i - 1), py = toY(energyForecast[i - 1]);
              const cp = (x - px) * 0.45;
              return `${acc} C${(px + cp).toFixed(1)} ${py.toFixed(1)} ${(x - cp).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }, '');

            return (
              <>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
                  {[0.2, 0.5, 0.8].map(pct => {
                    const v = scaleMin + pct * range;
                    return <line key={pct} x1={PX} x2={W - PX} y1={toY(v)} y2={toY(v)}
                      stroke="rgba(0,0,0,.055)" strokeWidth={0.7} strokeDasharray="3,3" />;
                  })}
                  <path d={areaPath} fill="rgba(99,152,169,.08)" />
                  <path d={energyLinePath} fill="none" stroke="var(--olive)" strokeWidth="1.5" strokeDasharray="4,3" opacity={0.5} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={linePath} fill="none" stroke="rgba(99,152,169,.45)" strokeWidth={2} strokeDasharray="6,3" strokeLinecap="round" strokeLinejoin="round" />
                  {moodForecast.map((val, i) => {
                    const x = toX(i), y = toY(val);
                    const d = new Date(today); d.setDate(today.getDate() + i + 1);
                    const dayName = DAY_NAMES[d.getDay()];
                    const phase = phaseFromMoodValue(val);
                    const emoji = getMoodFaceEmoji(val);
                    const scoreColor = PHASE_CONFIG[phase].color;
                    const midY = PY + h / 2;
                    const labelsAbove = y > midY;
                    const emojiY = labelsAbove ? y - 18 : y + 6;
                    const scoreY = labelsAbove ? y - 5 : y + 20;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r={3} fill={scoreColor} opacity={0.8} />
                        <text x={x} y={emojiY} textAnchor="middle" fontSize={13} style={{ userSelect: "none" }}>{emoji}</text>
                        <text x={x} y={scoreY} textAnchor="middle" fontSize={8.5} fill={scoreColor}
                          fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{val.toFixed(1)}</text>
                        <text x={x} y={H - 23} textAnchor="middle" fontSize={8.5} fill="var(--text-2)"
                          fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{d.getDate()}</text>
                        <text x={x} y={H - 13} textAnchor="middle" fontSize={7} fill="var(--text-3)"
                          fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">{dayName}</text>
                        <text x={x} y={H - 1} textAnchor="middle" fontSize={10} style={{ userSelect: "none" }}>{PHASE_CONFIG[phase].emoji}</text>
                      </g>
                    );
                  })}
                </svg>
                {(() => {
                  const phaseCounts = new Map<MoodPhase, number>();
                  moodForecast.forEach(v => {
                    const ph = phaseFromMoodValue(v);
                    phaseCounts.set(ph, (phaseCounts.get(ph) ?? 0) + 1);
                  });
                  const topPhases = Array.from(phaseCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([p]) => p);
                  return (
                    <div style={{
                      display: "flex",
                      gap: 4,
                      marginTop: 10,
                      justifyContent: "center",
                      flexWrap: "wrap",
                      padding: "5px 6px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,.62)",
                      border: "1px solid rgba(74,59,55,.06)",
                    }}>
                      {topPhases.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPhaseLegendOpen(true)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: 9.5, color: PHASE_CONFIG[p].color, fontWeight: 800,
                            background: "transparent",
                            border: "none",
                            padding: "2px 4px", borderRadius: 999,
                            cursor: "pointer",
                            fontFamily: "var(--font-sans, sans-serif)",
                          }}
                        >
                          {PHASE_CONFIG[p].emoji} {t(`phases.${p}.label`, PHASE_CONFIG[p].label)}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <p style={{ fontSize: 10, color: "var(--text-3)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  {t("home.patternPrecision")}
                </p>
              </>
            );
          })()}

          <div className="aura-divider" style={{ marginTop: "14px" }} />
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "center" }}>
            <AuraButtonV2
              variant="primary"
              size="md"
              onClick={() => navigate("/checkin")}
              leftIcon={
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "22px", height: "22px", background: "rgba(255,255,255,0.25)",
                  borderRadius: "50%", boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  fontSize: "12px", marginRight: "4px"
                }}>
                  😊
                </span>
              }
            >
              Check-in
            </AuraButtonV2>
          </div>
        </div>

        {/* ── Objetivo em foco + demais objetivos ──
            Substituiu a agenda por blocos (585 linhas de Planner). A pergunta
            que a Home responde deixou de ser "o que tenho hoje" e passou a ser
            "o que eu faço agora". ── */}
        <GoalFocusCard />

        {/* ── Presença sem cobrança ── */}
        {(state.checkinHistory || []).length > 0 && (
          <PresenceCard checkinHistory={state.checkinHistory || []} />
        )}

        {/* ── Sugestão por meta quando agenda vazia ── */}
        <GoalNudgeCard
          goals={state.goals || []}
          tasks={state.tasks || []}
          onAddTask={(title) => addTask(title, "09:00", "geral")}
        />

        {quickAccessSection}

        {/* ── Banner de notificação contextual ── */}
        <NotificationPromptBanner
          userId={pushUserId}
          checkinCount={(state.checkinHistory || []).length}
        />

        {/* ── Card compacto: Ritmo + Autonomia ── */}
        {(() => {
          const ins = state.autonomousInsight;
          const hasInsight = Boolean(ins);
          const cfg = hasInsight ? (STATE_CONFIG[ins!.state] ?? STATE_CONFIG.stable) : STATE_CONFIG.stable;
          const score = hasInsight ? ins!.stabilityScore : cycleReport.stabilityScore;
          const isUrgent = hasInsight && score < 40;
          const visibleActions = hasInsight
            ? ins!.actions.filter(
                a => !skippedActionTitles.has(a.title) && !addedActionTitles.has(a.title) && !isHomeAutonomyActionBlocked(a.title)
              )
            : [];
          const primaryAction = visibleActions[0] ?? null;
          const hasCycleData = cycleReport.phase !== "insufficient_data";
          const rhythmCopy = hasInsight
            ? ins!.insight
            : hasCycleData
              ? t(`phases.${cycleReport.phase}.tip`, cycleReport.phaseTip)
              : l("Faça um check-in para a Airia calibrar seu ritmo de hoje.", "Do a check-in so Airia can calibrate today's rhythm.");

          return (
            <div className="home-cycle-card" style={{ border: `1.5px solid ${isUrgent ? cfg.color : phaseColor}33`, marginBottom: "calc(var(--a) * 1.1)" }}>
              <div className="home-cycle-rail" style={{ background: isUrgent ? cfg.color : phaseColor }} />
              <div className="home-cycle-content">
                <div className="home-cycle-header" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="home-cycle-kicker">{t("home.rhythmToday")}</span>
                    <div className="home-cycle-phase" style={{ marginTop: 8, marginBottom: 0 }}>
                      <span className="home-cycle-emoji">{hasCycleData ? cycleReport.phaseEmoji : mood.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <p className="home-cycle-title" style={{ margin: 0 }}>
                          {hasCycleData
                            ? l(`${cycleReport.daysInPhase} dia${cycleReport.daysInPhase !== 1 ? "s" : ""} nesta fase`, `${cycleReport.daysInPhase} ${cycleReport.daysInPhase === 1 ? "day" : "days"} in this phase`)
                            : l("Ainda calibrando", "Still calibrating")}
                        </p>
                        {/* Quando check-in de hoje difere da fase de ciclo, mostra contexto */}
                        {hasCycleData && latestTodayCheckin && (
                          <p style={{ fontSize: 10, color: "var(--text-3)", margin: "2px 0 0", lineHeight: 1.4 }}>
                            {cycleReport.phase === "mixed"
                              ? l(`Check-in hoje: ${mood.emoji} ${mood.label} · padrão reflete 14 dias`, `Today's check-in: ${mood.emoji} ${mood.label} · pattern reflects 14 days`)
                              : l(`Check-in hoje: ${mood.emoji} ${mood.label}`, `Today's check-in: ${mood.emoji} ${mood.label}`)}
                          </p>
                        )}
                        {!hasCycleData && (
                          <p className="home-cycle-subtitle">
                            {l("A Home fica mais precisa depois do primeiro check-in", "Home becomes more accurate after your first check-in")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className="home-cycle-score" style={{ background: `${isUrgent ? cfg.color : phaseColor}18`, color: isUrgent ? cfg.color : phaseColor }}>
                      {l(formatStabilityStatus(score), `Stability ${score >= 80 ? "very high" : score >= 60 ? "moderate" : score >= 40 ? "low" : score >= 20 ? "very low" : "critical"} · ${score}/100`)}
                    </span>
                    <button
                      type="button"
                      className="home-touch-button"
                      onClick={() => setAutonomyExpanded(!autonomyExpanded)}
                      aria-label={autonomyExpanded ? l("Recolher detalhes do ritmo", "Collapse rhythm details") : l("Ver detalhes do ritmo", "View rhythm details")}
                      title={autonomyExpanded ? l("Recolher detalhes", "Collapse details") : l("Ver detalhes", "View details")}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        border: `1px solid ${(isUrgent ? cfg.color : phaseColor)}33`,
                        background: "rgba(255,255,255,.72)",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--text-3)"
                        strokeWidth="2"
                        style={{ transform: autonomyExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .18s ease" }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="home-cycle-copy" style={{ marginTop: 10 }}>
                  {rhythmCopy}
                </p>

                {isUrgent && (
                  <div className="home-cycle-warning">
                    <p className="home-cycle-warning-text">
                      {t("home.stabilityWarning")}
                    </p>
                  </div>
                )}

                {primaryAction ? (
                  <AuraButtonV2
                    variant="primary"
                    size="md"
                    onClick={() => openHomeScheduleModal(primaryAction)}
                    style={{ width: "100%", minHeight: 44, marginTop: 12 }}
                  >
                    Transformar em bloco no Planner
                  </AuraButtonV2>
                ) : (
                  <AuraButtonV2
                    variant="outline"
                    size="md"
                    onClick={() => navigate(hasCycleData ? "/insights" : "/checkin")}
                    style={{ width: "100%", minHeight: 44, marginTop: 12 }}
                  >
                    {hasCycleData ? l("Ver padrões", "View patterns") : l("Fazer check-in", "Do a check-in")}
                  </AuraButtonV2>
                )}

                {autonomyExpanded && (
                  <div className="home-ai-card-body" style={{ padding: "12px 0 0" }}>
                    {hasCycleData && (
                      <div className="home-cycle-metrics" style={{ marginBottom: 10 }}>
                        {[
                          { label: "Humor 7d", val: cycleReport.avgMood7d, color: "var(--accent-sage)" },
                          { label: "Energia 7d", val: cycleReport.avgEnergy7d, color: "var(--accent-sky)" },
                          ...(cycleReport.avgSleep7d ? [{ label: "Sono 7d", val: cycleReport.avgSleep7d, color: "var(--accent-peach)" }] : []),
                        ].map(m => (
                          <div key={m.label} className="home-cycle-metric">
                            <p className="home-cycle-metric-label">{m.label}</p>
                            <div className="home-cycle-metric-track">
                              <div className="home-cycle-metric-fill" style={{ background: m.color, width: `${Math.min(100, (m.val / 10) * 100)}%` }} />
                            </div>
                            <p className="home-cycle-metric-value" style={{ color: m.color }}>{m.val.toFixed(1)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {hasInsight && ins!.pattern && (
                      <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, margin: "0 0 10px" }}>
                        {ins!.pattern}
                      </p>
                    )}

                    {visibleActions.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                          {t("home.nextMoves")}
                        </p>
                        {visibleActions.slice(0, 2).map((action) => {
                          const isAdding = addingActionTitle === action.title;
                          const routeState = buildGoalSuggestionRouteState(`${action.title} ${action.why}`, state.goals || []);
                          return (
                            <div key={action.title} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 10px", borderRadius: 10,
                              background: "rgba(255,255,255,.62)",
                              border: `1px solid ${cfg.color}30`,
                            }}>
                              <div
                                style={{ flex: 1, minWidth: 0, cursor: routeState ? "pointer" : "default" }}
                                onClick={() => routeState && navigate("/goals", { state: routeState })}
                              >
                                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{polishHomeActionTitle(action.title)}</p>
                                <p style={{ fontSize: 10, color: "var(--text-3)", margin: "1px 0 0" }}>{action.category} · {action.why}</p>
                              </div>
                              <button
                                className="home-touch-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!isAdding) openHomeScheduleModal(action);
                                }}
                                disabled={isAdding}
              aria-label={t("home.addToPlanner")}
              title={t("home.addToPlanner")}
                              >
                                {isAdding ? "..." : "+"}
                              </button>
                              <button
                                className="home-touch-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  recordHomeAutonomyFeedback(action.title, "done");
                                  setAddedActionTitles(prev => new Set([...prev, action.title]));
                                }}
                                aria-label="Marcar como cumprido"
                                title="Marcar como cumprido"
                              >
                                ✓
                              </button>
                              <button
                                className="home-touch-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  recordHomeAutonomyFeedback(action.title, "dismissed");
                                  const remaining = ins!.actions.filter(
                                    a => !skippedActionTitles.has(a.title) && !addedActionTitles.has(a.title) && !isHomeAutonomyActionBlocked(a.title) && a.title !== action.title
                                  );
                                  if (remaining.length === 0) {
                                    setSkippedActionTitles(new Set());
                                  } else {
                                    setSkippedActionTitles(prev => new Set([...prev, action.title]));
                                  }
                                }}
              aria-label={t("home.replaceSuggestion")}
              title={t("home.replaceSuggestion")}
                              >
                                ↻
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Relatório semanal (domingo / segunda cedo) ────────── */}
        {weeklyReport && (() => {
          const { weekKey, avgMood, avgEnergy, avgSleep, dominantPhase, topFactor, moodTrend, count } = weeklyReport;
          const PHASE_LABEL: Record<string, string> = {
            "voo-alto": "Voo Alto", "fluindo": "Fluindo", "estavel": "Estável",
            "desacelerando": "Desacelerando", "recolhimento": "Recolhimento",
            "pausa": "Pausa", "retomada": "Retomada", "turbulencia": "Turbulência",
          };
          const FACTOR_LABEL: Record<string, string> = {
            exercicio: "Exercício", sono_bom: "Sono bom", meditacao: "Meditação",
            alimentacao: "Alimentação", social: "Convívio social", trabalho_intenso: "Trabalho intenso",
            conflito: "Conflito", ciclo: "Ciclo", cansaco: "Cansaço", ansiedade: "Ansiedade",
          };
          const trendIcon = moodTrend === "up" ? "📈" : moodTrend === "down" ? "📉" : "➡️";
          const trendText = moodTrend === "up" ? "humor subiu" : moodTrend === "down" ? "humor caiu" : "humor estável";
          return (
            <div style={{
              background: "linear-gradient(135deg, rgba(150,199,179,0.12) 0%, rgba(200,180,210,0.08) 100%)",
              border: "1.5px solid rgba(150,199,179,0.35)",
              borderLeft: "4px solid var(--accent-sage, #96c7b3)",
              borderRadius: 16, padding: "14px 16px", marginBottom: 12,
              boxShadow: "0 4px 16px rgba(150,199,179,0.1)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-1)", margin: "0 0 2px" }}>
                    {t("home.weeklySummary")}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
                    {count} check-ins registrados
                  </p>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem(`airia_weekly_report_dismissed_${weekKey}`, "1");
                    // force re-render via state trick — navigate then back would work, but simpler:
                    window.dispatchEvent(new Event("airia-weekly-dismissed"));
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2 }}
                >✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 2px" }}>{t("home.averageMood")}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
                    {avgMood.toFixed(1)}<span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>/10</span>
                    {" "}{trendIcon}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", margin: "1px 0 0" }}>{trendText}</p>
                </div>
                <div>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 2px" }}>{t("home.averageEnergy")}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
                    {avgEnergy.toFixed(1)}<span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>/10</span>
                  </p>
                </div>
                {dominantPhase && (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 2px" }}>Fase dominante</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                      {PHASE_LABEL[dominantPhase] ?? dominantPhase}
                    </p>
                  </div>
                )}
                {avgSleep !== null && (
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 2px" }}>{t("home.averageSleep")}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                      {avgSleep.toFixed(1)}h
                    </p>
                  </div>
                )}
              </div>
              {topFactor && (
                <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(150,199,179,0.1)", borderRadius: 10 }}>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 2px" }}>Fator mais presente</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                    {FACTOR_LABEL[topFactor] ?? topFactor}
                  </p>
                </div>
              )}
              <button
                onClick={() => navigate("/insights")}
                style={{
                  marginTop: 12, display: "block", width: "100%", padding: "8px 0",
                  background: "rgba(150,199,179,0.2)", border: "1px solid rgba(150,199,179,0.3)",
                  borderRadius: 10, fontSize: 12, fontWeight: 600, color: "var(--accent-sage, #96c7b3)",
                  cursor: "pointer",
                }}
              >
                {t("home.fullPatterns")}
              </button>
            </div>
          );
        })()}

        {/* ── Nudge proativo da Airia ──────────────────────────── */}
        {state.proactiveNudge && (() => {
          const nudge = state.proactiveNudge!;
          const colorMap = {
            checkin_missing: "#F3B08C",
            goal_stagnant:   "var(--accent-sky)",
            inbox_overdue:   "var(--accent-sage)",
            weekly_review:   "var(--accent-sage)",
            phase_warning:   "var(--accent-peach)",
          };
          const color = colorMap[nudge.type] ?? "#F3B08C";
          return (
            <div style={{
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              background: "rgba(255,255,255,0.65)",
              border: `1.5px solid ${color}40`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 16, padding: "12px 14px", marginBottom: 12,
              boxShadow: `0 4px 16px ${color}18`,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-1)", margin: "0 0 3px" }}>
                    {nudge.title}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 10px", lineHeight: 1.5 }}>
                    {nudge.message}
                  </p>
                  {nudge.action && (
                    <AuraButtonV2
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (nudge.type === "weekly_review") {
                          localStorage.setItem("aura_last_weekly_review", new Date().toISOString());
                        }
                        dismissProactiveNudgeForToday(nudge);
                        setProactiveNudge(null);
                        navigate(nudge.action!.path);
                      }}
                      style={{ borderRadius: 10 }}
                    >
                      {nudge.action.label}
                    </AuraButtonV2>
                  )}
                </div>
                <button
                  onClick={() => {
                    dismissProactiveNudgeForToday(nudge);
                    setProactiveNudge(null);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Como está seu dia? — card de pressão, oculto em fase baixa ── */}
        {!density.hidePressureCards && (
        <div className="aura-card" style={{ marginBottom: "calc(var(--a))", padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>♡</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-peach-ink)", margin: 0 }}>{t("home.howIsYourDay")}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Stat label={t("home.todayTasks")} value={t("home.planned", { count: totalTasks })} accent="sky" />
            <div style={{ height: 1, background: "var(--warm-border)" }} />
                <Stat label={t("home.completed")} value={`${doneTasks} ✓`} accent="sage" />
            <div style={{ height: 1, background: "var(--warm-border)" }} />
            <Stat label="Em andamento" value={pendingTasks} accent="peach" />
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(197,165,147,.06)", borderRadius: 10, border: "1px solid var(--accent-peach-a5)" }}>
            {homeAiLoading ? (
              <>
                <div style={{ height: 10, width: "40%", background: "var(--accent-peach-a3)", borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 9, width: "90%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
                <div style={{ height: 9, width: "70%", background: "rgba(0,0,0,.05)", borderRadius: 5 }} />
              </>
            ) : motivacionalFinal ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-peach-ink)", margin: 0 }}>{t("home.auraSays")}</p>
                  <span style={{ fontSize: 9, background: "var(--accent-peach-a3)", color: "var(--accent-peach-ink)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>{motivacionalFinal}</p>
              </>
            ) : (
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, fontStyle: "italic", textAlign: "center" }}>
                {t("home.personalizedAfterCheckin")}
              </p>
            )}
          </div>
        </div>
        )}

        {/* ── Alertas Importantes ── */}
        {importantAlerts.filter(a => !dismissedAlerts.has(a.key)).length > 0 && (
          <Card surface="panel" style={{ border: "1.5px solid rgba(161,140,120,.3)" }}>
            <div className="home-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="home-panel-title" style={{ color: "var(--earth-11)" }}>
                  {t("home.alertsTitle")}
                </p>
              </div>
            </div>
            <div className="home-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {importantAlerts.filter(a => !dismissedAlerts.has(a.key)).map((alert) => {
                const cfg = IMPORTANT_ALERT_CONFIG[alert.tone];
                return (
                  <div
                    key={alert.key}
                    className="home-soft-row"
                    style={{
                      alignItems: "flex-start",
                      gap: 10,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      padding: "11px 12px",
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: cfg.accent, margin: "0 0 4px" }}>{alert.title}</p>
                      <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{alert.description}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-3)", margin: "5px 0 0", lineHeight: 1.45, fontWeight: 650 }}>
                        {alert.evidence}
                      </p>
                      {alert.actionPath && alert.actionLabel && (
                        <button
                          onClick={() => navigate(alert.actionPath!)}
                          style={{
                            marginTop: 8,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            color: cfg.accent,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {alert.actionLabel} →
                        </button>
                      )}
                    </div>
                    <button
                      className="home-touch-button"
                      type="button"
                      onClick={() => {
                        setDismissedAlerts(prev => new Set([...prev, alert.key]));
                      }}
                      title="Dismissar alerta"
                      style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                        marginLeft: "auto",
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        </>)}

      </div>
      {showHabitIdeasModal && (
        <HabitIdeasModal
          onClose={() => setShowHabitIdeasModal(false)}
          onSave={handleHabitSave}
          onViewAll={() => {
            setShowHabitIdeasModal(false);
            navigate("/habits");
          }}
        />
      )}
      <PhaseLegendSheet
        open={phaseLegendOpen}
        onClose={() => setPhaseLegendOpen(false)}
        currentPhase={cycleReport.phase}
      />
    </div>
    </>
  );
}
