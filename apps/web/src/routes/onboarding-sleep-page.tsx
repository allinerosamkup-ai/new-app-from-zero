// Onboarding: Sono — slider horas + cards qualidade + time pickers
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";

const STEP = 4;
const TOTAL = 5;

type SleepQuality = "bem" | "irregular" | "mal";

const QUALITY_CARDS: { id: SleepQuality; emoji: string; label: string; sub: string }[] = [
  { id: "bem",      emoji: "😴", label: "Durmo bem",   sub: "Acordo descansada" },
  { id: "irregular",emoji: "😶", label: "Irregular",   sub: "Varia bastante" },
  { id: "mal",      emoji: "😩", label: "Durmo mal",   sub: "Acordo cansada" },
];

export function OnboardingSleepPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, updateOnboardingDraft } = useAuraStore();
  const [horas, setHoras] = useState(state.onboardingDraft.sleepHours);
  const [quality, setQuality] = useState<SleepQuality | null>(state.onboardingDraft.sleepQuality || null);
  const [bedTime, setBedTime] = useState(state.onboardingDraft.sleepTime);
  const [wakeTime, setWakeTime] = useState(state.onboardingDraft.wakeTime);

  const horasPct = ((horas - 4) / 6) * 100;

  function persistAndGo(path: string) {
    const qualityLabel = QUALITY_CARDS.find((card) => card.id === quality)?.label ?? "Qualidade não informada";
    updateOnboardingDraft({
      sleepHours: horas,
      sleepQuality: quality ?? "",
      sleepTime: bedTime,
      wakeTime,
      sleepQualityNote: `${qualityLabel}; média de ${horas}h por noite; dorme por volta de ${bedTime} e acorda por volta de ${wakeTime}.`,
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
          {t("onboarding.step", { current: STEP, total: TOTAL })}
        </p>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25, marginBottom: 6 }}>
          {t("onboarding.sleep.title")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 24 }}>
          {t("onboarding.sleep.subtitle")}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>

        {/* Slider horas */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", margin: 0 }}>
              🌙 {t("onboarding.sleep.hours")}
            </p>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--accent-sky)" }}>
              {horas}h
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ width: "100%", height: 8, background: "rgba(99,152,169,.15)", borderRadius: 999, overflow: "visible", position: "relative" }}>
              <div style={{ width: `${horasPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent-sky), var(--accent-sage))" }} />
              <div style={{ width: 20, height: 20, background: "#fff", border: "2px solid var(--accent-sky)", borderRadius: "50%", position: "absolute", top: "50%", left: `${horasPct}%`, transform: "translate(-50%, -50%)", boxShadow: "0 2px 8px rgba(99,152,169,.25)", pointerEvents: "none" }} />
            </div>
            <input type="range" min={4} max={10} step={0.5} value={horas} onChange={e => setHoras(Number(e.target.value))}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>4h</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>10h</span>
          </div>
        </div>

        {/* Cards qualidade */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>
          ✨ {t("onboarding.sleep.quality")}
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {QUALITY_CARDS.map(c => {
            const active = quality === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setQuality(c.id)}
                style={{
                  flex: 1, padding: "14px 8px", borderRadius: 14, cursor: "pointer",
                  border: `1.5px solid ${active ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                  background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.62)",
                  transition: "all 150ms",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 10px 24px rgba(243,176,140,.08)",
                }}
              >
                <span style={{ fontSize: 24 }}>{c.emoji}</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent-peach-ink)" : "var(--text-1)", margin: 0 }}>{t(`onboarding.sleep.cards.${c.id}.label`)}</p>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0 }}>{t(`onboarding.sleep.cards.${c.id}.sub`)}</p>
              </button>
            );
          })}
        </div>

        {/* Time pickers */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>
          ⏰ {t("onboarding.sleep.usualTimes")}
        </p>
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>{t("onboarding.sleep.bed")}</p>
            <input type="time" value={bedTime} onChange={e => setBedTime(e.target.value)}
              style={{
                width: "100%", height: 46, borderRadius: 12,
                border: "1.5px solid var(--warm-border-2)", padding: "0 12px",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: "var(--text-1)",
                background: "rgba(255,255,255,.72)", outline: "none", boxSizing: "border-box",
                backdropFilter: "blur(16px)", boxShadow: "0 10px 24px rgba(243,176,140,.08)",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>{t("onboarding.sleep.wake")}</p>
            <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
              style={{
                width: "100%", height: 46, borderRadius: 12,
                border: "1.5px solid var(--warm-border-2)", padding: "0 12px",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: "var(--text-1)",
                background: "rgba(255,255,255,.72)", outline: "none", boxSizing: "border-box",
                backdropFilter: "blur(16px)", boxShadow: "0 10px 24px rgba(243,176,140,.08)",
              }}
            />
          </div>
        </div>

        {/* CTAs */}
        <button
          onClick={() => persistAndGo("/onboarding/preferences")}
          style={{
            width: "100%", height: 46,
            background: "linear-gradient(135deg, var(--accent-peach) 0%, var(--accent-peach-strong) 100%)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 12px 24px rgba(243,176,140,.24)", marginBottom: 10,
          }}
        >
          {t("common.continue")} →
        </button>
        <button
          onClick={() => persistAndGo("/onboarding/preferences")}
          style={{ width: "100%", height: 40, background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}
        >
          {t("onboarding.skip")}
        </button>
      </div>
    </div>
  );
}

