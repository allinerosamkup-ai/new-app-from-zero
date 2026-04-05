// Home Page v4 — babá digital IA + mensagens personalizadas + agenda por blocos
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import type { FollowUpPending } from "../features/aura/types";
import { api } from "../lib/api";
import { parseAiSuggestion, tryParseAiSuggestion } from "../lib/ai";
import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
import { useToast } from "../components/Toast";
import { computeMoodCycle, computeStreak, getPhaseColor, getStabilityLabel } from "../utils/mood-cycle-engine";
import { 
  MessageSquareText, 
  LayoutDashboard, 
  Activity, 
  Target, 
  Hexagon, 
  Timer,
  TrendingUp,
  MessageCircle,
  Plus
} from "lucide-react";
import "../styles/aura.css";

const STATE_CONFIG = {
  stable:  { emoji: "💚", label: "Estável",   color: "var(--menthe)",    bg: "rgba(180,185,169,.10)" },
  rising:  { emoji: "📈", label: "Subindo",   color: "var(--lagune)",    bg: "rgba(176,180,196,.10)"  },
  falling: { emoji: "📉", label: "Caindo",    color: "var(--nectarine)", bg: "rgba(197,165,147,.10)" },
  alert:   { emoji: "⚠️", label: "Atenção",   color: "#A17D6C",          bg: "rgba(161,125,108,.08)"  },
} as const;

type AiTask = { title: string; category: string; time?: string };

type AgendaBlock = {
  horario_inicio: string;
  horario_fim: string;
  tipo: "trabalho" | "autocuidado" | "casa" | "social" | "descanso" | "refeicao" | "flexivel";
  label: string;
  tarefas_sugeridas: string[];
  razao_ia: string;
};

