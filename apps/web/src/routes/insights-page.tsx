import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
// Insights Page v3 — padrões da semana + card IA interativo
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { computeMoodCycle, getPhaseColor, getStabilityLabel } from "../utils/mood-cycle-engine";
import "../styles/aura.css";
import "../styles/aura-v2.css";

type AiInsight = { insight: string; action: string; category: string; actionTitle: string };
type InsightPhase = "idle" | "loading" | "done";
type WeeklyInsightsResponse = {
  insights: {
    aiAnalysis: string;
    recommendations: Array<{
      category: "planning" | "self-care" | "social";
      text: string;
      priority: "high" | "medium" | "low";
    }>;
  };
};

const CAT_COLOR: Record<string, string> = {
  energia: "var(--atomic-tangerine)",
  humor: "var(--sweet-mint)",
  rotina: "var(--atomic-tangerine)",
  autocuidado: "var(--sweet-mint)",
};

const STAT_ACCENT: Record<string, string> = {
  Humor: "var(--menthe)",
  Energia: "var(--lagune)",
  "Check-ins": "var(--nectarine)",
};

export function InsightsPage() {
  const { state, addTask } = useAuraStore();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();

  const [insightPhase, setInsightPhase] = useState<InsightPhase>("idle");
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [taskAdded, setTaskAdded] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  // Derive data from checkinHistory (fallback to empty if missing)
  const allHistory = state.checkinHistory || [];
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const history = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffIso = cutoff.toISOString().split('T')[0];
    return allHistory.filter(h => h.date >= cutoffIso);
  }, [allHistory, periodDays]);
  // #4 — CycleEstimate via MoodCycleEngine
  const cycleReport = useMemo(() => computeMoodCycle(history), [history]);
  const phaseColor = getPhaseColor(cycleReport.phase);
  const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Map history to chart data (last 7 entries, pad with zeros)
  const chartData = DAYS.map((_, dayIndex) => {
    const entry = history.find(h => {
      const d = new Date(h.date);
      return d.getDay() === dayIndex;
    });
    return {
      humor: entry ? (entry.humor / 5) * 100 : 0,
      energia: entry ? (entry.energia / 5) * 100 : 0,
      hasData: !!entry,
    };
  });

  // ── Padrões Preditivos — computação frontend ─────────────────
  const patterns = useMemo(() => {
    if (history.length < 3) return null;
    const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const groups: Record<number, { humor: number[]; energia: number[] }> = {};
    history.forEach(h => {
      const d = new Date(h.date + "T12:00:00").getDay();
      if (!groups[d]) groups[d] = { humor: [], energia: [] };
      groups[d].humor.push(h.humor);
      groups[d].energia.push(h.energia);
    });
    const dayAvgs = Object.entries(groups)
      .map(([d, v]) => ({
        day: DAYS[Number(d)], idx: Number(d),
        mood: v.humor.reduce((a, b) => a + b) / v.humor.length,
        energy: v.energia.reduce((a, b) => a + b) / v.energia.length,
        n: v.humor.length,
      }))
      .filter(d => d.n >= 1)
      .sort((a, b) => a.idx - b.idx);

    const bestDay  = dayAvgs.length > 0 ? [...dayAvgs].sort((a, b) => b.mood - a.mood)[0]  : null;
    const worstDay = dayAvgs.length > 1 ? [...dayAvgs].sort((a, b) => a.mood - b.mood)[0]  : null;

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (history.find(h => h.date === d.toISOString().split("T")[0])) streak++;
      else break;
    }

    const lowDays    = history.filter(h => h.humor <= 2).length;
    const highDays   = history.filter(h => h.humor >= 4).length;
    const stableDays = history.length - lowDays - highDays;
    const total      = history.length;

    // Correlation: check-in days have better mood?
    const checkinDaysAvg = history.length > 0
      ? history.reduce((s, h) => s + h.humor, 0) / history.length
      : 0;

    return { dayAvgs, bestDay, worstDay, streak, lowDays, highDays, stableDays, total, checkinDaysAvg };
  }, [history]);

  const avgHumorNum = history.length > 0
    ? history.reduce((s, h) => s + h.humor, 0) / history.length
    : 0;
  const avgEnergiaNum = history.length > 0
    ? history.reduce((s, h) => s + h.energia, 0) / history.length
    : 0;
  const avgHumor = history.length > 0 ? avgHumorNum.toFixed(1) : "—";
  const avgEnergia = history.length > 0 ? avgEnergiaNum.toFixed(1) : "—";
  const totalCheckins = String(history.length);
  const todayIndex = new Date().getDay();

  function getWeekStartIso() {
    const now = new Date();
    const weekStart = new Date(now);
    const day = now.getDay();
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    weekStart.setDate(now.getDate() + offsetToMonday);
    return weekStart.toISOString().slice(0, 10);
  }

  async function fetchInsight() {
    setInsightPhase("loading");
    try {
      const res = await api.get(`/insights/weekly?weekStart=${getWeekStartIso()}`) as WeeklyInsightsResponse;
      const topRecommendation = res.insights.recommendations[0];
      const categoryMap: Record<string, string> = {
        planning: "rotina",
        "self-care": "autocuidado",
        social: "social",
      };
      const parsed: AiInsight = {
        insight: res.insights.aiAnalysis,
        action: topRecommendation?.text ?? "Continue observando seu ritmo e escolha um pequeno passo para esta semana.",
        category: categoryMap[topRecommendation?.category ?? "planning"] ?? "rotina",
        actionTitle: topRecommendation?.text?.slice(0, 40) ?? "Revisar minha semana",
      };
      setAiInsight(parsed);
      setInsightPhase("done");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Nao foi possivel analisar os padroes.");
      setInsightPhase("idle");
    }
  }

  function applyAction() {
    if (!aiInsight) return;
    addTask(aiInsight.actionTitle, "09:00", aiInsight.category)
      .then(() => {
        setTaskAdded(true);
        showSuccess("Acao adicionada ao planner.");
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Nao foi possivel salvar a acao.");
      });
  }

  return (
    <div className="insights-page">
      <div className="screen-content">

        {/* ── Header ── */}
        <div className="aura-page-header insights-header">
          <p className="aura-page-kicker">Sua Ciclagem</p>
          <h1 className="aura-page-title insights-title">Padrões</h1>
          {/* Seletor de período */}
          <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
            {(['7d', '30d', '90d'] as const).map(p => {
              const label = p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias';
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                    fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer",
                    border: active ? "1.5px solid var(--nectarine)" : "1.5px solid var(--warm-border-2)",
                    background: active ? "var(--nectarine)" : "rgba(255,255,255,.62)",
                    color: active ? "#fff" : "var(--text-2)",
                    backdropFilter: "blur(14px)",
                    transition: "all 150ms",
                  }}
                >{label}</button>
              );
            })}
          </div>
        </div>

        {/* ── Bar chart card ── */}
        <div className="aura-card aura-card--chart insights-chart-card">
          <div className="insights-chart-heading">
            <span className="insights-chart-bullet" />
            <p className="insights-chart-label">Humor &amp; Energia</p>
          </div>

          <div className="insights-barchart">
            {DAYS.map((day, i) => {
              const active = todayIndex === i;
              const opacity = active ? 1.0 : (chartData[i].hasData ? 0.55 : 0.2);
              return (
                <div key={day} className="insights-bar-col">
                  <div className="insights-bar-pair">
                    <div
                      className={`insights-bar insights-bar-humor${active ? " insights-bar--active" : ""}`}
                      style={{ "--bar-h": `${chartData[i].humor}%`, "--bar-opacity": opacity } as React.CSSProperties}
                    />
                    <div
                      className={`insights-bar insights-bar-energia${active ? " insights-bar--active" : ""}`}
                      style={{ "--bar-h": `${chartData[i].energia}%`, "--bar-opacity": opacity } as React.CSSProperties}
                    />
                  </div>
                  <p className={`insights-bar-day${active ? " insights-bar-day--active" : ""}`}>
                    {day}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="insights-legend">
            <div className="insights-legend-item">
              <span className="insights-legend-dot insights-legend-dot--humor" />
              <span className="insights-legend-text">Humor</span>
            </div>
            <div className="insights-legend-item">
              <span className="insights-legend-dot insights-legend-dot--energia" />
              <span className="insights-legend-text">Energia</span>
            </div>
          </div>
        </div>

        {/* ── Stats row — 3 cards ── */}
        <div className="insights-stats-row">
          {[
            { value: avgHumor, label: "Humor" },
            { value: avgEnergia, label: "Energia" },
            { value: totalCheckins, label: "Check-ins" },
          ].map(({ value, label }) => (
            <div key={label} className="insights-stat-card">
              <span
                className="insights-stat-accent"
                style={{ "--stat-accent": STAT_ACCENT[label] } as React.CSSProperties}
              />
              <span className="insights-stat-label">{label}</span>
              <span className="insights-stat-value">{value}</span>
            </div>
          ))}
        </div>

        {/* ── #4: Ciclo de Humor — card com phase + cycleEstimate ── */}
        {cycleReport.phase !== "insufficient_data" && (
          <div style={{
            borderRadius: 16, border: `1.5px solid ${phaseColor}33`,
            background: "rgba(255,253,249,.97)",
            overflow: "hidden", marginBottom: "calc(var(--a))",
          }}>
            {/* Header com fase atual */}
            <div style={{
              padding: "12px 14px", borderBottom: `1px solid ${phaseColor}20`,
              background: `${phaseColor}10`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{cycleReport.phaseEmoji}</span>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: phaseColor, textTransform: "uppercase", letterSpacing: ".1em", margin: 0 }}>
                    CICLO DE HUMOR
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
                    {cycleReport.phaseLabel}
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3)", marginLeft: 6 }}>
                      {cycleReport.daysInPhase} dia{cycleReport.daysInPhase !== 1 ? "s" : ""} nesta fase
                    </span>
                  </p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: "0 0 2px" }}>Estabilidade</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: phaseColor, margin: 0 }}>
                  {cycleReport.stabilityScore}
                  <span style={{ fontSize: 11, fontWeight: 400 }}>/100</span>
                </p>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>{getStabilityLabel(cycleReport.stabilityScore)}</p>
              </div>
            </div>

            {/* Corpo — métricas + cycleEstimate */}
            <div style={{ padding: "12px 14px" }}>
              {/* Barra de progresso do ciclo estimado */}
              {cycleReport.cycleEstimate.hasEnoughData && cycleReport.cycleEstimate.estimatedLengthDays && cycleReport.cycleEstimate.currentDayInCycle !== null && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: 0 }}>
                      Dia {cycleReport.cycleEstimate.currentDayInCycle} do ciclo estimado
                    </p>
                    <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>
                      ~{cycleReport.cycleEstimate.estimatedLengthDays} dias
                    </p>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min(100, (cycleReport.cycleEstimate.currentDayInCycle / cycleReport.cycleEstimate.estimatedLengthDays) * 100)}%`,
                      height: "100%", borderRadius: 999, background: phaseColor,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              )}

              {/* Métricas 7d */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[
                  { label: "Humor 7d", val: cycleReport.avgMood7d, color: "var(--menthe)" },
                  { label: "Energia 7d", val: cycleReport.avgEnergy7d, color: "var(--lagune)" },
                  ...(cycleReport.avgSleep7d ? [{ label: "Sono 7d", val: cycleReport.avgSleep7d, color: "var(--nectarine)" }] : []),
                ].map(m => (
                  <div key={m.label} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: `${m.color}15`, border: `1px solid ${m.color}30`, textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-3)", margin: "0 0 2px" }}>{m.label}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: m.color, margin: 0 }}>
                      {m.val.toFixed(1)}<span style={{ fontSize: 9, fontWeight: 400 }}>/5</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Tip da fase */}
              <div style={{ padding: "8px 10px", borderRadius: 10, background: `${phaseColor}10`, border: `1px solid ${phaseColor}20` }}>
                <p style={{ fontSize: 11, color: phaseColor, margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
                  💡 {cycleReport.phaseTip}
                </p>
              </div>

              {/* Warning flags */}
              {cycleReport.warningFlags.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {cycleReport.warningFlags.map(flag => {
                    const FLAG_LABELS: Record<string, string> = {
                      high_volatility: "Alta volatilidade",
                      sustained_low: "Baixo sustentado",
                      rapid_drop: "Queda rápida",
                      sustained_elevated: "Elevado sustentado",
                      sleep_impact_high: "Impacto do sono",
                      low_checkin_frequency: "Poucos check-ins",
                    };
                    return (
                      <span key={flag} style={{
                        fontSize: 10, padding: "3px 8px", borderRadius: 999,
                        background: "rgba(215,137,127,.12)", color: "var(--nectarine)",
                        border: "1px solid rgba(215,137,127,.25)", fontWeight: 600,
                      }}>
                        ⚠ {FLAG_LABELS[flag] ?? flag}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Insight Card ── */}
        {insightPhase === "idle" && (
          <AuraButtonV2
            onClick={fetchInsight}
            className="btn btn-primary btn-full insights-cta-btn"
          >
            Analisar padrao
          </AuraButtonV2>
        )}

        {insightPhase === "loading" && (
          <div className="insights-loading-card">
            <div className="insights-loading-icon" />
            <p className="insights-loading-text">Lendo seus padrões da semana...</p>
          </div>
        )}

        {insightPhase === "done" && aiInsight && (() => {
          const cor = CAT_COLOR[aiInsight.category] ?? "var(--atomic-tangerine)";
          return (
            <div
              className="insights-ai-card"
              style={{ "--ai-cor": cor } as React.CSSProperties}
            >
              {/* insight header */}
              <div className="insights-ai-body">
                <p className="insights-ai-eyebrow">Padrao da semana</p>
                <p className="insights-ai-text">{aiInsight.insight}</p>
              </div>

              {/* action row */}
              <div className="insights-ai-action">
                <div className="insights-ai-action-content">
                  <p className="insights-ai-action-label">AÇÃO PARA A PRÓXIMA SEMANA</p>
                  <p className="insights-ai-action-text">{aiInsight.action}</p>
                </div>
                <button
                  className="insights-ai-save-btn"
                  onClick={applyAction}
                  disabled={taskAdded}
                >
                  {taskAdded ? "✓ Salvo" : "+ Planner"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Padrões Preditivos ──────────────────────────────── */}
        {patterns && (
          <div style={{
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            background: "rgba(255,255,255,0.62)",
            border: "1px solid rgba(255,255,255,0.80)",
            borderRadius: 18, padding: "14px",
            marginBottom: "calc(var(--a))",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 12px" }}>
              📊 Padrões Detectados
            </p>

            {/* Melhor / Pior dia */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {patterns.bestDay && (
                <div style={{ flex: 1, padding: "8px 10px", borderRadius: 12, background: "rgba(150,199,179,0.12)", border: "1px solid rgba(150,199,179,0.30)", textAlign: "center" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "var(--menthe)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Melhor dia</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--menthe)", margin: "0 0 1px" }}>{patterns.bestDay.day}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>humor {patterns.bestDay.mood.toFixed(1)}/5</p>
                </div>
              )}
              {patterns.worstDay && patterns.worstDay.day !== patterns.bestDay?.day && (
                <div style={{ flex: 1, padding: "8px 10px", borderRadius: 12, background: "rgba(215,137,127,0.08)", border: "1px solid rgba(215,137,127,0.25)", textAlign: "center" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "var(--nectarine)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Dia difícil</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--nectarine)", margin: "0 0 1px" }}>{patterns.worstDay.day}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>humor {patterns.worstDay.mood.toFixed(1)}/5</p>
                </div>
              )}
              <div style={{ flex: 1, padding: "8px 10px", borderRadius: 12, background: "rgba(99,152,169,0.10)", border: "1px solid rgba(99,152,169,0.25)", textAlign: "center" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--lagune)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Sequência</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: "var(--lagune)", margin: "0 0 1px" }}>{patterns.streak}</p>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>dias seguidos</p>
              </div>
            </div>

            {/* Distribuição de humor */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>Distribuição de humor ({patterns.total} registros)</p>
            <div style={{ display: "flex", gap: 4, height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              {patterns.highDays > 0 && (
                <div style={{ flex: patterns.highDays, background: "var(--menthe)", borderRadius: "999px 0 0 999px" }} />
              )}
              {patterns.stableDays > 0 && (
                <div style={{ flex: patterns.stableDays, background: "var(--lagune)" }} />
              )}
              {patterns.lowDays > 0 && (
                <div style={{ flex: patterns.lowDays, background: "var(--nectarine)", borderRadius: "0 999px 999px 0" }} />
              )}
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--text-3)" }}>
              <span>🟢 Alta: {Math.round((patterns.highDays / patterns.total) * 100)}%</span>
              <span>🔵 Estável: {Math.round((patterns.stableDays / patterns.total) * 100)}%</span>
              <span>🔴 Baixa: {Math.round((patterns.lowDays / patterns.total) * 100)}%</span>
            </div>

            {/* Insight preditivo */}
            {patterns.bestDay && patterns.worstDay && patterns.worstDay.day !== patterns.bestDay.day && (
              <div style={{
                marginTop: 12, padding: "8px 10px", borderRadius: 10,
                background: "rgba(99,152,169,0.08)", border: "1px solid rgba(99,152,169,0.20)",
              }}>
                <p style={{ fontSize: 11, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                  💡 Nos seus dados, <strong style={{ color: "var(--menthe)" }}>{patterns.bestDay.day}</strong> é seu melhor dia.
                  Nas <strong style={{ color: "var(--nectarine)" }}>{patterns.worstDay.day}s</strong>, proteja sua energia —
                  evite compromissos exigentes ou agendamentos difíceis nesse dia.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Link to Harmony */}
        <AuraButtonV2
          onClick={() => navigate("/harmony")}
          className="btn btn-ghost btn-full insights-ghost-btn"
        >
          Harmonia
        </AuraButtonV2>

      </div>
    </div>
  );
}
