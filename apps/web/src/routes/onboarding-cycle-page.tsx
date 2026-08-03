// Onboarding: Ciclo Menstrual — date picker + sliders duração
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import {
  BIOLOGICAL_SEX_OPTIONS,
  tracksMenstrualCycle,
  type BiologicalSex,
} from "../features/aura/onboarding";
import "../styles/aura.css";

const STEP = 3;
const TOTAL = 5;

export function OnboardingCyclePage() {
  const { t } = useTranslation();
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { state, updateOnboardingDraft } = useAuraStore();
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(
    state.onboardingDraft.biologicalSex,
  );
  const [lastPeriod, setLastPeriod] = useState(state.onboardingDraft.cycleStart);
  const [cycleDuration, setCycleDuration] = useState(state.onboardingDraft.cycleLength);
  const [lutealDuration, setLutealDuration] = useState(state.onboardingDraft.lutealLength);

  // Enquanto ninguém respondeu, nada de ciclo aparece: perguntar duração de
  // ciclo antes de saber se a pessoa menstrua é o que estava errado aqui.
  const showCycleFields = biologicalSex !== null && tracksMenstrualCycle(biologicalSex);

  const cycleMin = 21, cycleMax = 35;
  const lutealMin = 10, lutealMax = 16;

  const cyclePct  = ((cycleDuration  - cycleMin)  / (cycleMax  - cycleMin))  * 100;
  const lutealPct = ((lutealDuration - lutealMin) / (lutealMax - lutealMin)) * 100;

  const folicular = cycleDuration - lutealDuration;

  function persistAndGo(path: string) {
    updateOnboardingDraft({
      biologicalSex,
      // Quem não rastreia ciclo não leva os defaults de 28/14 adiante.
      cycleStart: showCycleFields ? lastPeriod : "",
      cycleLength: showCycleFields ? cycleDuration : 0,
      lutealLength: showCycleFields ? lutealDuration : 0,
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
              background: i < STEP ? "var(--accent-peach)" : "rgba(134,183,154,.2)",
            }} />
          ))}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-peach)", marginBottom: 4 }}>
          {t("onboarding.step", { current: STEP, total: TOTAL })}
        </p>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25, marginBottom: 6 }}>
          {t("onboarding.cycle.title")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 24 }}>
          {t("onboarding.cycle.subtitle")}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>

        {/* Gate: define se o resto desta etapa faz sentido para esta pessoa. */}
        <fieldset style={{ margin: "0 0 24px", padding: 0, border: 0 }}>
          <legend style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10, padding: 0 }}>
            {l("Sexo biológico", "Biological sex")}
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {BIOLOGICAL_SEX_OPTIONS.map((option) => {
              const active = biologicalSex === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBiologicalSex(active ? null : option.value)}
                  style={{
                    minHeight: 48,
                    borderRadius: 12,
                    border: `1.5px solid ${active ? "var(--accent-peach-strong)" : "var(--warm-border-2)"}`,
                    background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.72)",
                    color: active ? "var(--accent-peach-ink)" : "var(--text-2)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: active ? 800 : 600,
                    cursor: "pointer",
                    padding: "8px 10px",
                  }}
                >
                  {{
                    female: l("Feminino", "Female"),
                    male: l("Masculino", "Male"),
                  }[option.value]}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, margin: "10px 0 0" }}>
            {biologicalSex !== null && !showCycleFields
              ? l(
                "Sem rastreamento de ciclo menstrual. As perguntas de ciclo somem daqui e do check-in.",
                "Menstrual cycle tracking is off. Cycle questions disappear from here and from the check-in.",
              )
              : l(
                "Usado só para decidir se o app acompanha ciclo menstrual como modulador do seu humor.",
                "Used only to decide whether the app tracks the menstrual cycle as a modulator of your mood.",
              )}
          </p>
        </fieldset>

        {showCycleFields && (
        <>
        {/* Date picker */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>
            🗓️ {t("onboarding.cycle.lastPeriod")}
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
              boxShadow: "0 12px 28px rgba(169,210,187,.08)",
            }}
          />
        </div>

        {/* Slider: duração do ciclo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
              🔄 {t("onboarding.cycle.duration")}
            </p>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--accent-peach)" }}>
              {t("onboarding.cycle.days", { count: cycleDuration })}
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ width: "100%", height: 8, background: "var(--accent-peach-a3)", borderRadius: 999, overflow: "visible", position: "relative" }}>
              <div style={{ width: `${cyclePct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent-sage), var(--accent-peach))" }} />
              <div style={{ width: 20, height: 20, background: "#fff", border: "2px solid var(--accent-peach)", borderRadius: "50%", position: "absolute", top: "50%", left: `${cyclePct}%`, transform: "translate(-50%, -50%)", boxShadow: "0 2px 8px rgba(134,183,154,.25)", pointerEvents: "none" }} />
            </div>
            <input type="range" min={cycleMin} max={cycleMax} value={cycleDuration} onChange={e => setCycleDuration(Number(e.target.value))}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t("onboarding.cycle.days", { count: cycleMin })}</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t("onboarding.cycle.days", { count: cycleMax })}</span>
          </div>
        </div>

        {/* Slider: fase lútea */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
              🌊 {t("onboarding.cycle.luteal")}
            </p>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--accent-sky)" }}>
              {t("onboarding.cycle.days", { count: lutealDuration })}
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
          backdropFilter: "blur(18px)", boxShadow: "0 14px 32px rgba(169,210,187,.08)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            {t("onboarding.cycle.estimate")}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { emoji: "🌙", label: t("onboarding.cycle.menstrual"), days: "5d", color: "var(--accent-peach)" },
              { emoji: "🌱", label: t("onboarding.cycle.follicular"), days: `${folicular - 5}d`, color: "var(--accent-sage)" },
              { emoji: "🚀", label: t("onboarding.cycle.ovulatory"), days: "3d", color: "var(--accent-sky)" },
              { emoji: "🌊", label: t("onboarding.cycle.luteal"), days: `${lutealDuration}d`, color: "var(--accent-sky)" },
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
          💡 {t("onboarding.cycle.tip")}
        </p>
        </>
        )}

        {/* CTAs */}
        <button
          onClick={() => persistAndGo("/onboarding/sleep")}
          style={{
            width: "100%", height: 46,
            background: "linear-gradient(135deg, var(--accent-peach) 0%, var(--accent-peach-strong) 100%)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 12px 24px rgba(169,210,187,.24)",
            marginBottom: 10,
          }}
        >
          {t("common.continue")} →
        </button>
        <button
          onClick={() => persistAndGo("/onboarding/sleep")}
          style={{ width: "100%", height: 40, background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}
        >
          {t("onboarding.skip")}
        </button>
      </div>
    </div>
  );
}

