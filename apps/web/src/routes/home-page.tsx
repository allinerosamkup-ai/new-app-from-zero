// Home Page v4 — babá digital IA + mensagens personalizadas + agenda por blocos
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { FollowUpPending } from "../features/aura/types";
import { HABIT_SUGGESTIONS, type HabitSuggestion } from "../features/aura/habit-presets";
import { api } from "../lib/api";
import { parseAiSuggestion, tryParseAiSuggestion } from "../lib/ai";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useToast } from "../components/Toast";
import { aggregateCheckinsByDay, computeConsistencyScore, computeMoodCycle, computeStreak, forecastMood7d, getPhaseColor, getStabilityLabel } from "../utils/mood-cycle-engine";
import { getClientDayContext, getLocalDateKey, normalizeDateKey } from "../utils/day-context";
import {
  type AgendaBlock,
  type HomeAiMsg,
  buildHomeAiRequestKey,
  buildQuarterHourRefreshBucket,
  dedupeAgendaBlocks,
  extractAgendaRepeatContext,
  extractHomeRepeatContext,
} from "./home-page.helpers";
import { 
  MessageSquareText,
  LayoutDashboard,
  Activity,
  Target,
  Timer,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { AuraIcon } from "../components/AuraIcon";
import { OnboardingTour } from "../components/OnboardingTour";
import "../styles/aura.css";

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
  tone: "info" | "warning" | "critical";
  actionLabel?: string;
  actionPath?: string;
};

type ChartPoint = {
  x: number;
  humorY: number | null;
  energiaY: number | null;
  label: string;
  isHighlight?: boolean;
};

function normalizeHomeAiMessage(payload: unknown): HomeAiMsg | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Partial<HomeAiMsg> & { proactive?: unknown };
  const motivacional = typeof source.motivacional === "string" ? source.motivacional.trim() : "";
  const autocuidado = Array.isArray(source.autocuidado)
    ? source.autocuidado.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 3)
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
      title: typeof proactiveRaw?.title === "string" ? proactiveRaw.title : "Ação rápida",
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

// ── Helpers de tempo ──────────────────────────────────────
function getGreeting(h: number) {
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
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


const moodMap: Record<string, { emoji: string; label: string; description: string; tip: string; chipLabel: string }> = {
  equilibrada: {
    emoji: "😌",
    label: "Em Equilíbrio",
    description: "Ritmo tranquilo e constante. Boa base para tarefas do dia.",
    tip: "Comece com tarefas leves e vá aumentando o ritmo gradualmente.",
    chipLabel: "Estável",
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

const HABIT_THEME_META: Record<HabitSuggestion["theme"], { label: string; accent: string; bg: string }> = {
  starter: { label: "Cotidiano leve", accent: "var(--accent-peach)", bg: "rgba(244,190,168,.18)" },
  autocuidado: { label: "Autocuidado", accent: "var(--sweet-mint)", bg: "rgba(192,220,203,.22)" },
  casa: { label: "Casa em ordem", accent: "var(--horizon)", bg: "rgba(189,207,236,.22)" },
  social: { label: "Vínculos", accent: "var(--horizon)", bg: "rgba(218,206,235,.24)" },
  criativo: { label: "Criativo", accent: "var(--atomic-tangerine)", bg: "rgba(248,215,193,.24)" },
  natureza: { label: "Natureza", accent: "var(--accent-sage)", bg: "rgba(200,220,210,.24)" },
};

function groupHabitSuggestions() {
  const groups = new Map<HabitSuggestion["theme"], HabitSuggestion[]>();

  HABIT_SUGGESTIONS.forEach((suggestion) => {
    const current = groups.get(suggestion.theme) ?? [];
    current.push(suggestion);
    groups.set(suggestion.theme, current);
  });

  return Array.from(groups.entries()).map(([theme, suggestions]) => ({
    theme,
    meta: HABIT_THEME_META[theme],
    suggestions,
  }));
}

function HabitIdeasModal({
  onClose,
  onManualAdd,
  onQuickAdd,
  onViewAll,
}: {
  onClose: () => void;
  onManualAdd: (payload: { title: string; icon: string }) => Promise<boolean>;
  onQuickAdd: (suggestion: HabitSuggestion) => Promise<boolean>;
  onViewAll: () => void;
}) {
  const groupedSuggestions = groupHabitSuggestions();
  const [manualTitle, setManualTitle] = useState("");
  const [manualIcon, setManualIcon] = useState("✨");
  const [savingManual, setSavingManual] = useState(false);
  const [savingSuggestion, setSavingSuggestion] = useState<string | null>(null);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());

  async function handleManualSave() {
    if (!manualTitle.trim()) return;
    setSavingManual(true);
    const ok = await onManualAdd({ title: manualTitle.trim(), icon: manualIcon });
    if (ok) {
      setManualTitle("");
      onClose();
    }
    setSavingManual(false);
  }

  async function handleQuickSave(suggestion: HabitSuggestion) {
    if (savingSuggestion === suggestion.title || addedSuggestions.has(suggestion.title)) return;
    setSavingSuggestion(suggestion.title);
    const ok = await onQuickAdd(suggestion);
    if (ok) {
      setAddedSuggestions((current) => new Set(current).add(suggestion.title));
    }
    setSavingSuggestion(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(252,248,245,.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px 12px 0",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "rgba(255,255,255,.96)",
          border: "1px solid rgba(17,24,39,.06)",
          borderRadius: "30px 30px 0 0",
          boxShadow: "0 -8px 40px rgba(17,24,39,.10)",
          padding: "18px 18px 28px",
        }}
      >
        <div style={{ width: 46, height: 5, borderRadius: 999, background: "rgba(17,24,39,.10)", margin: "0 auto 18px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)" }}>
              Hábitos com mais charme
            </p>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Escolha um ritual para hoje</h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>
              Adicione algo simples, gostoso ou inesperado. O foco aqui é facilitar a entrada e deixar a rotina mais viva.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid rgba(17,24,39,.08)",
              background: "rgba(255,255,255,.85)",
              color: "var(--text-2)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "56px 1fr auto",
            gap: 10,
            padding: 14,
            borderRadius: 22,
            background: "linear-gradient(135deg, rgba(244,190,168,.16), rgba(229,219,247,.18))",
            border: "1px solid rgba(17,24,39,.05)",
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setManualIcon((current) => (current === "✨" ? "🌿" : current === "🌿" ? "🧡" : "✨"))}
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              border: "1px solid rgba(17,24,39,.06)",
              background: "rgba(255,255,255,.88)",
              fontSize: 28,
              cursor: "pointer",
            }}
          >
            {manualIcon}
          </button>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text-3)" }}>
              Entrada livre
            </p>
            <input
              type="text"
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="Ex: dobrar as roupas, regar as plantas, 5 min de silêncio"
              style={{
                width: "100%",
                height: 44,
                borderRadius: 14,
                border: "1px solid rgba(17,24,39,.08)",
                background: "rgba(255,255,255,.92)",
                padding: "0 14px",
                fontSize: 14,
                color: "var(--text-1)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <AuraButtonV2 variant="primary" size="sm" onClick={handleManualSave} disabled={savingManual || !manualTitle.trim()} style={{ alignSelf: "end", height: 44 }}>
            {savingManual ? "Salvando..." : "Criar"}
          </AuraButtonV2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groupedSuggestions.map(({ theme, meta, suggestions }) => (
            <div key={theme}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: meta.bg,
                      color: meta.accent,
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    <Sparkles size={14} />
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text-1)" }}>{meta.label}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-3)" }}>{suggestions.length} ideias para puxar a rotina</p>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {suggestions.map((suggestion) => {
                  const isAdded = addedSuggestions.has(suggestion.title);
                  const isSaving = savingSuggestion === suggestion.title;
                  return (
                    <button
                      key={suggestion.title}
                      type="button"
                      onClick={() => handleQuickSave(suggestion)}
                      disabled={isAdded || isSaving}
                      style={{
                        minWidth: 180,
                        maxWidth: 180,
                        padding: 14,
                        borderRadius: 22,
                        border: `1px solid ${isAdded ? `${meta.accent}26` : "rgba(17,24,39,.06)"}`,
                        background: isAdded ? "rgba(255,255,255,.98)" : meta.bg,
                        boxShadow: "0 10px 22px rgba(17,24,39,.06)",
                        cursor: isAdded ? "default" : "pointer",
                        textAlign: "left",
                        flexShrink: 0,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 24 }}>{suggestion.icon}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                            color: meta.accent,
                          }}
                        >
                          {suggestion.durationMinutes > 0 ? `${suggestion.durationMinutes} min` : "flex"}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.3 }}>
                        {suggestion.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "var(--text-2)" }}>
                        {isAdded ? "Já entrou na sua lista de hábitos." : "Toque para adicionar em um clique."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onViewAll}
          style={{
            width: "100%",
            marginTop: 18,
            height: 46,
            borderRadius: 16,
            border: "1px solid rgba(17,24,39,.08)",
            background: "rgba(255,255,255,.9)",
            color: "var(--text-1)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Ver página completa de hábitos
        </button>
      </div>
    </div>
  );
}

