// Onboarding: Como você pensa melhor? — cards de preferência cognitiva
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { PRIOR_DIAGNOSIS_OPTIONS, type PriorDiagnosis } from "../features/aura/onboarding";
import "../styles/aura.css";

const STEP = 5;
const TOTAL = 5;

const PREF_CARDS = [
  { id: "morning",   emoji: "🌅", label: "Foco máximo de manhã",   sub: "Criativa antes das 12h" },
  { id: "afternoon", emoji: "☀️", label: "Melhor à tarde",         sub: "Produtiva das 14h–18h" },
  { id: "night",     emoji: "🌙", label: "Trabalho bem à noite",   sub: "Foco após as 20h" },
  { id: "creative",  emoji: "🎨", label: "Tarefas criativas",      sub: "Criação, escrita, arte" },
  { id: "analytic",  emoji: "📊", label: "Tarefas analíticas",     sub: "Dados, planilhas, lógica" },
  { id: "short",     emoji: "⚡", label: "Blocos curtos",           sub: "25min com pausas" },
  { id: "deep",      emoji: "🔭", label: "Imersão profunda",       sub: "90min sem interrupção" },
];

export function OnboardingPreferencesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, updateOnboardingDraft } = useAuraStore();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(PREF_CARDS.filter((card) => state.onboardingDraft.cognitivePreferences.includes(card.label)).map((card) => card.id)),
  );
  const [diagnoses, setDiagnoses] = useState<Set<PriorDiagnosis>>(
    new Set(state.onboardingDraft.priorDiagnoses ?? []),
  );
  const [medication, setMedication] = useState<boolean | null>(
    state.onboardingDraft.medicationCurrentlyUsing ?? null,
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 3) {
      next.add(id);
    }
    setSelected(next);
  }

  function toggleDiagnosis(value: PriorDiagnosis) {
    const next = new Set(diagnoses);
    if (value === "prefer_not_to_say") {
      // Mutually exclusive: marking "prefer not to say" clears other choices.
      next.clear();
      next.add(value);
    } else {
      next.delete("prefer_not_to_say");
      if (next.has(value)) next.delete(value);
      else next.add(value);
    }
    setDiagnoses(next);
  }

  function persistAndGo(path: string) {
    const labels = PREF_CARDS
      .filter((card) => selected.has(card.id))
      .map((card) => card.label);

    updateOnboardingDraft({
      cognitivePreferences: labels,
      supportGoals: labels,
      primaryGoal: labels[0] ?? state.onboardingDraft.primaryGoal,
      priorDiagnoses: Array.from(diagnoses),
      medicationCurrentlyUsing: medication,
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
          {t("onboarding.preferences.title")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 6 }}>
          {t("onboarding.preferences.subtitle")}
        </p>
        <p style={{ fontSize: 11, color: "var(--accent-peach-ink)", fontWeight: 600, marginBottom: 24 }}>
          {t("onboarding.preferences.selected", { count: selected.size })}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {PREF_CARDS.map(c => {
            const active = selected.has(c.id);
            const disabled = !active && selected.size >= 3;
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                disabled={disabled}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 14, cursor: disabled ? "default" : "pointer",
                  border: `1.5px solid ${active ? "var(--accent-peach)" : "var(--warm-border-2)"}`,
                  background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.62)",
                  opacity: disabled ? 0.45 : 1,
                  transition: "all 150ms", textAlign: "left",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 10px 24px rgba(243,176,140,.08)",
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--accent-peach-ink)" : "var(--text-1)", margin: "0 0 2px" }}>{t(`onboarding.preferences.cards.${c.id}.label`)}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{t(`onboarding.preferences.cards.${c.id}.sub`)}</p>
                </div>
                {active && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent-peach)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.2L4.2 7.4L8 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Contexto opcional — autorrelato, não diagnóstico */}
        <div style={{ marginBottom: 24, padding: "16px 14px", background: "rgba(150,199,179,.08)", borderRadius: 14, border: "1.5px solid rgba(150,199,179,.20)" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-1)", margin: "0 0 4px" }}>
            {t("onboarding.preferences.diagnosisQuestion")} <span style={{ fontWeight: 500, color: "var(--text-3)" }}>{t("onboarding.preferences.optional")}</span>
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
            {t("onboarding.preferences.diagnosisHelp")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRIOR_DIAGNOSIS_OPTIONS.map((opt) => {
              const active = diagnoses.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDiagnosis(opt.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: `1.5px solid ${active ? "var(--menthe, #96C7B3)" : "rgba(176,180,196,.32)"}`,
                    background: active ? "rgba(150,199,179,.18)" : "rgba(255,255,255,.7)",
                    color: active ? "var(--text-1)" : "var(--text-2)",
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {diagnoses.size > 0 && !diagnoses.has("prefer_not_to_say") && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", margin: "0 0 6px" }}>
                {t("onboarding.preferences.medication")}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { label: t("common.yes"), value: true },
                  { label: t("common.no"), value: false },
                  { label: t("onboarding.preferences.preferNot"), value: null },
                ].map((opt) => {
                  const active = medication === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setMedication(opt.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: `1.5px solid ${active ? "var(--menthe, #96C7B3)" : "rgba(176,180,196,.32)"}`,
                        background: active ? "rgba(150,199,179,.18)" : "rgba(255,255,255,.7)",
                        color: active ? "var(--text-1)" : "var(--text-2)",
                        fontSize: 12,
                        fontWeight: active ? 800 : 600,
                        cursor: "pointer",
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CTAs */}
        <button
          onClick={() => persistAndGo("/onboarding/done")}
          disabled={selected.size === 0}
          style={{
            width: "100%", height: 46,
            background: selected.size > 0 ? "linear-gradient(135deg, var(--accent-peach) 0%, var(--accent-peach-strong) 100%)" : "rgba(215,137,127,.3)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            boxShadow: selected.size > 0 ? "0 12px 24px rgba(243,176,140,.24)" : "none",
            marginBottom: 10, transition: "all 200ms",
          }}
        >
          {t("common.continue")} →
        </button>
        <button
          onClick={() => persistAndGo("/onboarding/done")}
          style={{ width: "100%", height: 40, background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}
        >
          {t("onboarding.skip")}
        </button>
      </div>
    </div>
  );
}
