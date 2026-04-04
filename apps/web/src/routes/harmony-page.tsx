import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
// Harmony Page v2 — círculo de harmonia SVG
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";
import "../styles/aura-v2.css";

const toPoint = (angle: number, r: number, cx = 120, cy = 120) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const angles = Array.from(
  { length: 6 },
  (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / 6
);

function polygonPoints(r: number): string {
  return angles
    .map((a) => {
      const p = toPoint(a, r);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

export function HarmonyPage() {
  const navigate = useNavigate();
  const { state } = useAuraStore();

  const history = state.checkinHistory || [];
  const goals = state.goals || [];

  function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

  // Apenas dados reais — sem fallbacks inventados
  const avgH      = history.length > 0 ? avg(history.map(h => h.humor)) / 5 : null;
  const avgE      = history.length > 0 ? avg(history.map(h => h.energia)) / 5 : null;
  const avgGoalPct = goals.length > 0 ? goals.reduce((s, g) => s + g.completedPct, 0) / goals.length / 100 : null;

  const socialVals = history.filter(h => h.social != null).map(h => h.social!);
  const fisicoVals = history.filter(h => h.fisico != null).map(h => h.fisico!);
  const sonoVals   = history.filter(h => h.sono != null).map(h => h.sono!);

  const avgSocial = socialVals.length > 0 ? avg(socialVals) / 5 : null;
  const avgFisico = fisicoVals.length > 0 ? avg(fisicoVals) / 5 : null;
  const avgSono   = sonoVals.length > 0   ? avg(sonoVals) / 5   : null;

  // overallPct usa apenas dimensões com dados reais
  const realVals = [avgH, avgE, avgGoalPct, avgSocial, avgFisico, avgSono].filter((v): v is number => v !== null);
  const overallPct = realVals.length > 0 ? Math.round(realVals.reduce((a, b) => a + b) / realVals.length * 100) : 0;

  const dimensions = [
    { emoji: "😊", label: "Humor",   cor: "var(--sweet-mint)",       valor: avgH ?? 0,      noData: avgH === null },
    { emoji: "⚡", label: "Energia", cor: "var(--atomic-tangerine)", valor: avgE ?? 0,      noData: avgE === null },
    { emoji: "🎯", label: "Metas",   cor: "var(--lagune)",           valor: avgGoalPct ?? 0, noData: avgGoalPct === null },
    { emoji: "👥", label: "Social",  cor: "var(--horizon)",          valor: avgSocial ?? 0, noData: avgSocial === null },
    { emoji: "💪", label: "Força",   cor: "var(--terracotta)",       valor: avgFisico ?? 0, noData: avgFisico === null },
    { emoji: "🌙", label: "Sono",    cor: "var(--aquamarine)",       valor: avgSono ?? 0,   noData: avgSono === null },
  ];


  return (
    <div className="aura-layout-content">
      {/* FAB */}
      <AuraButtonV2
        onClick={() => navigate("/checkin")}
        className="aura-v2-btn-primary"
        style={{
          position: "fixed",
          bottom: "90px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "9px 24px",
          borderRadius: "999px",
          zIndex: 200,
          whiteSpace: "nowrap",
        }}
      >
        + Registrar check-in
      </AuraButtonV2>

      <div className="screen-content">
        <div className="aura-page-header" style={{ marginBottom: 12 }}>
          <p className="aura-page-kicker">Padrão semanal</p>
          <h1 className="aura-page-title">Círculo de Harmonia</h1>
          <p className="aura-page-subtitle">Leitura integrada dos últimos 7 dias com o mesmo padrão visual do restante do app.</p>
        </div>

        {/* SVG Radar */}
        <div className="harmony-radar-shell">
          <div className="harmony-radar-container">
          <svg
            width="240"
            height="240"
            viewBox="0 0 240 240"
          >
            {/* Grid hexágonos: 25%, 50%, 75% */}
            {[22.5, 45, 67.5].map((r) => (
              <polygon
                key={r}
                points={polygonPoints(r)}
                fill="none"
                stroke="rgba(0,0,0,.06)"
                strokeWidth={1}
              />
            ))}

            {/* Baseline 50% */}
            <polygon
              points={polygonPoints(45)}
              fill="rgba(0,0,0,.02)"
              stroke="rgba(var(--text-3-rgb), 0.15)"
              strokeWidth={1}
              strokeDasharray="4,2"
            />

            {/* Eixos */}
            {angles.map((a, i) => {
              const p = toPoint(a, 90);
              return (
                <line
                  key={i}
                  x1={120}
                  y1={120}
                  x2={p.x}
                  y2={p.y}
                  stroke="rgba(0,0,0,.06)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Definições de Gradientes */}
            <defs>
              <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="var(--sweet-mint)" stopOpacity="0.4" />
                <stop offset="70%" stopColor="var(--atomic-tangerine)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--atomic-tangerine)" stopOpacity="0.05" />
              </radialGradient>
            </defs>

            {/* Polígono de dados */}
            <path
              d={dimensions.reduce((acc, d, i) => {
                const p = toPoint(angles[i], 90 * d.valor);
                return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`) + (i === dimensions.length - 1 ? " Z" : "");
              }, "")}
              fill="url(#radarGradient)"
              stroke="var(--atomic-tangerine)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              className="harmony-data-path"
            />

            {/* Dots nos vértices */}
            {dimensions.map((d, i) => {
              const p = toPoint(angles[i], 90 * d.valor);
              const dotColors = [
                "var(--terracotta)", 
                "var(--horizon)", 
                "var(--atomic-tangerine)", 
                "var(--sweet-mint)", 
                "var(--rose)", 
                "var(--buttercup)"
              ];
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={dotColors[i % dotColors.length]}
                  stroke="white"
                  strokeWidth={2}
                  className="harmony-dot"
                />
              );
            })}

            {/* Emojis nos vértices */}
            {dimensions.map((d, i) => {
              const p = toPoint(angles[i], 112);
              return (
                <text
                  key={i}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={15}
                  className="harmony-emoji-label"
                >
                  {d.emoji}
                </text>
              );
            })}
          </svg>
          </div>
          <div className="harmony-radar-caption">Base de comparação: 50%</div>
        </div>

        {/* Resumo + legenda */}
        <div className="harmony-summary">
          <div className="harmony-summary-top">
            <span className="harmony-percent">{overallPct}%</span>
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
          <div
            onClick={() => navigate("/goals")}
            className="harmony-goals-link"
          >
            Ver Detalhes das Metas →
          </div>
        </div>

        {/* Título detalhes */}
        <h2 className="harmony-section-title">Dimensões</h2>

        {/* Cards de dimensão */}
        <div className="harmony-dim-grid">
          {dimensions.map((d) => (
            <div key={d.label} className="harmony-dim-card">
              <div className="harmony-dim-top">
                <span className="harmony-dim-label">{d.label}</span>
                <span className="harmony-dim-value">{Math.round(d.valor * 100)}%</span>
              </div>
              {/* Barra de progresso */}
              <div className="harmony-progress-track">
                <div
                  className="harmony-progress-fill"
                  style={{
                    width: `${d.valor * 100}%`,
                    background: d.cor,
                  }}
                />
              </div>
              {d.noData && <span className="harmony-dim-note">sem dados</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