export function HomePage() {
  const { state, addTask, addHabit, refreshData, setPendingFollowUp, setProactiveNudge, hydrated } = useAuraStore();
  const handlePullRefresh = useCallback(() => refreshData(), [refreshData]);
  const { containerRef, pullDistance, isRefreshing, isReady } = usePullToRefresh(handlePullRefresh);

  // Refresh on mount to pick up any check-ins done since the app loaded
  useEffect(() => { refreshData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [addedActionIdx, setAddedActionIdx] = useState<Set<number>>(new Set());
  const [checkinChartMode, setCheckinChartMode] = useState<"week" | "day">("week");
  const [forecastTab, setForecastTab] = useState<"forecast" | "monthly">("forecast");
  const [showHabitIdeasModal, setShowHabitIdeasModal] = useState(false);

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
  const agendaRequestCountRef = useRef(0);

  const mood = moodMap[state.mood] ?? moodMap.equilibrada;
  const habits = state.habits || [];
  const aggregatedCheckinHistory = useMemo(
    () => aggregateCheckinsByDay(state.checkinHistory || []),
    [state.checkinHistory]
  );

  // ── Motor de Ciclagem de Humor ────────────────────────────
  const cycleReport = useMemo(
    () => computeMoodCycle(aggregatedCheckinHistory),
    [aggregatedCheckinHistory]
  );
  const streak = useMemo(() => computeStreak(aggregatedCheckinHistory), [aggregatedCheckinHistory]);
  const phaseColor = getPhaseColor(cycleReport.phase);
  const moodForecast = useMemo(() => forecastMood7d(aggregatedCheckinHistory), [aggregatedCheckinHistory]);
  const monthlyHistory = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = getLocalDateKey(cutoff);
    return [...aggregatedCheckinHistory]
      .filter(h => h.date >= cutoffIso)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [aggregatedCheckinHistory]);
  const consistencyScore = useMemo(
    () => computeConsistencyScore(aggregatedCheckinHistory, state.habits ?? [], 0),
    [aggregatedCheckinHistory, state.habits],
  );
  const goalTitles = useMemo(
    () => (state.goals || []).filter((goal) => goal.completedPct < 100).map((goal) => goal.title),
    [state.goals],
  );
  const pendingTaskTitles = useMemo(
    () => (state.tasks || []).filter((task) => !task.done).slice(0, 6).map((task) => task.title),
    [state.tasks],
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
      const entry = history.find(h => h.date === dateStr);
      const x = X_START + i * X_STEP;
      if (!entry) return { x, humorY: null, energiaY: null, label: DIAS_SEMANA[d.getDay()].slice(0, 3), isHighlight: i === 6 };
      return {
        x,
        humorY: valueToChartY(entry.humor),
        energiaY: valueToChartY(entry.energia),
        label: DIAS_SEMANA[d.getDay()].slice(0, 3),
        isHighlight: i === 6,
      };
    });
  }, [aggregatedCheckinHistory]);

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
      isHighlight: index === todayEntries.length - 1,
    }));
  }, [dayContext.localDate, state.checkinHistory]);

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

  const activeChartData = checkinChartMode === "week" ? weeklyCheckinData : todayCheckinData;
  const hasActiveChartData = activeChartData.some(
    (point) => point.humorY !== null || point.energiaY !== null,
  );

  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [homeAiMsg, setHomeAiMsg] = useState<HomeAiMsg | null>(null);
  const [homeAiLoading, setHomeAiLoading] = useState(true);
  const previousHomeAiMsgRef = useRef<HomeAiMsg | null>(null);
  const lastHomeAiRequestKeyRef = useRef<string | null>(null);
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
            taskCount: state.tasks.length,
            pendingTaskTitles,
            goals: goalTitles,
            hour: dayContext.hour,
            partOfDay: dayContext.partOfDay,
            weekday: dayContext.weekday,
            localDate: dayContext.localDate,
            moodCycleContext: cycleReport.aiContext,
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
    mood.label,
    pendingTaskTitles,
    refreshBucket,
    state.mood,
    state.tasks.length,
  ]);

  // Mensagem motivacional — apenas IA
  const motivacionalFinal = homeAiMsg?.motivacional ?? null;
  // Autocuidado — apenas IA
  const autocuidadoFinal = homeAiMsg?.autocuidado ?? null;

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
        const res = await api.post("/ai/suggest", {
          type: "agenda-blocks",
          context: {
            mood: state.mood,
            moodLabel: mood.label,
            energia: state.energia,
            history: (state.checkinHistory || []).slice(0, 3),
            moodCycleContext: cycleReport.aiContext,
            goals: goalTitles,
            pendingTaskTitles,
            hour: dayContext.hour,
            partOfDay: dayContext.partOfDay,
            weekday: dayContext.weekday,
            localDate: dayContext.localDate,
            previousAgendaLabels: previousAgendaContext.previousLabels,
            previousAgendaTasks: previousAgendaContext.previousTasks,
            previousAutocuidado: previousHomeContext.previousAutocuidado,
            requestVariant: agendaRequestCountRef.current,
          },
        });
      const parsed = parseAiSuggestion<AgendaBlock[]>(res.suggestion);
      const normalizedBlocks = dedupeAgendaBlocks(Array.isArray(parsed) ? parsed : []);
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
    const toCreate: Array<{ title: string; startTime: string; endTime: string; category: string; intensity: "M" }> = [];
    const savedKeys = new Set<string>();
    const seenTitles = new Set<string>();

    agendaBlocks.forEach((block, blockIndex) => {
      if (SKIP_TYPES.has(block.tipo)) return;
      const cfg = BLOCK_CONFIG[block.tipo] ?? BLOCK_CONFIG.flexivel;
      const startMin = timeToMinutes(block.horario_inicio);
      const endMin = timeToMinutes(block.horario_fim);
      const tasks = block.tarefas_sugeridas.filter((_, taskIndex) => selectedAgendaTaskKeys.has(agendaTaskKey(blockIndex, taskIndex)));
      if (tasks.length === 0) return;
      const totalDuration = Math.max(endMin - startMin, tasks.length * 20);
      const duration = Math.max(15, Math.floor(totalDuration / tasks.length));
      tasks.forEach((title, i) => {
        const normalizedTitle = title.trim().toLowerCase();
        if (!normalizedTitle || seenTitles.has(normalizedTitle)) return;
        seenTitles.add(normalizedTitle);
        const taskIndex = block.tarefas_sugeridas.findIndex((task) => task === title);
        if (taskIndex >= 0) {
          savedKeys.add(agendaTaskKey(blockIndex, taskIndex));
        }
        const itemStart = startMin + i * duration;
        toCreate.push({
          title,
          startTime: minutesToTime(itemStart),
          endTime: minutesToTime(itemStart + duration),
          category: cfg.category,
          intensity: "M",
        });
      });
    });

    if (toCreate.length === 0) {
      showError("Selecione pelo menos uma sugestao para entrar no planner.");
      return;
    }

    setAgendaSaving(true);
    try {
      await api.post("/timeline", {
        date: today,
        forceSave: true,
        blocks: toCreate,
      });
      await refreshData();
      setSavedAgendaTaskKeys(savedKeys);
      setAgendaPhase("approved");
      showSuccess(`${toCreate.length} sugest${toCreate.length > 1 ? "oes foram" : "ao foi"} adicionada${toCreate.length > 1 ? "s" : ""} ao planner.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel enviar a agenda ao planner.");
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

  async function handleQuickHabitAdd(suggestion: HabitSuggestion) {
    try {
      await addHabit({
        title: suggestion.title,
        category: suggestion.category,
        frequency: "daily",
        icon: suggestion.icon,
        timeOfDay: suggestion.timeOfDay,
        durationMinutes: suggestion.durationMinutes,
      });
      showSuccess(`"${suggestion.title}" entrou nos seus hábitos.`);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel adicionar o habito.");
      return false;
    }
  }

  async function handleManualHabitAdd({ title, icon }: { title: string; icon: string }) {
    try {
      await addHabit({
        title,
        category: "geral",
        frequency: "daily",
        icon,
        timeOfDay: "anytime",
      });
      showSuccess(`"${title}" foi criado com sucesso.`);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel criar o habito.");
      return false;
    }
  }

  const nextTask = state.tasks.find((t) => !t.done) ?? state.tasks[0];
  const selectedAgendaCount = selectedAgendaTaskKeys.size;
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
        tone: overdueTasks.length >= 3 ? "critical" : "warning",
        actionLabel: "Abrir planner",
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
        tone: "warning",
        actionLabel: "Ver metas",
        actionPath: "/goals",
      });
    }

    if (cycleReport.warningFlags.includes("sustained_low") || cycleReport.warningFlags.includes("rapid_drop") || cycleReport.stabilityScore <= 35) {
      const sustainedLow = cycleReport.warningFlags.includes("sustained_low");
      const rapidDrop = cycleReport.warningFlags.includes("rapid_drop");
      alerts.push({
        key: "mood-risk",
        title: sustainedLow
          ? "Seu humor está caindo há vários dias"
          : rapidDrop
            ? "Houve uma queda brusca no humor"
            : "Sua estabilidade ficou baixa",
        description: sustainedLow
          ? "O padrão recente sugere risco de aprofundamento do rebaixamento. Vale registrar isso no diário e diminuir a carga de hoje."
          : rapidDrop
            ? "A mudança nas últimas 48h pede proteção de energia e leitura mais cuidadosa do que está pesando agora."
            : "Seu ciclo entrou em zona de atenção. Quanto antes você reduzir atrito, menor a chance de afundar o resto da semana.",
        tone: sustainedLow || cycleReport.stabilityScore <= 30 ? "critical" : "warning",
        actionLabel: "Abrir diário",
        actionPath: "/journal",
      });
    }

    if (hasCompulsionSignal) {
      alerts.push({
        key: "compulsion-signal",
        title: "A Aura percebeu sinal de impulso ou compulsão",
        description: "O padrão recente sugere comportamento mais automático do que o normal. Vale pausar estímulos e nomear isso no diário antes de agir.",
        tone: "critical",
        actionLabel: "Registrar agora",
        actionPath: "/journal",
      });
    }

    return alerts.slice(0, 4);
  }, [
    clockTime,
    cycleReport.stabilityScore,
    cycleReport.warningFlags,
    state.autonomousInsight?.insight,
    state.autonomousInsight?.pattern,
    state.goals,
    state.tasks,
  ]);
  const displayName = state.name
    ? state.name.split(/\s+/)[0].charAt(0).toUpperCase() + state.name.split(/\s+/)[0].slice(1).toLowerCase()
    : "você";

  return (
    <>
    <OnboardingTour />
    <div ref={containerRef as React.RefObject<HTMLDivElement>} style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className={`pull-indicator${isReady ? " ready" : ""}`} style={{ height: isRefreshing ? 44 : pullDistance, overflow: "hidden" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.54" />
          </svg>
          {isRefreshing ? "Atualizando..." : isReady ? "Solte para atualizar" : "Puxe para atualizar"}
        </div>
      )}
      <div className="screen-content">

        {/* Header com relógio */}
        <div className="home-header" style={{ position: "relative", paddingBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p className="home-header-eyebrow">
                {getGreetingEmoji(clockTime.getHours())} {getGreeting(clockTime.getHours())},
              </p>
              <h1 style={{ marginBottom: 4 }}>{displayName}</h1>
              <p style={{ fontSize: "11px", color: "var(--text-2)", margin: 0 }}>
                {getFormattedDate(clockTime)}
              </p>
            </div>
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
                {String(clockTime.getHours()).padStart(2,"0")}:{String(clockTime.getMinutes()).padStart(2,"0")}
                <span style={{ fontSize: "13px", opacity: 0.8 }}>:{String(clockTime.getSeconds()).padStart(2,"0")}</span>
              </p>
            </div>
          </div>
          {/* State chip */}
          <div style={{
            marginTop: "12px",
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,.72)",
            border: "1px solid rgba(17,24,39,.05)",
            borderRadius: 999, padding: "5px 14px",
            boxShadow: "0 8px 14px rgba(17,24,39,.04)",
          }}>
            <span style={{ fontSize: 13 }}>{mood.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-peach-ink)" }}>{mood.chipLabel}</span>
          </div>
        </div>

        {/* ── Gráfico de check-ins ── */}
        <div className="mini-chart-area">
          <div className="chart-header" style={{ alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <TrendingUp size={13} color="var(--horizon)" />
              <div>
                <span className="chart-title">Humor e energia</span>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--text-3)" }}>
                  {checkinChartMode === "week"
                    ? "Média diária dos últimos 7 dias"
                    : todayCheckinData.length > 0
                      ? `${todayCheckinData.length} check-in${todayCheckinData.length > 1 ? "s" : ""} hoje`
                      : "Hoje ainda não há check-ins registrados"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", padding: 3, borderRadius: 999, background: "rgba(255,255,255,.82)", border: "1px solid var(--warm-border)" }}>
                {[
                  { id: "week", label: "Semana", disabled: false },
                  { id: "day", label: "Hoje", disabled: false },
                ].map((option) => {
                  const active = checkinChartMode === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => !option.disabled && setCheckinChartMode(option.id as "week" | "day")}
                      disabled={option.disabled}
                      style={{
                        border: "none",
                        background: active ? "var(--accent-peach)" : "transparent",
                        color: active ? "#fff" : "var(--text-2)",
                        opacity: option.disabled ? 0.45 : 1,
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: option.disabled ? "default" : "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
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

          {!hasActiveChartData ? (
            <div style={{
              height: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              color: "var(--text-3)", fontSize: "0.82rem",
            }}>
              <span style={{ fontSize: 20 }}>{checkinChartMode === "day" ? "🌅" : "📊"}</span>
              <span style={{ fontStyle: "italic" }}>
                {checkinChartMode === "day"
                  ? "Nenhum check-in hoje ainda — faça o de hoje!"
                  : "Faça seu primeiro check-in para ver o gráfico"}
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
                  </div>
                ))}
              </div>
            </>
          )}

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

        {/* ── CARD: Ciclo de Humor (identidade central do app) ── */}
        <div className="home-cycle-card" style={{ border: `1.5px solid ${phaseColor}30` }}>
          {/* Faixa colorida lateral */}
          <div className="home-cycle-rail" style={{ background: phaseColor }} />
          <div className="home-cycle-content">
            {/* Header do card */}
            <div className="home-cycle-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="home-cycle-kicker">
                  CICLO DE HUMOR
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Score de estabilidade */}
                <span className="home-cycle-score" style={{ background: `${phaseColor}18`, color: phaseColor }}>
                  {getStabilityLabel(cycleReport.stabilityScore)} · {cycleReport.stabilityScore}/100
                </span>
              </div>
            </div>

            {/* Fase atual */}
            <div className="home-cycle-phase">
              <span className="home-cycle-emoji">{cycleReport.phaseEmoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p className="home-cycle-title" style={{ margin: 0 }}>
                    {cycleReport.phaseLabel}
                  </p>
                  {streak >= 2 && (
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "2px 8px",
                      borderRadius: "999px", background: "var(--accent-peach)",
                      color: "#fff", letterSpacing: ".04em", flexShrink: 0,
                    }}>
                      🔥 {streak} dias
                    </span>
                  )}
                </div>
                {cycleReport.phase !== "insufficient_data" && (
                  <p className="home-cycle-subtitle">
                    {cycleReport.daysInPhase} dia{cycleReport.daysInPhase !== 1 ? "s" : ""} nesta fase
                    {cycleReport.cycleEstimate.estimatedLengthDays
                      ? ` · ciclo estimado: ~${cycleReport.cycleEstimate.estimatedLengthDays}d`
                      : ""}
                  </p>
                )}
              </div>
            </div>

            <p className="home-cycle-copy">
              {cycleReport.phaseDescription}
            </p>

            {/* Barra de métricas */}
            {cycleReport.phase !== "insufficient_data" && (
              <div className="home-cycle-metrics">
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

            {/* ── 7.4 Score de consistência ── */}
            {cycleReport.phase !== "insufficient_data" && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 10,
                background: "rgba(255,255,255,.5)", border: "1px solid rgba(0,0,0,.06)",
                marginBottom: 8,
              }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 1px" }}>
                    Consistência semanal
                  </p>
                  <div style={{ height: 4, width: 80, borderRadius: 999, background: "rgba(0,0,0,.08)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999, transition: "width .6s ease",
                      width: `${consistencyScore}%`,
                      background: consistencyScore >= 70 ? "var(--accent-sage)" : consistencyScore >= 40 ? "var(--accent-sky)" : "var(--accent-peach)",
                    }} />
                  </div>
                </div>
                <span style={{
                  fontSize: 18, fontWeight: 800,
                  color: consistencyScore >= 70 ? "var(--accent-sage)" : consistencyScore >= 40 ? "var(--accent-sky)" : "var(--accent-peach)",
                }}>
                  {consistencyScore}<span style={{ fontSize: 10, fontWeight: 400 }}>/100</span>
                </span>
              </div>
            )}


            {/* Dica da fase */}
            <div className="home-cycle-tip" style={{ background: `${phaseColor}10`, border: `1px solid ${phaseColor}20` }}>
              <p className="home-cycle-tip-text">
                💡 {cycleReport.phaseTip}
              </p>
            </div>

            {/* Warning flags */}
            {cycleReport.warningFlags.includes("sustained_low") && (
              <div className="home-cycle-warning">
                <p className="home-cycle-warning-text">
                  ⚠️ 5+ dias em fase baixa detectados. Considere conversar com um profissional de saúde.
                </p>
              </div>
            )}
            {cycleReport.warningFlags.includes("rapid_drop") && (
              <div className="home-cycle-warning">
                <p className="home-cycle-warning-text">
                  ⚠️ Queda brusca de humor nas últimas 48h detectada.
                </p>
              </div>
            )}

            {/* Previsão de energia */}
            {cycleReport.phase !== "insufficient_data" && (
              <div className="home-cycle-forecast">
                <p className="home-cycle-forecast-label">Previsao de energia hoje</p>
                <span className="home-cycle-forecast-pill" style={{ background: `${phaseColor}18`, color: phaseColor }}>
                  {cycleReport.energyForecastLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Previsão de Humor — próximos 7 dias ── */}
        {moodForecast.length === 7 && (() => {
          const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
          const today = new Date();

          // ── Escala automática: amplifica diferenças sutis ──
          const W = 300, H = 130, PX = 22, PY = 14;
          // Área do gráfico: reserva 36px no fundo p/ dia do mês + nome do dia + score
          const BOTTOM_RESERVE = 36;
          const h = H - PY - BOTTOM_RESERVE;
          const rawMin = Math.min(...moodForecast);
          const rawMax = Math.max(...moodForecast);
          const padding = Math.max(0.6, (rawMax - rawMin) * 0.3); // mínimo 0.6 de margem
          const scaleMin = Math.max(1,  rawMin - padding);
          const scaleMax = Math.min(10, rawMax + padding);
          const range = scaleMax - scaleMin || 1;
          const toX = (i: number) => PX + (i / 6) * (W - PX * 2);
          const toY = (v: number) => PY + h - ((v - scaleMin) / range) * h;

          const areaPath = moodForecast.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')
            + ` L${toX(6).toFixed(1)} ${(PY + h).toFixed(1)} L${toX(0).toFixed(1)} ${(PY + h).toFixed(1)} Z`;
          // Curva suave (bezier cúbico)
          const linePath = moodForecast.reduce((acc, v, i) => {
            const x = toX(i), y = toY(v);
            if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
            const px = toX(i - 1), py = toY(moodForecast[i - 1]);
            const cp = (x - px) * 0.45;
            return `${acc} C${(px + cp).toFixed(1)} ${py.toFixed(1)} ${(x - cp).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }, '');

          return (
            <div style={{
              borderRadius: 18, border: "1.5px solid var(--warm-border)",
              background: "rgba(255,255,255,.70)", backdropFilter: "blur(16px)",
              padding: "16px", marginBottom: "calc(var(--a) * 1.2)",
            }}>
              {/* Cabeçalho + Abas */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 3px" }}>
                    {forecastTab === "forecast" ? "Como seu humor pode evoluir" : "Seu humor este mês"}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
                    {forecastTab === "forecast" ? "Previsão — próximos 7 dias" : "Histórico — últimos 30 dias"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {(["forecast", "monthly"] as const).map(tab => (
                    <button key={tab} onClick={() => setForecastTab(tab)} style={{
                      padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                      fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer",
                      border: forecastTab === tab ? "1.5px solid var(--accent-peach)" : "1.5px solid var(--warm-border-2)",
                      background: forecastTab === tab ? "var(--accent-peach)" : "rgba(255,255,255,.62)",
                      color: forecastTab === tab ? "#fff" : "var(--text-3)",
                      transition: "all 150ms",
                    }}>
                      {tab === "forecast" ? "7 dias" : "Mensal"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── ABA: PREVISÃO 7 DIAS ── */}
              {forecastTab === "forecast" && (
                <>
                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
                    {[0.2, 0.5, 0.8].map(pct => {
                      const v = scaleMin + pct * range;
                      return <line key={pct} x1={PX} x2={W - PX} y1={toY(v)} y2={toY(v)}
                        stroke="rgba(0,0,0,.055)" strokeWidth={0.7} strokeDasharray="3,3" />;
                    })}
                    <path d={areaPath} fill="rgba(99,152,169,.08)" />
                    <path d={linePath} fill="none" stroke="rgba(99,152,169,.45)" strokeWidth={2} strokeDasharray="6,3" strokeLinecap="round" strokeLinejoin="round" />
                    {moodForecast.map((val, i) => {
                      const x = toX(i), y = toY(val);
                      const d = new Date(today); d.setDate(today.getDate() + i + 1);
                      const dayName = DAY_NAMES[d.getDay()];
                      const isGood = val >= 7, isWarn = val < 4.5;
                      const emoji = isGood ? "😊" : isWarn ? "😔" : "😐";
                      const scoreColor = isGood ? "var(--accent-sage)" : isWarn ? "var(--accent-peach)" : "var(--accent-sky)";
                      return (
                        <g key={i}>
                          <text x={x} y={y + 6} textAnchor="middle" fontSize={15} style={{ userSelect: "none" }}>{emoji}</text>
                          <text x={x} y={y + 20} textAnchor="middle" fontSize={8.5} fill={scoreColor}
                            fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{val.toFixed(1)}</text>
                          <text x={x} y={H - 12} textAnchor="middle" fontSize={9} fill="var(--text-2)"
                            fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{d.getDate()}</text>
                          <text x={x} y={H - 2} textAnchor="middle" fontSize={7.5} fill="var(--text-3)"
                            fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">{dayName}</text>
                        </g>
                      );
                    })}
                  </svg>
                  <div style={{ display: "flex", gap: 14, marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    {[
                      { emoji: "😊", label: "Bom", color: "var(--accent-sage)" },
                      { emoji: "😐", label: "Estável", color: "var(--accent-sky)" },
                      { emoji: "😔", label: "Atenção", color: "var(--accent-peach)" },
                    ].map(l => (
                      <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: l.color, fontWeight: 700 }}>
                        {l.emoji} {l.label}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: "var(--text-3)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                    Baseado no seu padrão de humor. Quanto mais check-ins, mais preciso.
                  </p>
                </>
              )}

              {/* ── ABA: MENSAL ── */}
              {forecastTab === "monthly" && (() => {
                if (monthlyHistory.length === 0) {
                  return (
                    <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 20 }}>📊</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>Sem dados nos últimos 30 dias ainda.</span>
                    </div>
                  );
                }

                const MW = 300, MH = 130, MPX = 22, MPY = 14, MBOT = 28;
                const mh = MH - MPY - MBOT;
                const n = monthlyHistory.length;
                const mxToX = (i: number) => MPX + (n > 1 ? (i / (n - 1)) : 0.5) * (MW - MPX * 2);
                const mVals = monthlyHistory.map(e => e.humor);
                const mRawMin = Math.min(...mVals), mRawMax = Math.max(...mVals);
                const mPad = Math.max(0.6, (mRawMax - mRawMin) * 0.25);
                const mMin = Math.max(1, mRawMin - mPad), mMax = Math.min(10, mRawMax + mPad);
                const mRange = mMax - mMin || 1;
                const mToY = (v: number) => MPY + mh - ((v - mMin) / mRange) * mh;

                // Curva bezier
                const mLine = monthlyHistory.reduce((acc, e, i) => {
                  const x = mxToX(i), y = mToY(e.humor);
                  if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
                  const px = mxToX(i - 1), py = mToY(monthlyHistory[i - 1].humor);
                  const cp = (x - px) * 0.45;
                  return `${acc} C${(px + cp).toFixed(1)} ${py.toFixed(1)} ${(x - cp).toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
                }, '');
                const mArea = mLine
                  + ` L${mxToX(n - 1).toFixed(1)} ${(MPY + mh).toFixed(1)} L${mxToX(0).toFixed(1)} ${(MPY + mh).toFixed(1)} Z`;

                // Pontos-chave: máximo, mínimo, hoje (último)
                const maxIdx = mVals.indexOf(mRawMax);
                const minIdx = mVals.indexOf(mRawMin);
                const lastIdx = n - 1;
                const keyIdxs = new Set([maxIdx, minIdx, lastIdx]);

                // Ticks de data: a cada ~7 pontos
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
                      <path d={mLine} fill="none" stroke="var(--accent-sage)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />

                      {/* Todos os pontos — pequeno círculo */}
                      {monthlyHistory.map((e, i) => {
                        const x = mxToX(i), y = mToY(e.humor);
                        const isKey = keyIdxs.has(i);
                        const isGood = e.humor >= 7, isWarn = e.humor < 4.5;
                        const dotColor = isGood ? "var(--accent-sage)" : isWarn ? "var(--accent-peach)" : "var(--accent-sky)";
                        return (
                          <circle key={i} cx={x} cy={y} r={isKey ? 0 : 2.5}
                            fill={dotColor} stroke="white" strokeWidth={isKey ? 0 : 1} opacity={0.8} />
                        );
                      })}

                      {/* Pontos-chave: emoji + score */}
                      {monthlyHistory.map((e, i) => {
                        if (!keyIdxs.has(i)) return null;
                        const x = mxToX(i), y = mToY(e.humor);
                        const isGood = e.humor >= 7, isWarn = e.humor < 4.5;
                        const emoji = isGood ? "😊" : isWarn ? "😔" : "😐";
                        const scoreColor = isGood ? "var(--accent-sage)" : isWarn ? "var(--accent-peach)" : "var(--accent-sky)";
                        return (
                          <g key={`key-${i}`}>
                            <text x={x} y={y + 6} textAnchor="middle" fontSize={15} style={{ userSelect: "none" }}>{emoji}</text>
                            <text x={x} y={y + 20} textAnchor="middle" fontSize={8.5} fill={scoreColor}
                              fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{e.humor.toFixed(1)}</text>
                          </g>
                        );
                      })}

                      {/* Ticks de data na base */}
                      {tickIdxs.map(i => {
                        const x = mxToX(i);
                        const dt = new Date(monthlyHistory[i].date + "T12:00:00");
                        return (
                          <g key={`tick-${i}`}>
                            <text x={x} y={MH - 12} textAnchor="middle" fontSize={9} fill="var(--text-2)"
                              fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">{dt.getDate()}</text>
                            <text x={x} y={MH - 2} textAnchor="middle" fontSize={7.5} fill="var(--text-3)"
                              fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">{DAY_NAMES[dt.getDay()]}</text>
                          </g>
                        );
                      })}
                    </svg>

                    <div style={{ display: "flex", gap: 14, marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      {[
                        { emoji: "😊", label: "Bom", color: "var(--accent-sage)" },
                        { emoji: "😐", label: "Estável", color: "var(--accent-sky)" },
                        { emoji: "😔", label: "Atenção", color: "var(--accent-peach)" },
                      ].map(l => (
                        <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: l.color, fontWeight: 700 }}>
                          {l.emoji} {l.label}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-3)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                      {n} check-in{n !== 1 ? "s" : ""} registrado{n !== 1 ? "s" : ""} nos últimos 30 dias.
                    </p>
                  </>
                );
              })()}
            </div>
          );
        })()}

        {/* ── Acesso Rápido ── */}
        <p className="aura-section-kicker">Acesso rapido</p>
        <div className="shortcut-grid">
          <button className="shortcut-card" onClick={() => navigate("/journal")}>
            <div className="icon-badge" style={{ background: "rgba(var(--terracotta-rgb), 0.15)" }}>
              <MessageSquareText size={18} color="var(--terracotta)" />
            </div>
            <span className="shortcut-label">Diário</span>
            <span className="shortcut-sub">Falar com IA</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/planner")}>
            <div className="icon-badge" style={{ background: "rgba(var(--horizon-rgb), 0.15)" }}>
              <LayoutDashboard size={18} color="var(--horizon)" />
            </div>
            <span className="shortcut-label">Planner</span>
            <span className="shortcut-sub">Organizar</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/insights")}>
            <div className="icon-badge" style={{ background: "rgba(var(--atomic-tangerine-rgb), 0.15)" }}>
              <Activity size={18} color="var(--atomic-tangerine)" />
            </div>
            <span className="shortcut-label">Padrões</span>
            <span className="shortcut-sub">Harmonia</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/goals")}>
            <div className="icon-badge" style={{ background: "rgba(var(--sweet-mint-rgb), 0.15)" }}>
              <Target size={18} color="var(--sweet-mint)" />
            </div>
            <span className="shortcut-label">Objetivos</span>
            <span className="shortcut-sub">Suas metas</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/pomodoro")}>
            <div className="icon-badge" style={{ background: "rgba(var(--terracotta-rgb), 0.1)" }}>
              <Timer size={18} color="var(--terracotta)" />
            </div>
            <span className="shortcut-label">Pomodoro</span>
            <span className="shortcut-sub">Foco</span>
          </button>
          <button className="shortcut-card" onClick={() => setShowHabitIdeasModal(true)}>
            <div className="icon-badge" style={{ background: "rgba(150,199,179,.18)" }}>
              <Sparkles size={18} color="var(--accent-sage)" />
            </div>
            <span className="shortcut-label">Hábitos</span>
            <span className="shortcut-sub">Rituais</span>
          </button>
        </div>

        {/* ── Nudge proativo da Aura ──────────────────────────── */}
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
                  onClick={() => setProactiveNudge(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Card de Insight Autônomo da IA (#3 — urgente quando score < 40) ── */}
        {(() => {
          const ins = state.autonomousInsight;
          const hasInsight = Boolean(ins);
          const cfg = hasInsight ? (STATE_CONFIG[ins!.state] ?? STATE_CONFIG.stable) : STATE_CONFIG.stable;
          const score = hasInsight ? ins!.stabilityScore : 0;
          const isUrgent = hasInsight && score < 40;  // #3 — modo urgente

          return (
            <div className="home-ai-card" style={{
              border: hasInsight
                ? isUrgent ? `2px solid ${cfg.color}66` : `1.5px solid ${cfg.color}33`
                : `1.5px solid ${cfg.color}22`,
              background: hasInsight && isUrgent ? cfg.bg : "rgba(255,253,249,.97)",
              ...(hasInsight && isUrgent ? { boxShadow: `0 0 0 3px ${cfg.color}15` } : {}),
            }}>
              <div className="home-ai-card-header" style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}22` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 16, color: cfg.color }}>{hasInsight ? (isUrgent ? "🚨" : "♡") : "♡"}</span>
                  <div>
                    <p className="home-ai-card-title" style={{ color: cfg.color }}>
                      {hasInsight && isUrgent ? "ATENÇÃO — AURA DETECTOU" : "ANÁLISE E AUTONOMIA"}
                    </p>
                    <p className="home-ai-card-subtitle" style={{ color: cfg.color }}>
                      {hasInsight ? (
                        <>
                          Estabilidade {score}% · {cfg.label}
                          {isUrgent && <span style={{ color: cfg.color, fontWeight: 800 }}> · Precisa de cuidado agora</span>}
                        </>
                      ) : (
                        "Espaço reservado para a leitura autônoma da Aura"
                      )}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                      <span
                        className="aura-chip"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "rgba(255,255,255,.72)",
                          border: `1px solid ${cfg.color}44`,
                          color: cfg.color,
                        }}
                      >
                        <span style={{ fontSize: 12 }}>{mood.emoji}</span>
                        {mood.label}
                      </span>
                      <span
                        className="aura-chip"
                        style={{
                          background: "rgba(255,255,255,.72)",
                          border: `1px solid ${cfg.color}44`,
                          color: cfg.color,
                        }}
                      >
                        {mood.chipLabel}
                      </span>
                    </div>
                  </div>
                </div>
                {hasInsight ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 48, height: 5, borderRadius: 999, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                      <div style={{ width: `${score}%`, height: "100%", borderRadius: 999, background: cfg.color }} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="home-ai-card-body">
                {hasInsight ? (
                  <>
                    <p className="home-ai-quote" style={isUrgent ? { fontSize: 13, fontWeight: 600, color: cfg.color } : {}}>
                      "{ins!.insight}"
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginBottom: ins!.actions.length > 0 ? 10 : 0 }}>
                      {ins!.pattern}
                    </p>

                    {ins!.actions.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                          PRÓXIMOS MOVIMENTOS SUGERIDOS
                        </p>
                        {ins!.actions.map((action, idx) => {
                          const added = addedActionIdx.has(idx);
                          return (
                            <div key={idx} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 10px", borderRadius: 9,
                              background: "var(--warm-bg)",
                              border: `1px solid ${cfg.color}30`,
                            }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{action.title}</p>
                                <p style={{ fontSize: 10, color: "var(--text-3)", margin: "1px 0 0" }}>{action.category} · {action.why}</p>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const saved = await addTask(action.title, "09:00", action.category, { forceSave: true });
                                    if (!saved) {
                                      throw new Error("A sugestao nao entrou no planner.");
                                    }
                                    setAddedActionIdx(prev => new Set([...prev, idx]));
                                    showSuccess("Sugestao adicionada ao planner.");
                                    const scheduledFor = new Date(Date.now() + 2 * 3600_000).toISOString();
                                    const followUp: FollowUpPending = {
                                      suggestionTitle: action.title,
                                      suggestionCategory: action.category,
                                      scheduledFor,
                                      response: null,
                                      followUpMessage: null,
                                      source: "autonomous",
                                    };
                                    setPendingFollowUp(followUp);
                                  } catch (error) {
                                    showError(error instanceof Error ? error.message : "Nao foi possivel salvar a sugestao no planner.");
                                  }
                                }}
                                disabled={added}
                                style={{
                                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                                  border: `1.5px solid ${added ? cfg.color : cfg.color + "60"}`,
                                  background: added ? cfg.color : "transparent",
                                  cursor: added ? "default" : "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                {added
                                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                }
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="home-ai-quote">
                      "Esse espaço continua reservado para a leitura autônoma da Aura."
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginBottom: 0 }}>
                      Assim que houver sinais suficientes, a análise e autonomia volta a aparecer aqui com o padrão detectado e os próximos movimentos sugeridos.
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Como está seu dia? ── */}
        <div className="aura-card" style={{ marginBottom: "calc(var(--a))", padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>♡</span>
            <p style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-peach-ink)", margin: 0 }}>Como está seu dia?</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Tarefas de hoje</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-sky)", background: "rgba(176,180,196,.1)", padding: "2px 10px", borderRadius: 999 }}>
                {totalTasks} planejada{totalTasks !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ height: 1, background: "var(--warm-border)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Concluídas</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-sage)", background: "rgba(180,185,169,.12)", padding: "2px 10px", borderRadius: 999 }}>
                {doneTasks} ✓
              </span>
            </div>
            <div style={{ height: 1, background: "var(--warm-border)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Em andamento</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-peach)", background: "var(--accent-peach-a3)", padding: "2px 10px", borderRadius: 999 }}>
                {pendingTasks}
              </span>
            </div>
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
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-peach-ink)", margin: 0 }}>Aura diz</p>
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

        {/* ── Momento de Autocuidado ── */}
        <div className="home-panel" style={{ border: "1.5px solid rgba(161,140,120,.25)" }}>
          <div className="home-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="home-panel-title" style={{ color: "var(--earth-11)" }}>
                  Cuidados para agora
                </p>
              {autocuidadoFinal && !homeAiLoading && (
                <span style={{ fontSize: 9, background: "rgba(161,140,120,.15)", color: "var(--earth-11)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
              )}
            </div>
            {!homeAiLoading && autocuidadoFinal && (
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0", fontStyle: "italic" }}>
                Leituras suaves para este momento:
              </p>
            )}
          </div>
          <div className="home-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {homeAiLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ height: 36, borderRadius: 9, background: "rgba(0,0,0,.04)", border: "1px solid rgba(161,140,120,.1)" }} />
              ))
            ) : autocuidadoFinal ? (
              autocuidadoFinal.map((item, i) => (
                <div key={i} className="home-soft-row" style={{ background: "var(--warm-bg)", border: "1px solid rgba(161,140,120,.2)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{item}</p>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
                Faça um check-in para receber sugestões de autocuidado personalizadas.
              </p>
            )}
          </div>
        </div>

        {/* ── Alertas Importantes ── */}
        {importantAlerts.length > 0 && (
          <div className="home-panel" style={{ border: "1.5px solid rgba(161,140,120,.3)" }}>
            <div className="home-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="home-panel-title" style={{ color: "var(--earth-11)" }}>
                  Alertas Importantes
                </p>
              </div>
            </div>
            <div className="home-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {importantAlerts.map((alert) => {
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Agenda por Blocos ── */}
        <div style={{ marginBottom: "calc(var(--a) * 1.2)" }}>
          {/* Header */}
          <div className="home-section-row">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
              <span className="section-title" style={{ fontSize: "14px" }}>Agenda do dia</span>
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
                Montar com IA
              </AuraButtonV2>
            )}
          </div>

          {agendaPhase === "idle" && null}

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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
                          {block.tarefas_sugeridas.map((t, ti) => (
                            <button
                              key={ti}
                              type="button"
                              onClick={() => agendaPhase === "preview" && toggleAgendaTaskSelection(idx, ti)}
                              style={{
                                fontSize: 10,
                                color: selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? cfg.cor : "var(--text-2)",
                                background: selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? `${cfg.cor}18` : cfg.bg,
                                border: `1px solid ${selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? cfg.cor + "70" : cfg.cor + "30"}`,
                                borderRadius: 6,
                                padding: "2px 7px",
                                cursor: agendaPhase === "preview" ? "pointer" : "default",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                opacity: agendaPhase === "approved" && !savedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? 0.45 : 1,
                              }}
                            >
                              {agendaPhase === "preview" && (
                                <span style={{ fontSize: 9 }}>
                                  {selectedAgendaTaskKeys.has(agendaTaskKey(idx, ti)) ? "✓" : "○"}
                                </span>
                              )}
                              {t}
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
                <div style={{ padding: "10px 13px", display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => { setAgendaPhase("idle"); setAgendaBlocks([]); setSelectedAgendaTaskKeys(new Set()); setSavedAgendaTaskKeys(new Set()); }}
                  >Refazer</button>
                  <AuraButtonV2 variant="primary" size="sm" style={{ flex: 2 }} onClick={approveAgenda} disabled={selectedAgendaCount === 0 || agendaSaving}>
                    {agendaSaving ? "Enviando..." : `Adicionar ${selectedAgendaCount > 0 ? selectedAgendaCount : ""} ao Planner`}
                  </AuraButtonV2>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Próximo na agenda */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <span className="section-title" style={{ fontSize: "14px" }}>
            Proximo na agenda
          </span>
          <button
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--accent-peach)",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => navigate("/planner")}
          >
            Ver tudo
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {nextTask ? (
          <div
            className="aura-card"
            style={{ padding: "12px 14px", cursor: "pointer" }}
            onClick={() => navigate("/planner", { state: { openTaskId: nextTask.id } })}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "3px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                {nextTask.time}
              </span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-1)",
              }}
            >
              {nextTask.title}
            </p>
            <div
              className="block-chip"
              style={{
                background: "rgba(176,180,196,.12)",
                color: "#4A7A8E",
                border: "1px solid rgba(176,180,196,.2)",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--accent-sky)",
                  display: "inline-block",
                }}
              />
              Trabalho
            </div>
          </div>
        ) : (
          <div className="aura-card" style={{ padding: "12px 14px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-3)" }}>
              Nenhuma tarefa pendente para hoje.
            </p>
          </div>
        )}
      </div>
      {showHabitIdeasModal && (
        <HabitIdeasModal
          onClose={() => setShowHabitIdeasModal(false)}
          onManualAdd={handleManualHabitAdd}
          onQuickAdd={handleQuickHabitAdd}
          onViewAll={() => {
            setShowHabitIdeasModal(false);
            navigate("/habits");
          }}
        />
      )}
    </div>
    </>
  );
}

