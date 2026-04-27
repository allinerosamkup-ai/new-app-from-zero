// Insights Page v4 — Analytics profundo + Line chart + Correlações + Export + Relatório mensal
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { computeMoodCycle, computePhaseHistory, getPhaseColor, getStabilityLabel, PHASE_CONFIG } from "../utils/mood-cycle-engine";
import { PhaseLegendSheet } from "../components/PhaseLegendSheet";
import { getLocalDateKey, normalizeDateKey } from "../utils/day-context";
import "../styles/aura.css";
import "../styles/editorial.css";

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
    weeklyQuestion?: string;
    highlights?: string[];
  };
};

const CAT_COLOR: Record<string, string> = {
  energia: "var(--atomic-tangerine)",
  humor: "var(--sweet-mint)",
  rotina: "var(--atomic-tangerine)",
  autocuidado: "var(--sweet-mint)",
};

const STAT_ACCENT: Record<string, string> = {
  Humor: "var(--accent-sage)",
  Energia: "var(--accent-sky)",
  "Check-ins": "var(--accent-peach)",
};

const toPoint = (angle: number, r: number, cx = 120, cy = 120) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const harmonyAngles = Array.from(
  { length: 6 },
  (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / 6
);

function toLocalNoon(dateKey: string): Date {
  return new Date(`${normalizeDateKey(dateKey)}T12:00:00`);
}

function polygonPoints(r: number): string {
  return harmonyAngles
    .map((angle) => {
      const point = toPoint(angle, r);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

// ── Pearson correlation ────────────────────────────────────────────
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b) / n;
  const num = xs.slice(0, n).reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.slice(0, n).reduce((s, x) => s + (x - mx) ** 2, 0));
  const dy = Math.sqrt(ys.slice(0, n).reduce((s, _, i) => s + (ys[i] - my) ** 2, 0));
  return dx === 0 || dy === 0 ? 0 : Math.max(-1, Math.min(1, num / (dx * dy)));
}

// ── SVG Line Chart ─────────────────────────────────────────────────
function MoodLineChart({ data }: { data: Array<{ date: string; humor: number; energia: number }> }) {
  if (data.length < 3) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
        Precisa de pelo menos 3 registros para exibir o gráfico.
      </div>
    );
  }
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const W = 320, H = 110, PX = 28, PY = 12;
  const w = W - PX * 2, h = H - PY * 2;
  const toX = (i: number) => PX + (i / (sorted.length - 1)) * w;
  const toY = (v: number) => PY + h - (v / 10) * h;
  const humorPath = sorted.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)} ${toY(d.humor).toFixed(1)}`).join(' ');
  const energyPath = sorted.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)} ${toY(d.energia).toFixed(1)}`).join(' ');
  // X-axis: up to 6 evenly spaced labels
  const step = Math.max(1, Math.floor(sorted.length / 5));
  const xIdxs = Array.from({ length: sorted.length }, (_, i) => i).filter(i => i % step === 0 || i === sorted.length - 1);
  const uniqueXIdxs = [...new Set(xIdxs)];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={PX} x2={W - PX} y1={PY + h * (1 - pct)} y2={PY + h * (1 - pct)}
          stroke="rgba(0,0,0,.05)" strokeWidth={1} />
      ))}
      {/* Area fill under humor */}
      <path
        d={`${humorPath} L${toX(sorted.length - 1).toFixed(1)} ${(PY + h).toFixed(1)} L${toX(0).toFixed(1)} ${(PY + h).toFixed(1)} Z`}
        fill="rgba(150,199,179,0.10)"
      />
      <path d={energyPath} fill="none" stroke="rgba(99,152,169,0.6)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,2" />
      <path d={humorPath} fill="none" stroke="var(--accent-sage)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((d, i) => <circle key={i} cx={toX(i)} cy={toY(d.humor)} r={i === sorted.length - 1 ? 4 : 2} fill="var(--accent-sage)" />)}
      {uniqueXIdxs.map(i => {
        const dt = new Date(sorted[i].date + 'T12:00:00');
        return (
          <text key={i} x={toX(i)} y={H - 1} textAnchor="middle" fontSize={7.5} fill="var(--text-3)" fontFamily="Plus Jakarta Sans, sans-serif">
            {dt.getDate()}/{dt.getMonth() + 1}
          </text>
        );
      })}
      {[0, 5, 10].map(v => (
        <text key={v} x={PX - 3} y={toY(v) + 3} textAnchor="end" fontSize={7.5} fill="var(--text-3)" fontFamily="Plus Jakarta Sans, sans-serif">
          {v}
        </text>
      ))}
    </svg>
  );
}

