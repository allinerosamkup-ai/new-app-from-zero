// Onboarding: Ciclo Menstrual — date picker + sliders duração
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";

const STEP = 3;
const TOTAL = 5;

export function OnboardingCyclePage() {
  const navigate = useNavigate();
  const { state, updateOnboardingDraft } = useAuraStore();
  const [lastPeriod, setLastPeriod] = useState(state.onboardingDraft.cycleStart);
  const [cycleDuration, setCycleDuration] = useState(state.onboardingDraft.cycleLength);
  const [lutealDuration, setLutealDuration] = useState(state.onboardingDraft.lutealLength);

  const cycleMin = 21, cycleMax = 35;
  const lutealMin = 10, lutealMax = 16;

  const cyclePct  = ((cycleDuration  - cycleMin)  / (cycleMax  - cycleMin))  * 100;
  const lutealPct = ((lutealDuration - lutealMin) / (lutealMax - lutealMin)) * 100;

  const folicular = cycleDuration - lutealDuration;

  function persistAndGo(path: string) {
    updateOnboardingDraft({
      cycleStart: lastPeriod,
      cycleLength: cycleDuration,
      lutealLength: lutealDuration,
    });
    navigate(path);
  }

  return (
    <div className="aura-page-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px 0" }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 999,
              background: i < STEP ? "var(--accent-peach)" : "rgba(215,137,127,.2)",
            }} />
          ))}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-peach)", marginBottom: 4 }}>
          PASSO {STEP} DE {TOTAL}
        </p>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25, marginBottom: 6 }}>
          Seu ciclo menstrual
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 24 }}>
          Essas informações personalizam suas sugestões de acordo com sua fase.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>

        {/* Date picker */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>
            🗓️ Início da última menstruação
          </p>
          <input
            type="date"
            value={lastPeriod}
            onChange={e => setLastPeriod(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            style={{
              width: "100%", height: 50, borderRadius: 12,
              border: "1.5px solid var(--warm-border-2)",
              padding: "0 16px",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--text-1)",
              background: "rgba(255,255,255,.72)", outline: "none",
              boxSizing: "border-box",
              backdropFilter: "blur(18px)",
              boxShadow: "0 12px 28px rgba(243,176,140,.08)",
            }}
          />
        </div>

        {/* Slider: duração do ciclo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
              🔄 Duração do ciclo
            </p>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--accent-peach)" }}>
              {cycleDuration} dias
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ width: "100%", height: 8, background: "var(--accent-peach-a3)", borderRadius: 999, overflow: "visible", position: "relative" }}>
              <div style={{ width: `${cyclePct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent-sage), var(--accent-peach))" }} />
              <div style={{ width: 20, height: 20, background: "#fff", border: "2px solid var(--accent-peach)", borderRadius: "50%", position: "absolute", top: "50%", left: `${cyclePct}%`, transform: "translate(-50%, -50%)", boxShadow: "0 2px 8px rgba(215,137,127,.25)", pointerEvents: "none" }} />
            </div>
            <input type="range" min={cycleMin} max={cycleMax} value={cycleDuration} onChange={e => setCycleDuration(Number(e.target.value))}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{cycleMin} dias</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{cycleMax} dias</span>
          </div>
        </div>

        {/* Slider: fase lútea */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
              🌊 Fase lútea
            </p>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--accent-sky)" }}>
              {lutealDuration} dias
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ width: "100%", height: 8, background: "rgba(99,152,169,.15)", borderRadius: 999, overflow: "visible", position: "relative" }}>
              <div style={{ width: `${lutealPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent-sky), var(--accent-sage))" }} />
              <div style={{ width: 20, height: 20, background: "#fff", border: "2px solid var(--accent-sky)", borderRadius: "50%", position: "absolute", top: "50%", left: `${lutealPct}%`, transform: "translate(-50%, -50%)", boxShadow: "0 2px 8px rgba(99,152,169,.25)", pointerEvents: "none" }} />
            </div>
            <input type="range" min={lutealMin} max={lutealMax} value={lutealDuration} onChange={e => setLutealDuration(Number(e.target.value))}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
          </div>
        </div>

        {/* Resumo das fases */}
        <div style={{
          background: "rgba(255,255,255,.62)", borderRadius: 18,
          border: "1px solid rgba(255,255,255,.82)", padding: "14px 16px", marginBottom: 24,
          backdropFilter: "blur(18px)", boxShadow: "0 14px 32px rgba(243,176,140,.08)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            Seu ciclo estimado
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { emoji: "🌙", label: "Menstrual", days: "5d", color: "var(--accent-peach)" },
              { emoji: "🌱", label: "Folicular", days: `${folicular - 5}d`, color: "var(--accent-sage)" },
              { emoji: "🚀", label: "Ovulatória", days: "3d", color: "var(--accent-sky)" },
              { emoji: "🌊", label: "Lútea", days: `${lutealDuration}d`, color: "var(--accent-sky)" },
            ].map(f => (
              <div key={f.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{f.emoji}</div>
                <p style={{ fontSize: 10, fontWeight: 700, color: f.color, margin: "0 0 1px" }}>{f.days}</p>
                <p style={{ fontSize: 9.5, color: "var(--text-3)", margin: 0 }}>{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 20 }}>
          💡 Esses dados ajudam a IA a entender sua energia em cada fase e personalizar sua agenda.
        </p>

        {/* CTAs */}
        <button
          onClick={() => persistAndGo("/onboarding/sleep")}
          style={{
            width: "100%", height: 46,
            background: "linear-gradient(135deg, var(--accent-peach) 0%, var(--accent-peach-strong) 100%)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 12px 24px rgba(243,176,140,.24)",
            marginBottom: 10,
          }}
        >
          Continuar →
        </button>
        <button
          onClick={() => persistAndGo("/onboarding/sleep")}
          style={{ width: "100%", height: 40, background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}
        >
          Pular por enquanto
        </button>
      </div>
    </div>
  );
}

