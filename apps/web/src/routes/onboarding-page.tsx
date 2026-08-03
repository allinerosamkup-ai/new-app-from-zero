import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useAuraStore } from "../features/aura/store";
import { ONBOARDING_BASIC_STEPS } from "../features/aura/onboarding";
import "../styles/aura.css";

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, updateOnboardingDraft } = useAuraStore();
  const [stepIndex, setStepIndex] = useState(0);

  const step = ONBOARDING_BASIC_STEPS[stepIndex];
  const value = String(state.onboardingDraft[step.field] ?? "");
  const canContinue = !step.required || value.trim().length > 0;
  const basicProgress = ((stepIndex + 1) / ONBOARDING_BASIC_STEPS.length) * 100;

  function handleContinue() {
    if (!canContinue) {
      return;
    }

    if (stepIndex === ONBOARDING_BASIC_STEPS.length - 1) {
      navigate("/onboarding/energy");
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function handleBack() {
    if (stepIndex === 0) {
      navigate("/preferences");
      return;
    }

    setStepIndex((current) => current - 1);
  }

  return (
    <div className="aura-page-shell">
      <div
        className="screen-content"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: "20px 20px 28px",
        }}
      >
        <div className="aura-page-header">
          <p className="aura-page-kicker">Onboarding</p>
          <h1 className="aura-page-title">{t("onboarding.title")}</h1>
          <p className="aura-page-subtitle">
            {t("onboarding.subtitle")}
          </p>

          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(169,210,187,.12)",
              overflow: "hidden",
              margin: "12px 0 4px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${basicProgress}%`,
                background: "var(--accent-peach)",
                borderRadius: 999,
                transition: "width .35s ease",
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>
            {t("onboarding.question", { current: stepIndex + 1, total: ONBOARDING_BASIC_STEPS.length })}
          </p>
        </div>

        <div
          key={step.field}
          className="aura-card animate-fade-in"
          style={{
            marginBottom: 16,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--accent-peach)",
            }}
          >
            {t("onboarding.step", { current: 1, total: 5 })}
          </p>
          <div>
            <h2
              style={{
                margin: "0 0 8px",
                color: "var(--text-1)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 22,
                lineHeight: 1.2,
              }}
            >
              {t(`onboarding.basic.${step.field}.question`)}
            </h2>
            <p style={{ margin: 0, color: "var(--text-2)", fontSize: 13, lineHeight: 1.55 }}>
              {t(`onboarding.basic.${step.field}.helper`)}
            </p>
          </div>

          <div className="aura-input aura-inline-field" style={{ minHeight: 54 }}>
            <input
              type={step.inputType ?? "text"}
              inputMode={step.inputType === "number" ? "numeric" : undefined}
              min={step.inputType === "number" ? 13 : undefined}
              max={step.inputType === "number" ? 120 : undefined}
              placeholder={t(`onboarding.basic.${step.field}.placeholder`)}
              value={value}
              onChange={(event) => updateOnboardingDraft({ [step.field]: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleContinue();
                }
              }}
              className="aura-inline-input"
              autoFocus
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <AuraButtonV2
            type="button"
            variant="outline"
            size="lg"
            onClick={handleBack}
            style={{ flex: 1 }}
          >
            {t("common.back")}
          </AuraButtonV2>
          <AuraButtonV2
            type="button"
            variant="primary"
            size="lg"
            onClick={handleContinue}
            disabled={!canContinue}
            style={{ flex: 1, opacity: canContinue ? 1 : 0.55 }}
          >
            {stepIndex === ONBOARDING_BASIC_STEPS.length - 1 ? t("common.continue") : t("onboarding.next")}
          </AuraButtonV2>
        </div>
      </div>
    </div>
  );
}