export function InsightsPage() {
  const { t } = useTranslation();
  const { state, addTask, refreshData } = useAuraStore();

  // Refresh on mount and on page focus (catches returning from check-in)
  useEffect(() => {
    void refreshData();
    const onFocus = () => { void refreshData(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();

  const [insightPhase, setInsightPhase] = useState<InsightPhase>("idle");
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [weeklyQuestion, setWeeklyQuestion] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [taskAdded, setTaskAdded] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d'>('7d');
  const [monthlyReport, setMonthlyReport] = useState<string | null>(null);
  const [monthlyReportPhase, setMonthlyReportPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const goals = state.goals || [];

  // Derive data from checkinHistory (fallback to empty if missing)
  const allHistory = state.checkinHistory || [];
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : period === '180d' ? 180 : 365;
  const history = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffIso = getLocalDateKey(cutoff);
    return allHistory.filter(h => h.date >= cutoffIso);
  }, [allHistory, periodDays]);
  // #4 — CycleEstimate via MoodCycleEngine
  const cycleReport = useMemo(() => computeMoodCycle(history), [history]);
  const phaseHistory = useMemo(() => computePhaseHistory(allHistory, 30), [allHistory]);
  const phaseColor = getPhaseColor(cycleReport.phase);
  const [phaseLegendOpen, setPhaseLegendOpen] = useState(false);
  const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Map history to chart data (last 7 entries, pad with zeros)
  const chartData = DAYS.map((_, dayIndex) => {
    const entry = history.find(h => {
      const d = toLocalNoon(h.date);
      return d.getDay() === dayIndex;
    });
    return {
      humor: entry ? (entry.humor / 10) * 100 : 0,
      energia: entry ? (entry.energia / 10) * 100 : 0,
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
      if (history.find(h => h.date === getLocalDateKey(d))) streak++;
      else break;
    }

    const lowDays    = history.filter(h => h.humor <= 4).length;
    const highDays   = history.filter(h => h.humor >= 8).length;
    const stableDays = history.length - lowDays - highDays;
    const total      = history.length;

    // Correlation: check-in days have better mood?
    const checkinDaysAvg = history.length > 0
      ? history.reduce((s, h) => s + h.humor, 0) / history.length
      : 0;

    return { dayAvgs, bestDay, worstDay, streak, lowDays, highDays, stableDays, total, checkinDaysAvg };
  }, [history]);

  function avg(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  const avgHarmonyMood = history.length > 0 ? avg(history.map((entry) => entry.humor)) / 10 : null;
  const avgHarmonyEnergy = history.length > 0 ? avg(history.map((entry) => entry.energia)) / 10 : null;
  const avgGoalPct = goals.length > 0 ? goals.reduce((sum, goal) => sum + goal.completedPct, 0) / goals.length / 100 : null;
  const socialVals = history.filter((entry) => entry.social != null).map((entry) => entry.social!);
  const fisicoVals = history.filter((entry) => entry.fisico != null).map((entry) => entry.fisico!);
  const sonoVals = history.filter((entry) => entry.sono != null).map((entry) => entry.sono!);
  const avgHarmonySocial = socialVals.length > 0 ? avg(socialVals) / 10 : null;
  const avgHarmonyFisico = fisicoVals.length > 0 ? avg(fisicoVals) / 10 : null;
  const avgHarmonySono = sonoVals.length > 0 ? avg(sonoVals) / 10 : null;
  const harmonyValues = [avgHarmonyMood, avgHarmonyEnergy, avgGoalPct, avgHarmonySocial, avgHarmonyFisico, avgHarmonySono].filter((value): value is number => value !== null);
  const overallHarmonyPct = harmonyValues.length > 0 ? Math.round((harmonyValues.reduce((sum, value) => sum + value, 0) / harmonyValues.length) * 100) : 0;
  const harmonyDimensions = [
    { emoji: "😊", label: "Humor", cor: "var(--sweet-mint)", valor: avgHarmonyMood ?? 0, noData: avgHarmonyMood === null },
    { emoji: "⚡", label: "Energia", cor: "var(--atomic-tangerine)", valor: avgHarmonyEnergy ?? 0, noData: avgHarmonyEnergy === null },
    { emoji: "🎯", label: "Metas", cor: "var(--accent-sky)", valor: avgGoalPct ?? 0, noData: avgGoalPct === null },
    { emoji: "👥", label: "Social", cor: "var(--horizon)", valor: avgHarmonySocial ?? 0, noData: avgHarmonySocial === null },
    { emoji: "💪", label: "Força", cor: "var(--terracotta)", valor: avgHarmonyFisico ?? 0, noData: avgHarmonyFisico === null },
    { emoji: "🌙", label: "Sono", cor: "var(--aquamarine)", valor: avgHarmonySono ?? 0, noData: avgHarmonySono === null },
  ];

  // ── Comparativo semana a semana (7.3) ────────────────────────
  const weeklyCompare = useMemo(() => {
    const today = new Date();
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - today.getDay()); // domingo
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const thisWeekIso = getLocalDateKey(startOfThisWeek);
    const lastWeekIso = getLocalDateKey(startOfLastWeek);

    const thisWeek = allHistory.filter(h => h.date >= thisWeekIso);
    const lastWeek = allHistory.filter(h => h.date >= lastWeekIso && h.date < thisWeekIso);

    if (thisWeek.length === 0 && lastWeek.length === 0) return null;

    const avgOf = (arr: typeof allHistory, key: "humor" | "energia") =>
      arr.length > 0 ? arr.reduce((s, h) => s + h[key], 0) / arr.length : null;

    const tw = {
      humor: avgOf(thisWeek, "humor"),
      energia: avgOf(thisWeek, "energia"),
      checkins: thisWeek.length,
    };
    const lw = {
      humor: avgOf(lastWeek, "humor"),
      energia: avgOf(lastWeek, "energia"),
      checkins: lastWeek.length,
    };

    return { thisWeek: tw, lastWeek: lw };
  }, [allHistory]);

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
      setWeeklyQuestion(res.insights.weeklyQuestion ?? null);
      setHighlights(res.insights.highlights ?? []);
      setInsightPhase("done");
    } catch (error) {
      console.warn("[insights] weekly AI failed, using local fallback.", error);
      const localAction = cycleReport.phase === "depleted" || cycleReport.phase === "low"
        ? "Escolha uma tarefa leve e proteja o sono hoje."
        : cycleReport.phase === "elevated" || cycleReport.phase === "mixed"
          ? "Reduza estímulos e escolha uma decisão antes de abrir outra frente."
          : "Escolha uma ação concreta que mantenha o ritmo sem esticar o dia.";
      setAiInsight({
        insight: `Pelo histórico de ${periodDays} dias, sua leitura atual combina faixa ${cycleReport.phaseLabel.toLowerCase()}, baseline pessoal de ${cycleReport.baselineComposite.toFixed(1)}/10, estabilidade ${cycleReport.stabilityScore}% e média de humor ${avgHumor}.`,
        action: localAction,
        category: "rotina",
        actionTitle: localAction.slice(0, 40),
      });
      setWeeklyQuestion("Qual pequeno ajuste de hoje impediria que esse padrão se repetisse amanhã?");
      setHighlights([
        `${history.length} registros no período selecionado`,
        `Humor médio ${avgHumor} · energia média ${avgEnergia}`,
        `Faixa pessoal: ${cycleReport.phaseLabel} · baseline ${cycleReport.baselineComposite.toFixed(1)}/10`,
      ]);
      setInsightPhase("done");
    }
  }

  function applyAction() {
    if (!aiInsight) return;
    addTask(aiInsight.actionTitle, "09:00", aiInsight.category, { forceSave: true })
      .then(() => {
        setTaskAdded(true);
        showSuccess("Acao adicionada ao planner.");
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Nao foi possivel salvar a acao.");
      });
  }

  function exportCSV() {
    if (allHistory.length === 0) { showError("Nenhum dado para exportar."); return; }
    const header = 'data,humor,energia,sono,social,fisico,fatores';
    const rows = allHistory.map(h => [
      h.date, h.humor, h.energia,
      h.sono ?? '', h.social ?? '', h.fisico ?? '',
      ((h as any).factors ?? []).join('|'),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airia-dados-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("CSV exportado!");
  }

  async function fetchMonthlyReport() {
    setMonthlyReportPhase('loading');
    try {
      const avgHumor7d = history.length > 0 ? (history.reduce((s, h) => s + h.humor, 0) / history.length).toFixed(1) : '—';
      const avgEnergy7d = history.length > 0 ? (history.reduce((s, h) => s + h.energia, 0) / history.length).toFixed(1) : '—';
      const res = await api.post('/ai/suggest', {
        type: 'monthly-report',
        context: {
          period,
          totalCheckins: history.length,
          avgHumor: avgHumor7d,
          avgEnergy: avgEnergy7d,
          phase: cycleReport.phase,
          phaseLabel: cycleReport.phaseLabel,
          stabilityScore: cycleReport.stabilityScore,
          warningFlags: cycleReport.warningFlags,
          moodCycleContext: cycleReport.aiContext,
        },
      }) as { suggestion: string };
      setMonthlyReport(res.suggestion);
      setMonthlyReportPhase('done');
    } catch {
      showError("Não foi possível gerar o relatório.");
      setMonthlyReportPhase('idle');
    }
  }

  return (
    <div className="insights-page">
      <div className="screen-content">

        {/* ── Header ── */}
        <div className="aura-page-header insights-header">
          <p className="aura-page-kicker">Sua Ciclagem</p>
          <h1 className="aura-page-title insights-title">{t("insights.title")}</h1>
          {/* Seletor de período + Export */}
          <div style={{ display: "flex", gap: "6px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {(['7d', '30d', '90d', '180d', '365d'] as const).map(p => {
              const label = p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : p === '180d' ? 'Semestral' : 'Anual';
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
                    fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer",
                    border: active ? "1.5px solid var(--accent-peach)" : "1.5px solid var(--warm-border-2)",
                    background: active ? "var(--accent-peach)" : "rgba(255,255,255,.62)",
                    color: active ? "#fff" : "var(--text-2)",
                    backdropFilter: "blur(14px)",
                    transition: "all 150ms",
                  }}
                >{label}</button>
              );
            })}
            <button
              onClick={exportCSV}
              style={{
                marginLeft: "auto", padding: "5px 12px", borderRadius: "999px", fontSize: "11px",
                fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer",
                border: "1.5px solid var(--warm-border-2)", background: "rgba(255,255,255,.62)",
                color: "var(--text-3)", backdropFilter: "blur(14px)", transition: "all 150ms",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              ↓ CSV
            </button>
          </div>
        </div>

        {/* ── Chart card ── */}
        <div className="aura-card aura-card--chart insights-chart-card">
          <div className="insights-chart-heading">
            <span className="insights-chart-bullet" />
            <p className="insights-chart-label">Humor &amp; Energia</p>
          </div>

          {period !== '7d' ? (
            <>
              <MoodLineChart data={history.map(h => ({ date: h.date, humor: h.humor, energia: h.energia }))} />
              <div className="insights-legend" style={{ marginTop: 8 }}>
                <div className="insights-legend-item"><span className="insights-legend-dot insights-legend-dot--humor" /><span className="insights-legend-text">Humor</span></div>
                <div className="insights-legend-item"><span className="insights-legend-dot insights-legend-dot--energia" /><span className="insights-legend-text">Energia</span></div>
              </div>
            </>
          ) : (
          <>
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
          </>
          )}
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

        {/* ── Comparativo Semana a Semana (7.3) ── */}
        {weeklyCompare && (weeklyCompare.thisWeek.checkins > 0 || weeklyCompare.lastWeek.checkins > 0) && (
          <div style={{
            borderRadius: 18, border: "1.5px solid var(--warm-border)",
            background: "rgba(255,255,255,.62)", backdropFilter: "blur(16px)",
            padding: "14px", marginBottom: "calc(var(--a))",
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 12px" }}>
              📅 {t("insights.weekVsLastWeek")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { label: "Humor", twVal: weeklyCompare.thisWeek.humor, lwVal: weeklyCompare.lastWeek.humor, fmt: (v: number | null) => v ? v.toFixed(1) : "—", unit: "/10" },
                { label: "Energia", twVal: weeklyCompare.thisWeek.energia, lwVal: weeklyCompare.lastWeek.energia, fmt: (v: number | null) => v ? v.toFixed(1) : "—", unit: "/10" },
                { label: "Check-ins", twVal: weeklyCompare.thisWeek.checkins, lwVal: weeklyCompare.lastWeek.checkins, fmt: (v: number | null) => String(v ?? 0), unit: "" },
              ] as const).map(row => {
                const diff = (row.twVal ?? 0) - (row.lwVal ?? 0);
                const arrow = Math.abs(diff) < 0.1 ? "→" : diff > 0 ? "↑" : "↓";
                const arrowColor = Math.abs(diff) < 0.1 ? "var(--text-3)" : diff > 0 ? "var(--accent-sage)" : "var(--accent-peach)";
                return (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", minWidth: 70 }}>{row.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {row.fmt(row.lwVal as any)}{row.unit}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: arrowColor }}>{arrow}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-1)" }}>
                        {row.fmt(row.twVal as any)}{row.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HISTÓRICO DE FASES (timeline 30 dias) ── */}
        {phaseHistory.length > 0 && (
          <div
            className="aura-card"
            style={{
              marginBottom: 24,
              padding: "18px",
              borderRadius: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--accent-peach-ink)",
                  }}
                >
                  {t("insights.phaseHistory.kicker")}
                </p>
                <h3
                  style={{
                    margin: "4px 0 0",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--text-1)",
                    fontFamily: "var(--font-serif, 'Fraunces', serif)",
                  }}
                >
                  {t("insights.phaseHistory.title")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPhaseLegendOpen(true)}
                style={{
                  border: "none",
                  background: "var(--accent-peach-a3)",
                  color: "var(--accent-peach-ink)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "5px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans, sans-serif)",
                  whiteSpace: "nowrap",
                }}
              >
                ver as 8 fases
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 14px", lineHeight: 1.45 }}>
              {t("insights.phaseHistory.description")}
            </p>

            {/* Timeline barra */}
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 36,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--warm-border)",
              }}
            >
              {phaseHistory.map((seg, idx) => {
                const cfg = PHASE_CONFIG[seg.phase];
                const totalDays = phaseHistory.reduce((sum, s) => sum + s.daysCount, 0);
                const widthPct = (seg.daysCount / totalDays) * 100;
                return (
                  <div
                    key={`${seg.phase}-${idx}`}
                    title={`${cfg.label} — ${seg.daysCount} dia${seg.daysCount !== 1 ? "s" : ""}`}
                    style={{
                      width: `${widthPct}%`,
                      background: cfg.color,
                      opacity: 0.85,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                    }}
                  >
                    {widthPct > 8 && <span aria-hidden>{cfg.emoji}</span>}
                  </div>
                );
              })}
            </div>

            {/* Legenda compacta */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {phaseHistory.map((seg, idx) => {
                const cfg = PHASE_CONFIG[seg.phase];
                return (
                  <span
                    key={`leg-${seg.phase}-${idx}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: "var(--warm-surface)",
                      border: "1px solid var(--warm-border)",
                      fontSize: 11.5,
                      color: "var(--text-1)",
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{cfg.emoji}</span>
                    <span style={{ fontWeight: 600 }}>{cfg.label}</span>
                    <span style={{ color: "var(--text-3)" }}>· {seg.daysCount}d</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="aura-page-header" style={{ marginBottom: 12 }}>
          <p className="aura-page-kicker">{t("insights.harmonyKicker")}</p>
          <h2 className="aura-page-title" style={{ fontSize: "24px", marginBottom: 4 }}>{t("insights.harmonyTitle")}</h2>
          <p className="aura-page-subtitle">{t("insights.harmonySubtitle")}</p>
        </div>

        <div className="harmony-radar-shell">
          <div className="harmony-radar-container">
            <svg width="240" height="240" viewBox="0 0 240 240">
              {[22.5, 45, 67.5].map((radius) => (
                <polygon
                  key={radius}
                  points={polygonPoints(radius)}
                  fill="none"
                  stroke="var(--harmony-radar-grid)"
                  strokeWidth={1}
                  className="harmony-radar-grid"
                />
              ))}

              <polygon
                points={polygonPoints(45)}
                fill="var(--harmony-radar-base-fill)"
                stroke="var(--harmony-radar-base)"
                strokeWidth={1}
                strokeDasharray="4,2"
                className="harmony-radar-base"
              />

              {harmonyAngles.map((angle, index) => {
                const point = toPoint(angle, 90);
                return (
                  <line
                    key={index}
                    x1={120}
                    y1={120}
                    x2={point.x}
                    y2={point.y}
                    stroke="var(--harmony-radar-grid)"
                    strokeWidth={1}
                    className="harmony-radar-axis"
                  />
                );
              })}

              <defs>
                <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="var(--sweet-mint)" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="var(--atomic-tangerine)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--atomic-tangerine)" stopOpacity="0.05" />
                </radialGradient>
              </defs>

              <path
                d={harmonyDimensions.reduce((path, dimension, index) => {
                  const point = toPoint(harmonyAngles[index], 90 * dimension.valor);
                  return path + (index === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`) + (index === harmonyDimensions.length - 1 ? " Z" : "");
                }, "")}
                fill="url(#radarGradient)"
                stroke="var(--atomic-tangerine)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                className="harmony-data-path"
              />

              {harmonyDimensions.map((dimension, index) => {
                const point = toPoint(harmonyAngles[index], 90 * dimension.valor);
                return (
                  <circle
                    key={dimension.label}
                    cx={point.x}
                    cy={point.y}
                    r={5}
                    fill={dimension.cor}
                    stroke="var(--harmony-radar-dot-stroke)"
                    strokeWidth={2}
                    className="harmony-dot"
                  />
                );
              })}

              {harmonyDimensions.map((dimension, index) => {
                const point = toPoint(harmonyAngles[index], 112);
                return (
                  <text
                    key={`${dimension.label}-emoji`}
                    x={point.x}
                    y={point.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={15}
                    className="harmony-emoji-label"
                  >
                    {dimension.emoji}
                  </text>
                );
              })}
            </svg>
          </div>
          <div className="harmony-radar-caption">Base de comparação: 50%</div>
        </div>

        <div className="harmony-summary">
          <div className="harmony-summary-top">
            <span className="harmony-percent">{overallHarmonyPct}%</span>
            <span className="harmony-label">equilíbrio geral</span>
          </div>
          <div className="harmony-legend">
            <span className="harmony-legend-item">
              <span className="harmony-legend-line" />
              Atual
            </span>
            <span className="harmony-legend-item">
              <span className="harmony-legend-line dashed" />
              Base (50%)
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/goals")}
            className="harmony-goals-link"
            style={{ background: "none", border: "none", padding: "6px 0", width: "100%", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Ver detalhes das metas →
          </button>
        </div>

        <h2 className="harmony-section-title">Dimensões correlacionadas</h2>
        <div className="harmony-dim-grid">
          {harmonyDimensions.map((dimension) => (
            <div key={dimension.label} className="harmony-dim-card">
              <div className="harmony-dim-top">
                <span className="harmony-dim-label">{dimension.label}</span>
                <span className="harmony-dim-value">{Math.round(dimension.valor * 100)}%</span>
              </div>
              <div className="harmony-progress-track">
                <div
                  className="harmony-progress-fill"
                  style={{
                    width: `${dimension.valor * 100}%`,
                    background: dimension.cor,
                  }}
                />
              </div>
              {dimension.noData && <span className="harmony-dim-note">sem dados</span>}
            </div>
          ))}
        </div>

        {/* ── Correlações ─────────────────────────────────────── */}
        {history.length >= 5 && (() => {
          const humorVals  = history.map(h => h.humor);
          const energyVals = history.map(h => h.energia);
          const sleepArr   = history.filter(h => h.sono != null).map(h => ({ humor: h.humor, sono: h.sono! }));
          const corSleepMood = sleepArr.length >= 3 ? pearson(sleepArr.map(x => x.sono), sleepArr.map(x => x.humor)) : null;
          const corEnergyMood = pearson(energyVals, humorVals);
          const habits = state.habits || [];
          const habitsByDate = history.map(h => {
            const dateStr = h.date;
            const done = habits.filter(hab => hab.completions?.some(c => c.date?.startsWith(dateStr))).length;
            const total = habits.filter(hab => hab.frequency === 'daily').length;
            return { pct: total > 0 ? done / total : 0, humor: h.humor };
          });
          const corHabitsMood = habitsByDate.length >= 3
            ? pearson(habitsByDate.map(x => x.pct), habitsByDate.map(x => x.humor))
            : null;

          const corItems = [
            { label: "Sono → Humor", cor: corSleepMood, icon: "🌙", desc: "bom sono eleva o humor?" },
            { label: "Energia ↔ Humor", cor: corEnergyMood, icon: "⚡", desc: "energia e humor caminham juntos?" },
            ...(corHabitsMood !== null ? [{ label: "Hábitos → Humor", cor: corHabitsMood, icon: "🔁", desc: "completar hábitos melhora o estado?" }] : []),
          ].filter(x => x.cor !== null) as Array<{ label: string; cor: number; icon: string; desc: string }>;

          if (corItems.length === 0) return null;

          const label = (r: number) => {
            const abs = Math.abs(r);
            const dir = r >= 0 ? "positiva" : "negativa";
            if (abs >= 0.6) return `forte ${dir}`;
            if (abs >= 0.3) return `moderada ${dir}`;
            return `fraca ${dir}`;
          };

          return (
            <div style={{ borderRadius: 18, border: "1.5px solid var(--warm-border)", background: "rgba(255,255,255,.62)", backdropFilter: "blur(16px)", padding: "14px", marginBottom: "calc(var(--a))" }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 14px" }}>
                🔗 Correlações do período
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {corItems.map(item => {
                  const abs = Math.abs(item.cor);
                  const barColor = item.cor >= 0 ? "var(--accent-sage)" : "var(--accent-peach)";
                  return (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 6 }}>
                          {item.icon} {item.label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>
                          {label(item.cor)} ({item.cor >= 0 ? "+" : ""}{(item.cor * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                        <div style={{ width: `${abs * 100}%`, height: "100%", borderRadius: 999, background: barColor, transition: "width 0.5s ease" }} />
                      </div>
                      <p style={{ fontSize: 10, color: "var(--text-3)", margin: "3px 0 0", fontStyle: "italic" }}>{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
                  { label: "Humor 7d", val: cycleReport.avgMood7d, color: "var(--accent-sage)" },
                  { label: "Energia 7d", val: cycleReport.avgEnergy7d, color: "var(--accent-sky)" },
                  ...(cycleReport.avgSleep7d ? [{ label: "Sono 7d", val: cycleReport.avgSleep7d, color: "var(--accent-peach)" }] : []),
                ].map(m => (
                  <div key={m.label} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: `${m.color}15`, border: `1px solid ${m.color}30`, textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-3)", margin: "0 0 2px" }}>{m.label}</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: m.color, margin: 0 }}>
                      {m.val.toFixed(1)}<span style={{ fontSize: 9, fontWeight: 400 }}>/10</span>
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
                        background: "rgba(215,137,127,.12)", color: "var(--accent-peach)",
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

        {/* ── Seção: Hábitos e Momentum ──────────────────────── */}
        {(() => {
          const habits = state.habits || [];
          if (habits.length === 0) return null;

          const activeStreaks = habits.filter(h => h.streakCount > 0).sort((a, b) => b.streakCount - a.streakCount);
          const completedToday = habits.filter(h => (h.completions?.length ?? 0) > 0);
          const totalToday = habits.filter(h => h.frequency === 'daily').length;
          const bestHabit = habits.reduce((best, h) => h.bestStreak > (best?.bestStreak ?? 0) ? h : best, habits[0]);

          // Fatores que aparecem nos dias de bom humor (humor >= 4)
          const goodMoodCheckins = history.filter(h => h.humor >= 8 && (h as any).factors?.length > 0);
          const factorFrequency: Record<string, number> = {};
          goodMoodCheckins.forEach(h => {
            ((h as any).factors as string[]).forEach((f: string) => {
              factorFrequency[f] = (factorFrequency[f] ?? 0) + 1;
            });
          });
          const topFactors = Object.entries(factorFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          const FACTOR_LABELS: Record<string, { label: string; icon: string }> = {
            good_sleep: { label: "Sono bom", icon: "😴" },
            exercise: { label: "Exercício", icon: "🏋️" },
            healthy_meal: { label: "Alimentação", icon: "🥗" },
            fresh_air: { label: "Ar fresco", icon: "🌿" },
            good_talk: { label: "Boa conversa", icon: "💬" },
            kind_words: { label: "Palavras gentis", icon: "❤️" },
            support: { label: "Apoio", icon: "🤝" },
            small_win: { label: "Pequena vitória", icon: "⭐" },
            finished_task: { label: "Tarefa concluída", icon: "✅" },
            feeling_valued: { label: "Me senti valorizada", icon: "🏆" },
            music: { label: "Música", icon: "🎵" },
            time_outside: { label: "Ao ar livre", icon: "🌳" },
            hobby: { label: "Hobby", icon: "🎨" },
            self_trust: { label: "Confiança em mim", icon: "💪" },
            rest: { label: "Descanso", icon: "🛋️" },
          };

          return (
            <div style={{
              borderRadius: 18, border: "1.5px solid var(--warm-border)",
              background: "rgba(255,255,255,0.62)",
              backdropFilter: "blur(16px)",
              padding: "14px",
              marginBottom: "calc(var(--a))",
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 12px" }}>
                🔥 Hábitos — Momentum
              </p>

              {/* Today's progress */}
              {totalToday > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Hoje</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: completedToday.length === totalToday ? "var(--accent-sage)" : "var(--text-2)" }}>
                      {completedToday.length}/{totalToday}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <div style={{
                      width: `${(completedToday.length / totalToday) * 100}%`,
                      height: "100%", borderRadius: 999,
                      background: completedToday.length === totalToday
                        ? "var(--accent-sage)"
                        : "linear-gradient(90deg, var(--accent-sky), var(--accent-sage))",
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
              )}

              {/* Active streaks */}
              {activeStreaks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 9, fontWeight: 800, color: "var(--text-3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Em sequência agora
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {activeStreaks.slice(0, 3).map(h => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{h.icon || "✨"}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{h.title}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-peach)", display: "flex", alignItems: "center", gap: 3 }}>
                          🔥 {h.streakCount}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best habit */}
              {bestHabit && bestHabit.bestStreak > 0 && (
                <div style={{
                  padding: "8px 10px", borderRadius: 10,
                  background: "rgba(215,137,127,0.08)", border: "1px solid rgba(215,137,127,0.20)",
                  display: "flex", alignItems: "center", gap: 10, marginBottom: topFactors.length > 0 ? 12 : 0,
                }}>
                  <span style={{ fontSize: 18 }}>🏆</span>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--accent-peach)", fontWeight: 700, margin: "0 0 1px", textTransform: "uppercase" }}>
                      Melhor sequência de sempre
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
                      {bestHabit.title} — {bestHabit.bestStreak} dias
                    </p>
                  </div>
                </div>
              )}

              {/* Factors correlation (only if enough data) */}
              {topFactors.length > 0 && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-sage)", margin: "12px 0 8px" }}>
                    ✨ Fatores nos seus dias de bom humor
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {topFactors.map(([factorId, count]) => {
                      const meta = FACTOR_LABELS[factorId] ?? { label: factorId, icon: "•" };
                      return (
                        <div key={factorId} style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 20,
                          background: "rgba(150,199,179,0.12)", border: "1px solid rgba(150,199,179,0.30)",
                          fontSize: 12, fontWeight: 600, color: "var(--accent-sage)",
                        }}>
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                          <span style={{ fontSize: 10, opacity: 0.7 }}>×{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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

        {/* ── Highlights da semana ───────────────────────────── */}
        {insightPhase === "done" && highlights.length > 0 && (
          <div style={{
            borderRadius: 18,
            border: "1.5px solid rgba(150,199,179,0.28)",
            background: "rgba(150,199,179,0.07)",
            padding: "14px 16px",
            marginBottom: "calc(var(--a))",
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-sage)", margin: "0 0 12px" }}>
              🌟 Conquistas desta semana
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {highlights.map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(150,199,179,0.20)",
                    border: "1.5px solid rgba(150,199,179,0.40)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 1,
                  }}>
                    <span style={{ fontSize: 11, color: "var(--accent-sage)", fontWeight: 800 }}>✓</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0, lineHeight: 1.5, flex: 1 }}>
                    {h}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pergunta da semana ─────────────────────────────── */}
        {insightPhase === "done" && weeklyQuestion && (
          <div style={{
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(215,137,127,0.10) 0%, rgba(150,199,179,0.08) 100%)",
            border: "1.5px solid rgba(215,137,127,0.20)",
            padding: "18px 20px",
            marginBottom: "calc(var(--a))",
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent-peach)", margin: "0 0 10px" }}>
              💭 Pergunta da semana
            </p>
            <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", margin: "0 0 14px", lineHeight: 1.45 }}>
              {weeklyQuestion}
            </p>
            <button
              onClick={() => window.location.href = "/journal"}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 12, fontWeight: 700, color: "var(--accent-peach)",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              Refletir no diário →
            </button>
          </div>
        )}

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
                  <p style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-sage)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Melhor dia</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-sage)", margin: "0 0 1px" }}>{patterns.bestDay.day}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>humor {patterns.bestDay.mood.toFixed(1)}/10</p>
                </div>
              )}
              {patterns.worstDay && patterns.worstDay.day !== patterns.bestDay?.day && (
                <div style={{ flex: 1, padding: "8px 10px", borderRadius: 12, background: "rgba(215,137,127,0.08)", border: "1px solid rgba(215,137,127,0.25)", textAlign: "center" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-peach)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Dia difícil</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-peach)", margin: "0 0 1px" }}>{patterns.worstDay.day}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>humor {patterns.worstDay.mood.toFixed(1)}/10</p>
                </div>
              )}
              <div style={{ flex: 1, padding: "8px 10px", borderRadius: 12, background: "rgba(99,152,169,0.10)", border: "1px solid rgba(99,152,169,0.25)", textAlign: "center" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-sky)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Sequência</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-sky)", margin: "0 0 1px" }}>{patterns.streak}</p>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>dias seguidos</p>
              </div>
            </div>

            {/* Distribuição de humor */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>Distribuição de humor ({patterns.total} registros)</p>
            <div style={{ display: "flex", gap: 4, height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              {patterns.highDays > 0 && (
                <div style={{ flex: patterns.highDays, background: "var(--accent-sage)", borderRadius: "999px 0 0 999px" }} />
              )}
              {patterns.stableDays > 0 && (
                <div style={{ flex: patterns.stableDays, background: "var(--accent-sky)" }} />
              )}
              {patterns.lowDays > 0 && (
                <div style={{ flex: patterns.lowDays, background: "var(--accent-peach)", borderRadius: "0 999px 999px 0" }} />
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
                  💡 Nos seus dados, <strong style={{ color: "var(--accent-sage)" }}>{patterns.bestDay.day}</strong> é seu melhor dia.
                  Nas <strong style={{ color: "var(--accent-peach)" }}>{patterns.worstDay.day}s</strong>, proteja sua energia —
                  evite compromissos exigentes ou agendamentos difíceis nesse dia.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Relatório Mensal IA ─────────────────────────────── */}
        <div style={{
          borderRadius: 18, border: "1.5px solid var(--warm-border)",
          background: "rgba(255,255,255,.62)", backdropFilter: "blur(16px)",
          padding: "14px", marginBottom: "calc(var(--a))",
        }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 12px" }}>
            📋 Relatório da Airia
          </p>

          {monthlyReportPhase === 'idle' && (
            <AuraButtonV2
              variant="outline"
              onClick={fetchMonthlyReport}
              style={{ width: "100%", fontSize: 13, fontWeight: 700, height: 44 }}
            >
              Gerar relatório do período
            </AuraButtonV2>
          )}

          {monthlyReportPhase === 'loading' && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "2px solid var(--accent-sage)", borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
                A Airia está analisando o período...
              </p>
            </div>
          )}

          {monthlyReportPhase === 'done' && monthlyReport && (
            <div>
              <p style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.7, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                {monthlyReport}
              </p>
              <button
                onClick={() => { setMonthlyReport(null); setMonthlyReportPhase('idle'); }}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  fontSize: 11, color: "var(--text-3)", fontWeight: 600,
                }}
              >
                Gerar novamente
              </button>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      </div>
      <PhaseLegendSheet
        open={phaseLegendOpen}
        onClose={() => setPhaseLegendOpen(false)}
        currentPhase={cycleReport.phase}
      />
    </div>
  );
}