const BLOCK_CONFIG: Record<string, { cor: string; bg: string; emoji: string; category: string }> = {
  trabalho:     { cor: "var(--lagune)",    bg: "rgba(176,180,196,.10)",    emoji: "💼", category: "trabalho" },
  autocuidado:  { cor: "var(--menthe)",   bg: "rgba(180,185,169,.10)",   emoji: "🌿", category: "autocuidado" },
  casa:         { cor: "var(--nectarine)", bg: "rgba(197,165,147,.10)",  emoji: "🏠", category: "rotina" },
  social:       { cor: "var(--social-color)", bg: "rgba(217,206,197,.10)", emoji: "🤝", category: "social" },
  descanso:     { cor: "var(--menthe)",   bg: "rgba(180,185,169,.08)",   emoji: "😴", category: "autocuidado" },
  refeicao:     { cor: "var(--nectarine)", bg: "rgba(197,165,147,.08)", emoji: "🍽️", category: "rotina" },
  flexivel:     { cor: "var(--lagune)",   bg: "rgba(176,180,196,.08)",    emoji: "✨", category: "pessoal" },
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

export function HomePage() {
  const { state, addTask, setPendingFollowUp, setProactiveNudge } = useAuraStore();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [addedActionIdx, setAddedActionIdx] = useState<Set<number>>(new Set());

  const [aiTasks, setAiTasks] = useState<AiTask[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTriggered, setAiTriggered] = useState(false);
  const [addedIdx, setAddedIdx] = useState<Set<number>>(new Set());

  // Agenda por blocos
  const [agendaPhase, setAgendaPhase] = useState<"idle" | "loading" | "preview" | "approved">("idle");
  const [agendaBlocks, setAgendaBlocks] = useState<AgendaBlock[]>([]);
  const [approvedBlockIds, setApprovedBlockIds] = useState<Set<number>>(new Set());

  const mood = moodMap[state.mood] ?? moodMap.equilibrada;

  // ── Motor de Ciclagem de Humor ────────────────────────────
  const cycleReport = useMemo(
    () => computeMoodCycle(state.checkinHistory || []),
    [state.checkinHistory]
  );
  const streak = useMemo(() => computeStreak(state.checkinHistory || []), [state.checkinHistory]);
  const phaseColor = getPhaseColor(cycleReport.phase);

  // ── Sparkline — últimos 7 dias reais ─────────────────────
  const sparklineData = useMemo(() => {
    const history = state.checkinHistory || [];
    const today = new Date();
    const X_START = 16, X_END = 264, Y_TOP = 12, Y_BOTTOM = 63;
    const X_STEP = (X_END - X_START) / 6;
    const Y_RANGE = Y_BOTTOM - Y_TOP;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = d.toISOString().split("T")[0];
      const entry = history.find(h => h.date === dateStr);
      const x = X_START + i * X_STEP;
      if (!entry) return { x, humorY: null, energiaY: null, isToday: i === 6 };
      return {
        x,
        humorY: Y_BOTTOM - ((entry.humor - 1) / 4) * Y_RANGE,
        energiaY: Y_BOTTOM - ((entry.energia - 1) / 4) * Y_RANGE,
        isToday: i === 6,
      };
    });
  }, [state.checkinHistory]);

  function buildSparkPath(getter: (p: typeof sparklineData[0]) => number | null): string {
    const valid = sparklineData
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

  const hasSparkData = sparklineData.some(p => p.humorY !== null);

  // Clock
  const [clockTime, setClockTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── AI Home Messages (babá digital) ──────────────────────
  type HomeAiMsg = {
    motivacional: string;
    autocuidado: string[];
    proactive: { emoji: string; title: string; desc: string; actionPath: string | null };
  };
  const [homeAiMsg, setHomeAiMsg] = useState<HomeAiMsg | null>(null);
  const [homeAiLoading, setHomeAiLoading] = useState(true);
  const homeMsgRan = useRef(false);
  const autoAiTasksRan = useRef(false);

  useEffect(() => {
    if (homeMsgRan.current) return;
    homeMsgRan.current = true;
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.post("/ai/suggest", {
          type: "home-messages",
          context: {
            mood: state.mood,
            moodLabel: mood.label,
            taskCount: state.tasks.length,
            hour: new Date().getHours(),
            moodCycleContext: cycleReport.aiContext,
          },
        });
        const parsed = tryParseAiSuggestion<HomeAiMsg>(res.suggestion);
        if (parsed?.motivacional && parsed?.autocuidado && parsed?.proactive) {
          setHomeAiMsg(parsed);
        }
      } catch {
        /* IA indisponível — sem fallback estático */
      } finally {
        setHomeAiLoading(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [cycleReport.aiContext]);

  // Proactive suggestion — apenas IA, sem fallback estático
  const proactive = homeAiMsg?.proactive
    ? {
        emoji: homeAiMsg.proactive.emoji,
        title: homeAiMsg.proactive.title,
        desc: homeAiMsg.proactive.desc,
        action: homeAiMsg.proactive.actionPath ?? null,
      }
    : null;

  // Mensagem motivacional — apenas IA
  const motivacionalFinal = homeAiMsg?.motivacional ?? null;
  // Autocuidado — apenas IA
  const autocuidadoFinal = homeAiMsg?.autocuidado ?? null;

  // Task stats
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter(t => t.done).length;
  const pendingTasks = state.tasks.filter(t => !t.done).length;

  useEffect(() => {
    if (autoAiTasksRan.current || homeAiLoading || aiTriggered || aiLoading) return;
    autoAiTasksRan.current = true;
    void loadAiTasks();
  }, [homeAiLoading, aiTriggered, aiLoading]);

  async function loadAiTasks() {
    if (aiLoading) return;
    setAiTriggered(true);
    setAiLoading(true);
    try {
      const res: any = await api.post('/ai/suggest', { 
        type: 'day-tasks', 
        context: { 
          mood: state.mood, 
          moodLabel: mood.label,
          moodCycleContext: cycleReport.aiContext,
        } 
      });
      const parsed = parseAiSuggestion<AiTask[]>(res.suggestion);
      if (Array.isArray(parsed)) setAiTasks(parsed.slice(0, 3));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel gerar sugestoes agora.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAddAiTask(task: AiTask, idx: number) {
    try {
      await addTask(task.title, task.time ?? "09:00", task.category);
      setAddedIdx(prev => new Set([...prev, idx]));
      showSuccess("Sugestao adicionada ao planner.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel adicionar a sugestao.");
    }
  }

  async function fetchAgenda() {
    setAgendaPhase("loading");
    try {
      const res = await api.post("/ai/suggest", {
        type: "agenda-blocks",
        context: {
          mood: state.mood,
          moodLabel: mood.label,
          energia: state.energia,
          history: (state.checkinHistory || []).slice(0, 3),
          moodCycleContext: cycleReport.aiContext,
        },
      });
      const parsed = parseAiSuggestion<AgendaBlock[]>(res.suggestion);
      setAgendaBlocks(Array.isArray(parsed) ? parsed : []);
      setAgendaPhase("preview");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel montar a agenda com IA.");
      setAgendaPhase("idle");
    }
  }

  async function approveAgenda() {
    const SKIP_TYPES = new Set(["descanso", "refeicao"]);
    const toCreate: Array<{ title: string; time: string; category: string }> = [];

    agendaBlocks.forEach((block) => {
      if (SKIP_TYPES.has(block.tipo)) return;
      const cfg = BLOCK_CONFIG[block.tipo] ?? BLOCK_CONFIG.flexivel;
      const startMin = timeToMinutes(block.horario_inicio);
      const endMin = timeToMinutes(block.horario_fim);
      const tasks = block.tarefas_sugeridas;
      if (tasks.length === 0) return;
      const duration = Math.round((endMin - startMin) / tasks.length);
      tasks.forEach((title, i) => {
        toCreate.push({ title, time: minutesToTime(startMin + i * duration), category: cfg.category });
      });
    });

    await Promise.all(toCreate.map((t) => addTask(t.title, t.time, t.category)));
    setApprovedBlockIds(new Set(agendaBlocks.map((_, i) => i)));
    setAgendaPhase("approved");
  }
  const nextTask = state.tasks.find((t) => !t.done) ?? state.tasks[0];
  const displayName = state.name
    ? state.name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : "você";

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--warm-bg)" }}>
      <div className="screen-content">

        {/* Header com relógio */}
        <div className="home-header" style={{ position: "relative", paddingBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p className="home-header-eyebrow">
                {getGreetingEmoji(clockTime.getHours())} {getGreeting(clockTime.getHours())},
              </p>
              <h1 style={{ marginBottom: 4 }}>{displayName}</h1>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,.75)", margin: 0 }}>
                {getFormattedDate(clockTime)}
              </p>
            </div>
            {/* Relógio */}
            <div style={{
              background: "rgba(255,255,255,.18)",
              borderRadius: "12px",
              padding: "10px 14px",
              textAlign: "center",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,.25)",
              minWidth: 90,
            }}>
              <p style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "22px",
                fontWeight: 800,
                color: "#fff",
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
            background: "rgba(255,255,255,.2)",
            border: "1px solid rgba(255,255,255,.3)",
            borderRadius: 999, padding: "5px 14px",
          }}>
            <span style={{ fontSize: 13 }}>{mood.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{mood.chipLabel}</span>
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
                      borderRadius: "999px", background: "var(--nectarine)",
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
                  { label: "Humor 7d", val: cycleReport.avgMood7d, color: "var(--menthe)" },
                  { label: "Energia 7d", val: cycleReport.avgEnergy7d, color: "var(--lagune)" },
                  ...(cycleReport.avgSleep7d ? [{ label: "Sono 7d", val: cycleReport.avgSleep7d, color: "var(--nectarine)" }] : []),
                ].map(m => (
                  <div key={m.label} className="home-cycle-metric">
                    <p className="home-cycle-metric-label">{m.label}</p>
                    <div className="home-cycle-metric-track">
                      <div className="home-cycle-metric-fill" style={{ background: m.color, width: `${(m.val / 5) * 100}%` }} />
                    </div>
                    <p className="home-cycle-metric-value" style={{ color: m.color }}>{m.val.toFixed(1)}</p>
                  </div>
                ))}
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

        {/* ── Nudge proativo da Aura ──────────────────────────── */}
        {state.proactiveNudge && (() => {
          const nudge = state.proactiveNudge!;
          const colorMap = {
            checkin_missing: "#F3B08C",
            goal_stagnant:   "var(--lagune)",
            inbox_overdue:   "var(--menthe)",
            weekly_review:   "var(--menthe)",
            phase_warning:   "var(--nectarine)",
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

        {/* Mini chart area */}
        <div className="mini-chart-area">
          <div className="chart-header">
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <TrendingUp size={13} color="var(--horizon)" />
              <span className="chart-title">Humor da Semana</span>
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

          {/* SVG sparkline — dados reais dos últimos 7 dias */}
          {!hasSparkData ? (
            <div style={{
              height: 72, display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-3)", fontSize: "0.82rem", fontStyle: "italic",
            }}>
              Faça seu primeiro check-in para ver o gráfico
            </div>
          ) : (
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

              {/* Grid horizontal */}
              {[12, 29, 46, 63].map(y => (
                <line key={y} x1="16" y1={y} x2="264" y2={y} stroke="rgba(0,0,0,.04)" strokeWidth="1" strokeDasharray="3,3" />
              ))}

              {/* Energia — linha tracejada */}
              {buildSparkPath(p => p.energiaY) && (
                <path
                  d={buildSparkPath(p => p.energiaY)}
                  fill="none"
                  stroke="var(--olive)"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  opacity={0.5}
                  strokeLinecap="round"
                />
              )}

              {/* Humor — área preenchida */}
              {buildSparkPath(p => p.humorY) && (
                <>
                  <path
                    d={buildSparkPath(p => p.humorY)}
                    fill="none"
                    stroke="url(#moodLineGradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {(() => {
                    const linePath = buildSparkPath(p => p.humorY);
                    const validPts = sparklineData.filter(p => p.humorY !== null);
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

              {/* Dots — só onde há dados */}
              {sparklineData.map((p, i) => {
                if (p.humorY === null) return null;
                return p.isToday ? (
                  <g key={i}>
                    <circle cx={p.x} cy={p.humorY} r="4.5" fill="var(--atomic-tangerine)" stroke="white" strokeWidth="2" />
                    <circle cx={p.x} cy={p.humorY} r="9" fill="none" stroke="var(--atomic-tangerine)" strokeWidth="1.5" opacity={0.35}>
                      <animate attributeName="r" values="9;14;9" dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values=".4;0;.4" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  </g>
                ) : (
                  <circle key={i} cx={p.x} cy={p.humorY} r="3.5" fill="var(--horizon)" stroke="white" strokeWidth="1.5" opacity={0.75} />
                );
              })}
            </svg>
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

        {/* Estado atual - card com gradiente */}
        <div
          className="aura-card"
          style={{
            marginBottom: "calc(var(--a))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "20px" }}>{mood.emoji}</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--primary)",
              }}
            >
              {mood.label}
            </span>
            <div className="aura-chip" style={{ marginLeft: "auto" }}>
              {mood.chipLabel}
            </div>
          </div>
          <p
            style={{
              fontSize: "12.5px",
              lineHeight: 1.6,
              color: "var(--text-2)",
              opacity: 0.85,
              marginBottom: "10px",
            }}
          >
            {mood.description}
          </p>
          <div className="aura-divider" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            <MessageCircle size={13} color="var(--primary)" />
            <span
              style={{
                fontSize: "11.5px",
                fontStyle: "italic",
                color: "var(--text-3)",
              }}
            >
              {mood.tip}
            </span>
          </div>
        </div>

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
            <span className="shortcut-sub">Ciclagem</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/goals")}>
            <div className="icon-badge" style={{ background: "rgba(var(--sweet-mint-rgb), 0.15)" }}>
              <Target size={18} color="var(--sweet-mint)" />
            </div>
            <span className="shortcut-label">Objetivos</span>
            <span className="shortcut-sub">Suas metas</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/harmony")}>
            <div className="icon-badge" style={{ background: "rgba(var(--horizon-rgb), 0.1)" }}>
              <Hexagon size={18} color="var(--horizon)" />
            </div>
            <span className="shortcut-label">Harmonia</span>
            <span className="shortcut-sub">Radar</span>
          </button>
          <button className="shortcut-card" onClick={() => navigate("/pomodoro")}>
            <div className="icon-badge" style={{ background: "rgba(var(--terracotta-rgb), 0.1)" }}>
              <Timer size={18} color="var(--terracotta)" />
            </div>
            <span className="shortcut-label">Pomodoro</span>
            <span className="shortcut-sub">Foco</span>
          </button>
        </div>

        {/* ── Card de Insight Autônomo da IA (#3 — urgente quando score < 40) ── */}
        {state.autonomousInsight && !insightDismissed && (() => {
          const ins = state.autonomousInsight!;
          const cfg = STATE_CONFIG[ins.state] ?? STATE_CONFIG.stable;
          const score = ins.stabilityScore;
          const isUrgent = score < 40;  // #3 — modo urgente

          return (
            <div className="home-ai-card" style={{
              border: isUrgent ? `2px solid ${cfg.color}66` : `1.5px solid ${cfg.color}33`,
              background: isUrgent ? cfg.bg : "rgba(255,253,249,.97)",
              ...(isUrgent ? { boxShadow: `0 0 0 3px ${cfg.color}15` } : {}),
            }}>
              {/* Header — urgente recebe badge vermelho */}
              <div className="home-ai-card-header" style={{ background: isUrgent ? `${cfg.bg}` : cfg.bg, borderBottom: `1px solid ${cfg.color}22` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 16 }}>{isUrgent ? "🚨" : cfg.emoji}</span>
                  <div>
                    <p className="home-ai-card-title" style={{ color: cfg.color }}>
                      {isUrgent ? "ATENÇÃO — AURA DETECTOU" : "ANÁLISE AUTÔNOMA DA IA"}
                    </p>
                    <p className="home-ai-card-subtitle">
                      Estabilidade {score}% · {cfg.label}
                      {isUrgent && <span style={{ color: cfg.color, fontWeight: 800 }}> · Precisa de cuidado agora</span>}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 48, height: 5, borderRadius: 999, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <div style={{ width: `${score}%`, height: "100%", borderRadius: 999, background: cfg.color }} />
                  </div>
                  <button
                    onClick={() => setInsightDismissed(true)}
                    style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(0,0,0,.08)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text-3)" }}
                  >✕</button>
                </div>
              </div>

              {/* Corpo */}
              <div className="home-ai-card-body">
                <p className="home-ai-quote" style={isUrgent ? { fontSize: 13, fontWeight: 600, color: cfg.color } : {}}>
                  "{ins.insight}"
                </p>
                <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginBottom: ins.actions.length > 0 ? 10 : 0 }}>
                  {ins.pattern}
                </p>

                {/* Ações sugeridas — aceitar schedula follow-up #7 */}
                {ins.actions.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
                      MICRO-AÇÕES BASEADAS EM EVIDÊNCIA
                    </p>
                    {ins.actions.map((action, idx) => {
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
                              await addTask(action.title, "09:00", action.category);
                              setAddedActionIdx(prev => new Set([...prev, idx]));
                              // #7 — schedula follow-up para 2h depois
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
              </div>
            </div>
          );
        })()}

        {/* ── Como está seu dia? ── */}
        <div className="aura-card" style={{ marginBottom: "calc(var(--a))", padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>♡</span>
            <p style={{ fontSize: 13, fontWeight: 800, color: "var(--nectarine-11)", margin: 0 }}>Como está seu dia?</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Tarefas de hoje</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--lagune)", background: "rgba(176,180,196,.1)", padding: "2px 10px", borderRadius: 999 }}>
                {totalTasks} planejada{totalTasks !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ height: 1, background: "var(--warm-border)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Concluídas</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--menthe)", background: "rgba(180,185,169,.12)", padding: "2px 10px", borderRadius: 999 }}>
                {doneTasks} ✓
              </span>
            </div>
            <div style={{ height: 1, background: "var(--warm-border)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Em andamento</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nectarine)", background: "var(--nectarine-a3)", padding: "2px 10px", borderRadius: 999 }}>
                {pendingTasks}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(197,165,147,.06)", borderRadius: 10, border: "1px solid var(--nectarine-a5)" }}>
            {homeAiLoading ? (
              <>
                <div style={{ height: 10, width: "40%", background: "var(--nectarine-a3)", borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 9, width: "90%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
                <div style={{ height: 9, width: "70%", background: "rgba(0,0,0,.05)", borderRadius: 5 }} />
              </>
            ) : motivacionalFinal ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--nectarine-11)", margin: 0 }}>Aura diz</p>
                  <span style={{ fontSize: 9, background: "var(--nectarine-a3)", color: "var(--nectarine-11)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
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

        {/* ── Pensei em você... ── */}
        <div className="home-panel" style={{ border: "1.5px solid var(--nectarine-a5)" }}>
          <div className="home-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--nectarine)", margin: 0 }}>
                Pensei em voce
              </p>
              {homeAiLoading && (
                <span style={{ fontSize: 9, color: "var(--text-3)", fontStyle: "italic" }}>gerando...</span>
              )}
              {proactive && !homeAiLoading && (
                <span style={{ fontSize: 9, background: "var(--nectarine-a3)", color: "var(--nectarine-11)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
              )}
            </div>
            {homeAiLoading ? (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--nectarine-a3)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 11, width: "60%", background: "rgba(0,0,0,.07)", borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 9, width: "95%", background: "rgba(0,0,0,.05)", borderRadius: 5, marginBottom: 5 }} />
                  <div style={{ height: 9, width: "75%", background: "rgba(0,0,0,.05)", borderRadius: 5 }} />
                </div>
              </div>
            ) : proactive ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{proactive.emoji}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", margin: "0 0 3px" }}>{proactive.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>{proactive.desc}</p>
                </div>
              </div>
              ) : (
              <p className="home-panel-subcopy" style={{ margin: 0 }}>
                Faça um check-in para receber uma sugestão personalizada.
              </p>
            )}
          </div>
          {proactive && !homeAiLoading && (
            <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
              <AuraButtonV2
                variant="primary"
                size="sm"
                onClick={() => proactive.action ? navigate(proactive.action) : undefined}
                leftIcon={<Plus size={14} />}
              >
                Vou tentar!
              </AuraButtonV2>
            </div>
          )}
          <div style={{ padding: "0 14px 10px" }}>
            <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0, fontStyle: "italic" }}>
              Sugestao gerada pela Aura com base no seu estado atual
            </p>
          </div>
        </div>

        {/* ── Momento de Autocuidado ── */}
        <div className="home-panel" style={{ border: "1.5px solid rgba(161,140,120,.25)" }}>
          <div className="home-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="home-panel-title" style={{ color: "var(--earth-11)" }}>
                  Momento de Autocuidado
                </p>
              {autocuidadoFinal && !homeAiLoading && (
                <span style={{ fontSize: 9, background: "rgba(161,140,120,.15)", color: "var(--earth-11)", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>IA</span>
              )}
            </div>
            {!homeAiLoading && autocuidadoFinal && (
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0", fontStyle: "italic" }}>
                Sugestões personalizadas para você agora:
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
        {state.autonomousInsight && state.autonomousInsight.actions.length > 0 && !insightDismissed && (
          <div className="home-panel" style={{ border: "1.5px solid rgba(161,140,120,.3)" }}>
            <div className="home-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p className="home-panel-title" style={{ color: "var(--earth-11)" }}>
                  Alertas Importantes
                </p>
              </div>
            </div>
            <div className="home-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {state.autonomousInsight.actions.map((action, i) => (
                <div key={i} className="home-soft-row" style={{ alignItems: "flex-start", background: "rgba(161,140,120,.06)", border: "1px solid rgba(161,140,120,.2)" }}>
                  <span style={{ fontSize: 13, flexShrink: 0, color: "var(--nectarine-11)" }}>!</span>
                  <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>{action.title}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}>
              <div style={{
                flex: 1, padding: "7px 12px", borderRadius: 9,
                background: "rgba(161,140,120,.06)", border: "1px solid var(--earth-a5)",
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--earth-11)", margin: "0 0 2px", letterSpacing: ".1em" }}>CRIADO PELA IA AUTONOMA</p>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0, lineHeight: 1.4 }}>
                  Esta análise foi criada automaticamente baseada no seu perfil e comportamento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Agenda por Blocos ── */}
        <div style={{ marginBottom: "calc(var(--a) * 1.2)" }}>
          {/* Header */}
          <div className="home-section-row">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--nectarine)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
              <span className="section-title" style={{ fontSize: "14px" }}>Agenda do dia</span>
            </div>
            {agendaPhase === "approved" && (
              <span style={{ fontSize: "11px", color: "var(--menthe)", fontWeight: 600 }}>✓ No Planner</span>
            )}
            {agendaPhase === "idle" && (
              <AuraButtonV2 variant="primary" size="sm" onClick={fetchAgenda}>
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
                const isApproved = approvedBlockIds.has(idx);
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
                        {isApproved && !isSkip && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: cfg.cor, background: cfg.bg, padding: "2px 6px", borderRadius: 999, border: `1px solid ${cfg.cor}40` }}>✓ salvo</span>
                        )}
                      </div>
                      {block.tarefas_sugeridas.length > 0 && !isSkip && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
                          {block.tarefas_sugeridas.map((t, ti) => (
                            <span key={ti} style={{
                              fontSize: 10, color: "var(--text-2)", background: cfg.bg,
                              border: `1px solid ${cfg.cor}30`, borderRadius: 6, padding: "2px 7px",
                            }}>{t}</span>
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
                    onClick={() => { setAgendaPhase("idle"); setAgendaBlocks([]); }}
                  >Refazer</button>
                  <AuraButtonV2 variant="primary" size="sm" style={{ flex: 2 }} onClick={approveAgenda}>
                    Aprovar e adicionar ao Planner
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
              color: "var(--nectarine)",
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--nectarine)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  background: "var(--lagune)",
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

        {/* Sugestões da IA — sempre visível */}
        <div style={{ marginTop: "calc(var(--a) * 1.2)" }}>
          <div className="home-section-row">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--nectarine)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="section-title" style={{ fontSize: "14px" }}>Sugestoes da IA</span>
            </div>
            {aiTasks.length > 0 && (
              <button
                onClick={() => { setAiTasks([]); setAiTriggered(false); }}
                style={{ background: "none", border: "none", fontSize: 11, color: "var(--text-3)", cursor: "pointer" }}
              >Atualizar</button>
            )}
          </div>

          {!aiTriggered && !aiLoading && aiTasks.length === 0 && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
              <AuraButtonV2 variant="primary" onClick={loadAiTasks}>
                Sugestões para hoje
              </AuraButtonV2>
            </div>
          )}

          {aiLoading && (
            <div style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "var(--text-3)", background: "rgba(255,253,249,.9)", borderRadius: 10, border: "1px solid var(--warm-border)" }}>
              <div className="aura-inline-spinner" style={{ margin: "0 auto 10px" }} />
              Gerando sugestões personalizadas...
            </div>
          )}

          {!aiLoading && aiTriggered && aiTasks.length === 0 && (
            <div style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "var(--text-3)", background: "rgba(255,253,249,.9)", borderRadius: 10, border: "1px solid var(--warm-border)" }}>
              Não foi possível gerar sugestões agora.{" "}
              <button onClick={loadAiTasks} style={{ background: "none", border: "none", color: "var(--nectarine)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Tentar novamente</button>
            </div>
          )}

          {aiTasks.map((task, idx) => (
            <div
              key={idx}
              className="aura-card"
              style={{ padding: "11px 14px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)", margin: 0 }}>{task.title}</p>
                {task.time && (
                  <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "2px 0 0" }}>{task.category} · {task.time}</p>
                )}
              </div>
              <button
                onClick={() => handleAddAiTask(task, idx)}
                disabled={addedIdx.has(idx)}
                style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  border: "1.5px solid var(--nectarine)", cursor: addedIdx.has(idx) ? "default" : "pointer",
                  background: addedIdx.has(idx) ? "var(--nectarine)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {addedIdx.has(idx) ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--nectarine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                )}
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
