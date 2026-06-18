// Home Page v4 — babá digital IA + mensagens personalizadas + agenda por blocos
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
import { parseAiSuggestion, tryParseAiSuggestion } from "../lib/ai";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { PhaseLegendSheet } from "../components/PhaseLegendSheet";
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
import { buildGoalSuggestionRouteState } from "../utils/goal-suggestion-routing";
import { buildGoalPriorityActions, markStoredGtdActionDone } from "../utils/goal-priority-actions";
import { createNativeTodayWidgetPayload, postNativeWidgetSync } from "../utils/native-shell";
import { dismissProactiveNudgeForToday } from "../utils/proactive-nudge-dismissal";
import {
  type AgendaBlock,
  type HomeAiMsg,
  buildHomeAgendaPreview,
  buildHomeAiRequestKey,
  buildQuarterHourRefreshBucket,
  dedupeAgendaBlocks,
  deriveHomePrimaryAction,
  extractAgendaRepeatContext,
  extractBlockedHomeAutonomyTitles,
  extractHomeRepeatContext,
  isHomeAutonomyTitleBlocked,
  readHomeAutonomyFeedback,
  rememberHomeAutonomyActionFeedback,
  resolveGroundedHomeCare,
  resolveHomeAgendaSuggestionDate,
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
import { AuraIcon, AiriaLogoBg } from "../components/AuraIcon";
import { ActivationChecklist } from "../components/activation/ActivationChecklist";
import { FirstRunGuide } from "../components/activation/FirstRunGuide";
import { getActivationState } from "../features/aura/activation";
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

const BLOCK_CONFIG: Record<string, { cor: string; bg: string; emoji: string | React.ReactNode; category: string }> = {
  trabalho:     { cor: "var(--accent-sky)",    bg: "rgba(176,180,196,.10)",    emoji: "💼", category: "trabalho" },
  autocuidado:  { cor: "var(--accent-sage)",   bg: "rgba(180,185,169,.10)",   emoji: "🌿", category: "autocuidado" },
  casa:         { cor: "var(--accent-peach)", bg: "rgba(197,165,147,.10)",  emoji: "🏠", category: "rotina" },
  social:       { cor: "var(--social-color)", bg: "rgba(217,206,197,.10)", emoji: "🤝", category: "social" },
  descanso:     { cor: "var(--accent-sage)",   bg: "rgba(180,185,169,.08)",   emoji: "😴", category: "autocuidado" },
  refeicao:     { cor: "var(--accent-peach)", bg: "rgba(197,165,147,.08)", emoji: "🍽️", category: "rotina" },
  flexivel:     { cor: "var(--accent-sky)",   bg: "rgba(176,180,196,.08)",    emoji: <AuraIcon size={13} />, category: "pessoal" },
};

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
function minutesToTime(m: number) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function eventDateTimeToTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function mapExternalCalendarBusyWindows(events: unknown[]): Array<{ title: string; startTime: string; endTime: string; source: "gcal" }> {
  return events
    .filter((event): event is { summary?: unknown; start?: { dateTime?: unknown }; end?: { dateTime?: unknown } } => !!event && typeof event === "object")
    .map((event) => {
      const startTime = eventDateTimeToTime(event.start?.dateTime);
      const endTime = eventDateTimeToTime(event.end?.dateTime);
      if (!startTime || !endTime) return null;
      return {
        title: typeof event.summary === "string" ? event.summary : "Google Agenda",
        startTime,
        endTime,
        source: "gcal" as const,
      };
    })
    .filter((window): window is { title: string; startTime: string; endTime: string; source: "gcal" } => window !== null);
}

function agendaTaskKey(blockIndex: number, taskIndex: number) {
  return `${blockIndex}:${taskIndex}`;
}

function buildAgendaSelection(blocks: AgendaBlock[]) {
  const selected = new Set<string>();

  blocks.forEach((block, blockIndex) => {
    const isSkip = block.tipo === "descanso" || block.tipo === "refeicao";
    if (isSkip) return;
    block.tarefas_sugeridas.forEach((_, taskIndex) => {
      selected.add(agendaTaskKey(blockIndex, taskIndex));
    });
  });

  return selected;
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

function formatCheckinMomentLabel(entry: { recordedAt?: string; checkinSlot?: string }) {
  if (entry.recordedAt) {
    const stamp = new Date(entry.recordedAt);
    if (!Number.isNaN(stamp.getTime())) {
      return stamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
  }

  if (entry.checkinSlot?.startsWith("morning")) return "Manhã";
  if (entry.checkinSlot?.startsWith("midday")) return "Tarde";
  if (entry.checkinSlot?.startsWith("evening")) return "Noite";
  return "Agora";
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

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function getFormattedDate(d: Date) {
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_NOME[d.getMonth()]}`;
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
  const { t } = useTranslation();
  const { state, addTask, addHabit, refreshData, toggleTask, removeTask, toggleHabit, toggleSubGoal, archiveHabit, setPendingFollowUp, setProactiveNudge, hydrated } = useAuraStore();
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

  // Refresh on mount to pick up any check-ins done since the app loaded
  useEffect(() => { refreshData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const homeOpenedRef = useRef(false);
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [addedActionTitles, setAddedActionTitles] = useState<Set<string>>(new Set());
  const [addingActionTitle, setAddingActionTitle] = useState<string | null>(null);
  const [scheduleModalAction, setScheduleModalAction] = useState<HomeScheduleModalAction | null>(null);
  const [skippedActionTitles, setSkippedActionTitles] = useState<Set<string>>(new Set());
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string | number>>(new Set());
  const [homeChartMode, setHomeChartMode] = useState<HomeChartMode>("week");
  const [showHabitIdeasModal, setShowHabitIdeasModal] = useState(false);
  const [expandedAgendaRows, setExpandedAgendaRows] = useState<Set<string>>(new Set());

  // Relógio e Contexto de Tempo (necessários para IDs e filtros)
  const [clockTime, setClockTime] = useState(() => new Date());
  const dayContext = useMemo(
    () => getClientDayContext(clockTime),
    [
      clockTime.getFullYear(),
      clockTime.getMonth(),
      clockTime.getDate(),
      clockTime.getHours(),
      clockTime.getMinutes(),
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

  // Agenda por blocos
  const [agendaPhase, setAgendaPhase] = useState<"idle" | "loading" | "preview" | "approved">("idle");
  const [agendaBlocks, setAgendaBlocks] = useState<AgendaBlock[]>([]);
  const [selectedAgendaTaskKeys, setSelectedAgendaTaskKeys] = useState<Set<string>>(new Set());
  const [savedAgendaTaskKeys, setSavedAgendaTaskKeys] = useState<Set<string>>(new Set());
  const [agendaSaving, setAgendaSaving] = useState(false);
  const [goalActionTick, setGoalActionTick] = useState(0);
  const agendaRequestCountRef = useRef(0);

  const mood = moodMap[state.mood] ?? moodMap.equilibrada;
  const habits = state.habits || [];
  const activationState = useMemo(
    () => getActivationState(state, { hasLocalJournalEntry }),
    [hasLocalJournalEntry, state],
  );
  const showActivationHome = activationState.isNewUser && activationState.activationLevel !== "active";
  const aggregatedCheckinHistory = useMemo(
    () => aggregateCheckinsByDay(state.checkinHistory || []),
    [state.checkinHistory]
  );

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
  const homeGoalActions = useMemo(
    () => buildGoalPriorityActions(state.goals || [], { limit: 3 }),
    [state.goals, goalActionTick],
  );
  const isAgendaRowExpanded = (key: string) => expandedAgendaRows.has(key);
  const toggleAgendaRowExpanded = (key: string) => {
    setExpandedAgendaRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      const entry = history.find(h => h.date === dateStr);
      const x = X_START + i * X_STEP;
      if (!entry) return { x, humorY: null, energiaY: null, label: DIAS_SEMANA[d.getDay()].slice(0, 3), isHighlight: i === 6 };
      return {
        x,
        humorY: valueToChartY(entry.humor),
        energiaY: valueToChartY(entry.energia),
        label: DIAS_SEMANA[d.getDay()].slice(0, 3),
        phase: dailyPhaseMap[dateStr] ?? phaseFromMoodValue(entry.humor),
        isHighlight: i === 6,
      };
    });
  }, [aggregatedCheckinHistory, dailyPhaseMap]);

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
      label: formatCheckinMomentLabel(entry),
      phase: cycleReport.phase !== "insufficient_data" ? cycleReport.phase : phaseFromMoodValue(entry.humor),
      isHighlight: index === todayEntries.length - 1,
    }));
  }, [cycleReport.phase, dayContext.localDate, state.checkinHistory]);

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
      nextTask: homeAgendaPreview.tasks[0]
        ? { title: homeAgendaPreview.tasks[0].title, time: homeAgendaPreview.tasks[0].time }
        : null,
      dueHabit: homeAgendaPreview.habit
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
  const [completedAutocuidadoIdx, setCompletedAutocuidadoIdx] = useState<Set<number>>(new Set());
  const [skippedAutocuidadoIdx, setSkippedAutocuidadoIdx] = useState<Set<number>>(new Set());
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
  const groundedCare = useMemo(
    () => resolveGroundedHomeCare({
      actions: homeAiMsg?.autocuidado ?? [],
      hour: dayContext.hour,
      partOfDay: dayContext.partOfDay,
      moodLabel: mood.label,
      energy: state.energia,
      latestCheckin: latestTodayCheckin
        ? {
            humor: latestTodayCheckin.humor,
            energia: latestTodayCheckin.energia,
            emotions: latestTodayCheckin.emotions,
            factors: latestTodayCheckin.factors,
            note: latestTodayCheckin.note,
          }
        : null,
      pendingTaskTitles,
      goalTitles,
      hasMoodCycle: cycleReport.phase !== "insufficient_data",
    }),
    [
      cycleReport.phase,
      dayContext.hour,
      dayContext.partOfDay,
      goalTitles,
      homeAiMsg?.autocuidado,
      latestTodayCheckin,
      mood.label,
      pendingTaskTitles,
      state.energia,
    ],
  );
  const autocuidadoFinal = groundedCare.actions.length > 0 ? groundedCare.actions : null;

  // Task stats
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter(t => t.done).length;
  const pendingTasks = state.tasks.filter(t => !t.done).length;
  async function fetchAgenda() {
    setAgendaPhase("loading");
    try {
        agendaRequestCountRef.current += 1;
        const previousAgendaContext = extractAgendaRepeatContext(agendaBlocks);
        const previousHomeContext = extractHomeRepeatContext(homeAiMsg);
        const targetAgendaDate = resolveHomeAgendaSuggestionDate(dayContext.localDate, dayContext.hour);
        const gcalRes = await api.get(`/gcal/events?date=${targetAgendaDate}`).catch(() => null);
        const externalBusyWindows = gcalRes?.connected && Array.isArray(gcalRes.events)
          ? mapExternalCalendarBusyWindows(gcalRes.events)
          : [];
        const res = await api.post("/ai/suggest", {
          type: "agenda-blocks",
          context: {
            mood: state.mood,
            moodLabel: mood.label,
            energia: state.energia,
            history: (state.checkinHistory || []).slice(0, 3),
            moodCycleContext: moodCycleContextForAi,
            goals: goalTitles,
            pendingTaskTitles,
            hour: dayContext.hour,
            partOfDay: dayContext.partOfDay,
            weekday: dayContext.weekday,
            localDate: dayContext.localDate,
            targetAgendaDate,
            externalBusyWindows,
            previousAgendaLabels: previousAgendaContext.previousLabels,
            previousAgendaTasks: previousAgendaContext.previousTasks,
            previousAutocuidado: previousHomeContext.previousAutocuidado,
            requestVariant: agendaRequestCountRef.current,
          },
        });
      const parsed = parseAiSuggestion<AgendaBlock[]>(res.suggestion);
      const normalizedBlocks = dedupeAgendaBlocks(Array.isArray(parsed) ? parsed : [])
        .filter((block) => {
          const targetDate = block.local_date || targetAgendaDate;
          if (targetDate !== dayContext.localDate) return true;
          return timeToMinutes(block.horario_inicio) >= (dayContext.hour * 60 + clockTime.getMinutes());
        })
        .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));
      setAgendaBlocks(normalizedBlocks);
      setSelectedAgendaTaskKeys(buildAgendaSelection(normalizedBlocks));
      setSavedAgendaTaskKeys(new Set());
      setAgendaPhase("preview");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel montar a agenda com IA.");
      setAgendaPhase("idle");
    }
  }

  async function approveAgenda() {
    if (agendaSaving) return;
    const SKIP_TYPES = new Set(["descanso", "refeicao"]);
    const today = getLocalDateKey();
    const batches = new Map<string, Array<{ title: string; startTime: string; endTime: string; category: string; intensity: "L" | "M" | "P"; isAiSuggested: boolean; aiReasoning: string }>>();
    const savedKeys = new Set<string>();
    const seenTitles = new Set<string>();

    agendaBlocks.forEach((block, blockIndex) => {
      if (SKIP_TYPES.has(block.tipo)) return;
      const cfg = BLOCK_CONFIG[block.tipo] ?? BLOCK_CONFIG.flexivel;
      const targetDate = block.local_date || today;
      const startMin = timeToMinutes(block.horario_inicio);
      const endMin = timeToMinutes(block.horario_fim);
      const tasks = block.tarefas_sugeridas.filter((_, taskIndex) => selectedAgendaTaskKeys.has(agendaTaskKey(blockIndex, taskIndex)));
      if (tasks.length === 0) return;
      const totalDuration = Math.max(endMin - startMin, tasks.length * 20);
      const duration = Math.max(15, Math.floor(totalDuration / tasks.length));
      tasks.forEach((title, i) => {
        const trimmedTitle = title.trim();
        const normalizedTitle = `${targetDate}:${trimmedTitle.toLowerCase()}`;
        if (!trimmedTitle || seenTitles.has(normalizedTitle)) return;
        seenTitles.add(normalizedTitle);
        const taskIndex = block.tarefas_sugeridas.findIndex((task) => task === title);
        if (taskIndex >= 0) {
          savedKeys.add(agendaTaskKey(blockIndex, taskIndex));
        }
        const itemStart = startMin + i * duration;
        const dateBlocks = batches.get(targetDate) ?? [];
        dateBlocks.push({
          title: trimmedTitle,
          startTime: minutesToTime(itemStart),
          endTime: minutesToTime(itemStart + duration),
          category: cfg.category,
          intensity: block.intensity ?? "M",
          isAiSuggested: true,
          aiReasoning: block.razao_ia,
        });
        batches.set(targetDate, dateBlocks);
      });
    });

    const totalToCreate = Array.from(batches.values()).reduce((total, blocks) => total + blocks.length, 0);

    if (totalToCreate === 0) {
      showError("Selecione pelo menos uma sugestao para entrar no planner.");
      return;
    }

    setAgendaSaving(true);
    try {
      for (const [date, blocks] of batches) {
        await api.post("/timeline", {
          date,
          forceSave: false,
          blocks,
        });
      }
      await refreshData();
      setSavedAgendaTaskKeys(savedKeys);
      setAgendaPhase("approved");
      // feedback visual pela transição de fase (agendaPhase → "approved")
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/conflito|conflitos|horário|horario/i.test(message)) {
        showError("Esse horario ficou ocupado. Vou refazer a sugestao.");
        setAgendaPhase("idle");
        setAgendaBlocks([]);
        setSelectedAgendaTaskKeys(new Set());
        setSavedAgendaTaskKeys(new Set());
      } else {
        showError(message || "Nao foi possivel enviar a agenda ao planner.");
      }
    } finally {
      setAgendaSaving(false);
    }
  }
  function toggleAgendaTaskSelection(blockIndex: number, taskIndex: number) {
    const key = agendaTaskKey(blockIndex, taskIndex);
    setSelectedAgendaTaskKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleHabitSave(payload: HabitModalPayload) {
    try {
      await addHabit(payload);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel adicionar o habito.");
      return false;
    }
  }

  async function handleHomeTaskDone(task: (typeof homeAgendaPreview.tasks)[number]) {
    // Feedback visual imediato (otimista)
    setDoneTaskIds(prev => new Set([...prev, task.id]));
    recordHomeAutonomyFeedback(task.title, "done");
    try {
      await toggleTask(task.id);
    } catch (error) {
      setDoneTaskIds(prev => { const s = new Set(prev); s.delete(task.id); return s; });
      showError(error instanceof Error ? error.message : "Nao foi possivel concluir o compromisso.");
    }
  }

  async function handleHomeTaskDelete(task: (typeof homeAgendaPreview.tasks)[number]) {
    recordHomeAutonomyFeedback(task.title, "deleted");
    try {
      await removeTask(task.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel excluir o compromisso.");
    }
  }

  async function handleHomeHabitDone(habit: NonNullable<typeof homeAgendaPreview.habit>) {
    recordHomeAutonomyFeedback(habit.title, "done");
    try {
      await toggleHabit(habit.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel atualizar o habito.");
    }
  }

  async function handleHomeHabitDelete(habit: NonNullable<typeof homeAgendaPreview.habit>) {
    recordHomeAutonomyFeedback(habit.title, "deleted");
    try {
      await archiveHabit(habit.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel excluir o habito.");
    }
  }

  async function handleHomeGoalActionDone(action: (typeof homeGoalActions)[number]) {
    recordHomeAutonomyFeedback(action.text, "done");
    try {
      if (action.source === "goal" && action.goalId != null && action.subId != null) {
        await toggleSubGoal(action.goalId, action.subId);
      } else if (action.source === "capture" && action.gtdId) {
        markStoredGtdActionDone(action.gtdId);
        setGoalActionTick((value) => value + 1);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
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

  const selectedAgendaCount = selectedAgendaTaskKeys.size;
  const selectableAgendaCount = agendaBlocks.reduce((total, block) => {
    if (block.tipo === "descanso" || block.tipo === "refeicao") return total;
    return total + block.tarefas_sugeridas.length;
  }, 0);
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
      <p className="aura-section-kicker">Acesso rapido</p>
      <div className="shortcut-grid">
        <button className="shortcut-card" onClick={() => navigate("/journal")}>
          <div className="icon-badge shortcut-icon shortcut-icon-journal">
            <MessageSquareText size={18} color="var(--terracotta)" />
          </div>
          <span className="shortcut-label">Diário</span>
          <span className="shortcut-sub">Falar com IA</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/planner")}>
          <div className="icon-badge shortcut-icon shortcut-icon-planner">
            <LayoutDashboard size={18} color="var(--horizon)" />
          </div>
          <span className="shortcut-label">Planner</span>
          <span className="shortcut-sub">Organizar</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/daily-summary")}>
          <div className="icon-badge" style={{ background: "rgba(197,165,147,.16)" }}>
            <ClipboardCheck size={18} color="var(--accent-peach)" />
          </div>
          <span className="shortcut-label">Fechar</span>
          <span className="shortcut-sub">Amanhã</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/insights")}>
          <div className="icon-badge shortcut-icon shortcut-icon-insights">
            <Activity size={18} color="var(--atomic-tangerine)" />
          </div>
          <span className="shortcut-label">Padrões</span>
          <span className="shortcut-sub">Harmonia</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/goals")}>
          <div className="icon-badge shortcut-icon shortcut-icon-goals">
            <Target size={18} color="var(--sweet-mint)" />
          </div>
          <span className="shortcut-label">Objetivos</span>
          <span className="shortcut-sub">Suas metas</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/pomodoro")}>
          <div className="icon-badge shortcut-icon shortcut-icon-pomodoro">
            <Timer size={18} color="var(--terracotta)" />
          </div>
          <span className="shortcut-label">Pomodoro</span>
          <span className="shortcut-sub">Foco</span>
        </button>
        <button className="shortcut-card" onClick={() => navigate("/habits")}>
          <div className="icon-badge" style={{ background: "rgba(150,199,179,.18)" }}>
            <Sparkles size={18} color="var(--accent-sage)" />
          </div>
          <span className="shortcut-label">Hábitos</span>
          <span className="shortcut-sub">Rituais</span>
        </button>
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
                Agendar sugestão
              </p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.35 }}>
                Marcar para {scheduleModalAction.date === dayContext.localDate ? "hoje" : "esta data"} às {scheduleModalAction.time}?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScheduleModalAction(null)}
              style={{ border: "none", background: "transparent", color: "var(--text-3)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              aria-label="Fechar modal"
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
              Não
            </button>
            <button
              type="button"
              onClick={() => void confirmHomeScheduleModal()}
              disabled={addingActionTitle === scheduleModalAction.title}
              style={{ flex: 1, height: 40, borderRadius: 12, border: "none", background: "var(--accent-peach)", color: "#fff", fontSize: 12, fontWeight: 900, cursor: addingActionTitle === scheduleModalAction.title ? "default" : "pointer", opacity: addingActionTitle === scheduleModalAction.title ? 0.7 : 1 }}
            >
              {addingActionTitle === scheduleModalAction.title ? "Salvando..." : "Sim"}
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
          {isRefreshing ? "Atualizando..." : isReady ? "Solte para atualizar" : "Puxe para atualizar"}
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
                {getFormattedDate(clockTime)}
              </p>
            </div>
            {/* Config (gear) + Relógio */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate("/preferences")}
                aria-label="Configurações"
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
          {/* Hero de fase — o centro da today view */}
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <div style={{
              width: 76, height: 76, borderRadius: "50%",
              background: "rgba(255,255,255,.80)",
              border: `2px solid ${phaseColor}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, marginBottom: 12,
              boxShadow: "0 10px 22px rgba(17,24,39,.05)",
            }}>
              {cycleReport.phaseEmoji}
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.2 }}>
              {currentPhaseLabel}
            </p>
            <p style={{ margin: "8px auto 0", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 250 }}>
              {PHASE_CONFIG[cycleReport.phase]?.tip ?? "Airia organiza seu dia respeitando seu humor e energia."}
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
              eyebrow="Primeiro padrão que a Airia notou"
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
              eyebrow="Sua semana, em 1 leitura"
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
                      Previsão
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
                aria-label="Próximo gráfico"
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
                    ? "Isso aparece depois do check-in de hoje."
                    : "Isso aparece depois do seu primeiro check-in."}
                </span>
              </div>
            ) : (
              <>
                <svg width="100%" viewBox="0 0 280 72" style={{ overflow: "visible" }}>
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
                </svg>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, paddingInline: 6 }}>
                  {activeChartData.map((point, index) => (
                    <div key={`${point.label}-${index}`} style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: point.isHighlight ? 700 : 500, color: point.isHighlight ? "var(--text-1)" : "var(--text-3)" }}>
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
                    Faça mais check-ins para liberar a previsão de 7 dias.
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
                  Baseado no seu padrão de humor e energia. Quanto mais check-ins, mais preciso.
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

        {/* ── Agenda por Blocos ── */}
        <div style={{ marginBottom: "calc(var(--a) * 1.2)" }}>
          {/* Header */}
          <div className="home-section-row">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
              <span className="section-title" style={{ fontSize: "14px" }}>{t("home.agendaTitle")}</span>
            </div>
            {agendaPhase === "approved" && (
              <span style={{ fontSize: "11px", color: "var(--accent-sage)", fontWeight: 600 }}>✓ No Planner</span>
            )}
            {agendaPhase === "preview" && (
              <span style={{ fontSize: "11px", color: "var(--text-3)", fontWeight: 600 }}>
                {selectedAgendaCount} selecionada{selectedAgendaCount !== 1 ? "s" : ""}
              </span>
            )}
            {agendaPhase === "idle" && (
              <AuraButtonV2 variant="primary" size="sm" onClick={fetchAgenda} useAuraIcon>
                {t("home.agendaWithAi")}
              </AuraButtonV2>
            )}
          </div>

          {agendaPhase === "idle" && (
            <div className="home-agenda-card" style={{
              background: "rgba(255,253,249,.97)",
              borderRadius: 14,
              border: "1.5px solid var(--warm-border)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}>
              {homeAgendaPreview.tasks.length === 0 && !homeAgendaPreview.habit && homeGoalActions.length === 0 ? (
                <div style={{ padding: "14px 13px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", margin: "0 0 4px" }}>
                    Seu planner ainda está livre
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, margin: 0 }}>
                    Monte o dia com base no humor e energia de agora, ou crie uma primeira tarefa manual.
                  </p>
                </div>
              ) : (
                <>
                  {homeAgendaPreview.tasks.map((task, index) => {
                    const isTaskDone = doneTaskIds.has(task.id);
                    const rowKey = `task:${task.id}`;
                    const isExpanded = isAgendaRowExpanded(rowKey);
                    return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("/planner", { state: { openTaskId: task.id } })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate("/planner", { state: { openTaskId: task.id } });
                        }
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        gap: 10,
                        padding: "10px 13px",
                        border: "none",
                        borderBottom: index < homeAgendaPreview.tasks.length - 1 || homeAgendaPreview.habit ? "1px solid var(--warm-border)" : "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        opacity: isTaskDone ? 0.6 : 1,
                        transition: "opacity 0.2s",
                        order: timeToMinutes(task.time),
                      }}
                    >
                      <div style={{ flexShrink: 0, textAlign: "right", minWidth: 38 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-peach)", margin: 0 }}>{task.time}</p>
                        <p style={{ fontSize: 9, color: "var(--text-3)", margin: "1px 0 0" }}>hoje</p>
                      </div>
                      <div style={{ width: 3, borderRadius: 999, background: isTaskDone ? "var(--accent-sage)" : "var(--accent-peach)", flexShrink: 0, alignSelf: "stretch", minHeight: 28, transition: "background 0.2s" }} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isTaskDone ? "var(--text-3)" : "var(--text-1)",
                            margin: 0,
                            textDecoration: isTaskDone ? "line-through" : "none",
                            transition: "all 0.2s",
                            whiteSpace: isExpanded ? "normal" : "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {task.title}
                          </p>
                          {isExpanded && (
                            <p style={{ fontSize: 10, color: "var(--text-3)", margin: "2px 0 0" }}>
                              {isTaskDone ? "Concluído" : (task.category ? `Compromisso/tarefa · ${task.category}` : "Compromisso/tarefa")}
                            </p>
                          )}
                        </div>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAgendaRowExpanded(rowKey);
                          }}
                          title={isExpanded ? "Recolher" : "Expandir"}
                          aria-label={isExpanded ? "Recolher compromisso" : "Expandir compromisso"}
                          style={{
                            width: 20, height: 20, borderRadius: "50%",
                            border: "1.5px solid rgba(244,168,150,.45)",
                            background: "rgba(244,168,150,.12)",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            color: "var(--accent-peach)",
                          }}
                        >
                          <ChevronRight size={12} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 160ms ease" }} />
                        </button>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isTaskDone) void handleHomeTaskDone(task);
                          }}
                          title={isTaskDone ? "Concluído" : "Marcar como feito"}
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1.5px solid var(--accent-sage)",
                            background: isTaskDone ? "var(--accent-sage)" : "transparent",
                            cursor: isTaskDone ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            transition: "background 0.2s",
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={isTaskDone ? "white" : "var(--accent-sage)"} strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleHomeTaskDelete(task);
                          }}
                          title="Excluir"
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1.5px solid var(--accent-peach)",
                            background: "transparent",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );})}
                  {homeAgendaPreview.habit && (() => {
                    const rowKey = `habit:${homeAgendaPreview.habit.id}`;
                    const isExpanded = isAgendaRowExpanded(rowKey);
                    return (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("/habits")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate("/habits");
                        }
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        gap: 10,
                        padding: "10px 13px",
                        border: "none",
                        background: "rgba(180,185,169,.08)",
                        cursor: "pointer",
                        textAlign: "left",
                        order: timeToMinutes(homeAgendaPreview.habit.reminderTime ?? "23:59"),
                      }}
                    >
                      <div style={{ flexShrink: 0, textAlign: "right", minWidth: 38 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-sage)", margin: 0 }}>
                          {homeAgendaPreview.habit.reminderTime ?? "--:--"}
                        </p>
                        <p style={{ fontSize: 9, color: "var(--text-3)", margin: "1px 0 0" }}>hábito</p>
                      </div>
                      <div style={{ width: 3, borderRadius: 999, background: "var(--accent-sage)", flexShrink: 0, alignSelf: "stretch", minHeight: 28 }} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--text-1)",
                            margin: 0,
                            whiteSpace: isExpanded ? "normal" : "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {homeAgendaPreview.habit.icon ? `${homeAgendaPreview.habit.icon} ` : ""}{homeAgendaPreview.habit.title}
                          </p>
                          {isExpanded && (
                            <p style={{ fontSize: 10, color: "var(--text-3)", margin: "2px 0 0" }}>
                              Ritual pendente de hoje
                            </p>
                          )}
                        </div>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAgendaRowExpanded(rowKey);
                          }}
                          title={isExpanded ? "Recolher" : "Expandir"}
                          aria-label={isExpanded ? "Recolher hábito" : "Expandir hábito"}
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1px solid var(--warm-border-2)",
                            background: "rgba(255,255,255,.62)",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            color: "var(--text-3)",
                          }}
                        >
                          <ChevronRight size={11} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 160ms ease" }} />
                        </button>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleHomeHabitDone(homeAgendaPreview.habit!);
                          }}
                          title="Marcar como feito"
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1.5px solid var(--accent-sage)",
                            background: "transparent",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleHomeHabitDelete(homeAgendaPreview.habit!);
                          }}
                          title="Excluir"
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1.5px solid var(--accent-peach)",
                            background: "transparent",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    );
                  })()}
                  {homeGoalActions.map((action, index) => {
                    const rowKey = `action:${action.id}`;
                    const isExpanded = isAgendaRowExpanded(rowKey);
                    return (
                    <div
                      key={action.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate("/goals", action.source === "goal" ? { state: { openGoalId: action.goalId, openSubtaskId: action.subId } } : { state: { activeTab: "acoes" } })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate("/goals", action.source === "goal" ? { state: { openGoalId: action.goalId, openSubtaskId: action.subId } } : { state: { activeTab: "acoes" } });
                        }
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        gap: 10,
                        padding: "10px 13px",
                        border: "none",
                        borderTop: index === 0 ? "1px solid var(--warm-border)" : "none",
                        borderBottom: index < homeGoalActions.length - 1 ? "1px solid var(--warm-border)" : "none",
                        background: "rgba(244,168,150,.06)",
                        cursor: "pointer",
                        textAlign: "left",
                        order: 2000 + index,
                      }}
                    >
                      <div style={{ flexShrink: 0, textAlign: "right", minWidth: 38 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-peach)", margin: 0 }}>ação</p>
                        <p style={{ fontSize: 9, color: "var(--text-3)", margin: "1px 0 0" }}>meta</p>
                      </div>
                      <div style={{ width: 3, borderRadius: 999, background: "var(--accent-peach)", flexShrink: 0, alignSelf: "stretch", minHeight: 28 }} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--text-1)",
                            margin: 0,
                            whiteSpace: isExpanded ? "normal" : "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {action.text}
                          </p>
                          {isExpanded && (
                            <p style={{ fontSize: 10, color: "var(--text-3)", margin: "2px 0 0" }}>
                              {action.source === "goal" && action.goalTitle ? `Próxima ação · ${action.goalTitle}` : "Próxima ação capturada"}
                            </p>
                          )}
                        </div>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAgendaRowExpanded(rowKey);
                          }}
                          title={isExpanded ? "Recolher" : "Expandir"}
                          aria-label={isExpanded ? "Recolher ação" : "Expandir ação"}
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1px solid var(--warm-border-2)",
                            background: "rgba(255,255,255,.62)",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            color: "var(--text-3)",
                          }}
                        >
                          <ChevronRight size={11} style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 160ms ease" }} />
                        </button>
                        <button
                          className="home-touch-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleHomeGoalActionDone(action);
                          }}
                          title="Marcar ação como feita"
                          style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "1.5px solid var(--accent-sage)",
                            background: "transparent",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {agendaPhase === "loading" && (
            <div style={{
              background: "rgba(255,253,249,.9)", borderRadius: 12, padding: "16px",
              textAlign: "center", border: "1.5px solid var(--warm-border)",
            }}>
              <div className="aura-inline-spinner" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic" }}>
                Analisando seu estado e montando blocos personalizados...
              </p>
            </div>
          )}

          {(agendaPhase === "preview" || agendaPhase === "approved") && agendaBlocks.length > 0 && (
            <div className="home-agenda-card" style={{
              background: "rgba(255,253,249,.97)", borderRadius: 14,
              border: "1.5px solid var(--warm-border)", overflow: "hidden",
            }}>
              {agendaBlocks.map((block, idx) => {
                const cfg = BLOCK_CONFIG[block.tipo] ?? BLOCK_CONFIG.flexivel;
                const isSkip = block.tipo === "descanso" || block.tipo === "refeicao";
                const savedCount = block.tarefas_sugeridas.filter((_, taskIndex) => savedAgendaTaskKeys.has(agendaTaskKey(idx, taskIndex))).length;
                return (
                  <div key={idx} style={{
                    display: "flex", gap: 10, padding: "10px 13px",
                    borderBottom: idx < agendaBlocks.length - 1 ? "1px solid var(--warm-border)" : "none",
                    opacity: isSkip ? 0.55 : 1,
                  }}>
                    {/* Time column */}
                    <div style={{ flexShrink: 0, textAlign: "right", minWidth: 38 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: cfg.cor, margin: 0 }}>{block.horario_inicio}</p>
                      <p style={{ fontSize: 9, color: "var(--text-3)", margin: "1px 0 0" }}>{block.horario_fim}</p>
                    </div>
                    {/* Color bar */}
                    <div style={{ width: 3, borderRadius: 999, background: cfg.cor, flexShrink: 0, alignSelf: "stretch", minHeight: 28 }} />
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <span style={{ fontSize: 13 }}>{cfg.emoji}</span>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{block.label}</p>
                        {savedCount > 0 && !isSkip && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: cfg.cor, background: cfg.bg, padding: "2px 6px", borderRadius: 999, border: `1px solid ${cfg.cor}40` }}>✓ {savedCount} salva{savedCount > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      {block.tarefas_sugeridas.length > 0 && !isSkip && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 5 }}>
                          {block.tarefas_sugeridas.map((t, ti) => (
                            <button
                              key={ti}
                              type="button"
                              onClick={() => agendaPhase === "preview" && toggleAgendaTaskSelection(idx, ti)}
                              style={{
                                width: "100%",
                                fontSize: 11,
                                color: selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? cfg.cor : "var(--text-2)",
                                background: selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? `${cfg.cor}18` : cfg.bg,
                                border: `1px solid ${selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? cfg.cor + "70" : cfg.cor + "30"}`,
                                borderRadius: 9,
                                padding: "6px 8px",
                                cursor: agendaPhase === "preview" ? "pointer" : "default",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                textAlign: "left",
                                opacity: agendaPhase === "approved" && !savedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? 0.45 : 1,
                              }}
                            >
                              {agendaPhase === "preview" && (
                                <span style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 5,
                                  border: `1.5px solid ${cfg.cor}`,
                                  background: selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? cfg.cor : "transparent",
                                  color: "#fff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  fontSize: 10,
                                  fontWeight: 900,
                                }}>
                                  {selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? "✓" : ""}
                                </span>
                              )}
                              <span style={{ flex: 1 }}>{t}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: 10, color: "var(--text-3)", fontStyle: "italic", margin: 0 }}>
                        {block.razao_ia}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Approve button */}
              {agendaPhase === "preview" && (
                <div style={{ padding: "10px 13px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: "1 1 100%" }}
                    onClick={() => {
                      if (selectedAgendaCount >= selectableAgendaCount) {
                        setSelectedAgendaTaskKeys(new Set());
                      } else {
                        setSelectedAgendaTaskKeys(buildAgendaSelection(agendaBlocks));
                      }
                    }}
                    disabled={agendaSaving || selectableAgendaCount === 0}
                  >
                    {selectedAgendaCount >= selectableAgendaCount ? "Limpar seleção" : "Marcar todas"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => { setAgendaPhase("idle"); setAgendaBlocks([]); setSelectedAgendaTaskKeys(new Set()); setSavedAgendaTaskKeys(new Set()); }}
                  >Cancelar</button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={fetchAgenda}
                    disabled={agendaSaving}
                  >Refazer</button>
                  <AuraButtonV2 variant="primary" size="sm" style={{ flex: 2 }} onClick={approveAgenda} disabled={selectedAgendaCount === 0 || agendaSaving}>
                    {agendaSaving ? "Enviando..." : `Adicionar ${selectedAgendaCount > 0 ? selectedAgendaCount : ""} ao Planner`}
                  </AuraButtonV2>
                </div>
              )}
            </div>
          )}
        </div>

        {quickAccessSection}

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
              ? cycleReport.phaseTip
              : "Faça um check-in para a Airia calibrar seu ritmo de hoje.";

          return (
            <div className="home-cycle-card" style={{ border: `1.5px solid ${isUrgent ? cfg.color : phaseColor}33`, marginBottom: "calc(var(--a) * 1.1)" }}>
              <div className="home-cycle-rail" style={{ background: isUrgent ? cfg.color : phaseColor }} />
              <div className="home-cycle-content">
                <div className="home-cycle-header" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="home-cycle-kicker">RITMO DE HOJE</span>
                    <div className="home-cycle-phase" style={{ marginTop: 8, marginBottom: 0 }}>
                      <span className="home-cycle-emoji">{hasCycleData ? cycleReport.phaseEmoji : mood.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <p className="home-cycle-title" style={{ margin: 0 }}>
                          {hasCycleData
                            ? `${cycleReport.daysInPhase} dia${cycleReport.daysInPhase !== 1 ? "s" : ""} nesta fase`
                            : "Ainda calibrando"}
                        </p>
                        {!hasCycleData && (
                          <p className="home-cycle-subtitle">
                            A Home fica mais precisa depois do primeiro check-in
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className="home-cycle-score" style={{ background: `${isUrgent ? cfg.color : phaseColor}18`, color: isUrgent ? cfg.color : phaseColor }}>
                      {formatStabilityStatus(score)}
                    </span>
                    <button
                      type="button"
                      className="home-touch-button"
                      onClick={() => setAutonomyExpanded(!autonomyExpanded)}
                      aria-label={autonomyExpanded ? "Recolher detalhes do ritmo" : "Ver detalhes do ritmo"}
                      title={autonomyExpanded ? "Recolher detalhes" : "Ver detalhes"}
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
                      Atenção: a Airia detectou estabilidade baixa. Melhor reduzir carga e escolher uma ação pequena.
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
                    {hasCycleData ? "Ver padrões" : "Fazer check-in"}
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
                          Próximos movimentos
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
                                aria-label="Adicionar ao Planner"
                                title="Adicionar ao Planner"
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
                                aria-label="Trocar sugestão"
                                title="Trocar sugestão"
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
            <p style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-peach-ink)", margin: 0 }}>Como está seu dia?</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Stat label="Tarefas de hoje" value={`${totalTasks} planejada${totalTasks !== 1 ? "s" : ""}`} accent="sky" />
            <div style={{ height: 1, background: "var(--warm-border)" }} />
            <Stat label="Concluídas" value={`${doneTasks} ✓`} accent="sage" />
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
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-peach-ink)", margin: 0 }}>Airia diz</p>
                  <span style={{ fontSize: 9, background: "var(--accent-peach-a3)", color: "var(--accent-peach-ink)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>{motivacionalFinal}</p>
              </>
            ) : (
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, fontStyle: "italic", textAlign: "center" }}>
                Faça um check-in para receber sua mensagem personalizada.
              </p>
            )}
          </div>
        </div>
        )}

        {/* ── Momento de Autocuidado ── */}
        <Card surface="panel" style={{ border: "1.5px solid rgba(161,140,120,.25)" }}>
          <div className="home-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="home-panel-title" style={{ color: "var(--earth-11)" }}>
                  {t("home.caresTitle")}
                </p>
              {autocuidadoFinal && !homeAiLoading && (
                <span style={{ fontSize: 9, background: "rgba(161,140,120,.15)", color: "var(--earth-11)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
              )}
            </div>
            {!homeAiLoading && autocuidadoFinal && (
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0", fontStyle: "italic" }}>
                {groundedCare.evidence || "Sugestões ancoradas no momento atual."}
              </p>
            )}
          </div>
          <div className="home-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {homeAiLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ height: 36, borderRadius: 9, background: "rgba(0,0,0,.04)", border: "1px solid rgba(161,140,120,.1)" }} />
              ))
            ) : autocuidadoFinal ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {autocuidadoFinal
                  .map((item, i) => ({ item, i }))
                  .filter(({ i }) => !completedAutocuidadoIdx.has(i) && !skippedAutocuidadoIdx.has(i))
                  .map(({ item, i }) => (
                    <div key={i} className="home-soft-row" style={{
                      background: "var(--warm-bg)",
                      border: "1px solid rgba(161,140,120,.2)",
                      display: "flex", alignItems: "center", gap: 8, paddingRight: 8,
                    }}>
                      <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, flex: 1 }}>{item}</p>
                      <button
                        className="home-touch-button"
                        type="button"
                        onClick={() => setCompletedAutocuidadoIdx(prev => new Set([...prev, i]))}
                        title="Marcar como cumprido"
                        style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          border: "1.5px solid var(--accent-sage)",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button
                        className="home-touch-button"
                        type="button"
                        onClick={() => {
                          const remaining = autocuidadoFinal.filter(
                            (_, j) => !completedAutocuidadoIdx.has(j) && !skippedAutocuidadoIdx.has(j) && j !== i
                          );
                          if (remaining.length === 0) {
                            setSkippedAutocuidadoIdx(new Set());
                          } else {
                            setSkippedAutocuidadoIdx(prev => new Set([...prev, i]));
                          }
                        }}
                        title="Ver outra sugestao"
                        style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          border: "1.5px solid var(--text-3)",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
                          <polyline points="1 4 1 10 7 10" />
                          <polyline points="23 20 23 14 17 14" />
                        </svg>
                      </button>
                    </div>
                  ))
                }
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
                Faça um check-in ou coloque uma pendência no Planner para receber sugestões que façam sentido agora.
              </p>
            )}
          </div>
        </Card>

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
