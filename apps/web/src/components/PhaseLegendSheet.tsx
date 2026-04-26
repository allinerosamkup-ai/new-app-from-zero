// PhaseLegendSheet — modal educativo das 8 fases do Ciclo de Humor
// Lista todas as fases definidas no MoodCycleEngine e destaca a atual.
// Textos vêm do i18n (PT/EN); fallback para PHASE_CONFIG (PT).
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PHASE_CONFIG, type MoodPhase } from "../utils/mood-cycle-engine";

interface PhaseLegendSheetProps {
  open: boolean;
  onClose: () => void;
  currentPhase?: MoodPhase;
}

// Ordem narrativa (alta → baixa → recuperação → instável)
const PHASE_ORDER: MoodPhase[] = [
  "elevated",
  "flowing",
  "stable",
  "falling",
  "low",
  "depleted",
  "recovering",
  "mixed",
];

export function PhaseLegendSheet({ open, onClose, currentPhase }: PhaseLegendSheetProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="As 8 fases do ciclo de humor"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28, 22, 20, 0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 180ms ease-out",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          background: "#FAF6F2",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 6 }}>
          <div
            style={{
              width: 44,
              height: 5,
              borderRadius: 999,
              background: "rgba(74, 59, 55, 0.18)",
            }}
          />
        </div>

        {/* Header */}
        <div style={{ padding: "8px 24px 16px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#A8544A",
              marginBottom: 6,
              fontFamily: "var(--font-sans, sans-serif)",
            }}
          >
            {t("phases.kicker")}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 26,
              lineHeight: 1.18,
              fontWeight: 700,
              color: "#2A2A2A",
              fontFamily: "var(--font-serif, 'Fraunces', serif)",
            }}
          >
            {t("phases.title")}
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#6B5E5A",
              fontFamily: "var(--font-sans, sans-serif)",
            }}
          >
            {t("phases.subtitle")}
          </p>
        </div>

        {/* Lista de fases */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {PHASE_ORDER.map((phase) => {
            const cfg = PHASE_CONFIG[phase];
            const isCurrent = currentPhase === phase;
            const label = t(`phases.${phase}.label`, cfg.label);
            const description = t(`phases.${phase}.description`, cfg.description);
            const tip = t(`phases.${phase}.tip`, cfg.tip);
            return (
              <div
                key={phase}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: 16,
                  borderRadius: 18,
                  background: isCurrent ? "rgba(215, 137, 127, 0.10)" : "#FFFFFF",
                  border: isCurrent
                    ? "1.5px solid rgba(215, 137, 127, 0.55)"
                    : "1px solid rgba(74, 59, 55, 0.08)",
                  boxShadow: isCurrent
                    ? "0 6px 20px rgba(215, 137, 127, 0.15)"
                    : "0 2px 8px rgba(0,0,0,0.03)",
                  transition: "all 200ms ease",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    minWidth: 44,
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    background: cfg.color,
                    opacity: 0.9,
                  }}
                  aria-hidden
                >
                  {cfg.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#2A2A2A",
                        fontFamily: "var(--font-serif, 'Fraunces', serif)",
                      }}
                    >
                      {label}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#A8544A",
                          background: "rgba(215, 137, 127, 0.18)",
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontFamily: "var(--font-sans, sans-serif)",
                        }}
                      >
                        {t("phases.youAreHere")}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "#6B5E5A",
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    {description}
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      color: "#8B7B77",
                      fontStyle: "italic",
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    💡 {tip}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer / close button */}
        <div
          style={{
            padding: "12px 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
            borderTop: "1px solid rgba(74, 59, 55, 0.06)",
            background: "#FAF6F2",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 18,
              background: "#2A2A2A",
              color: "#FAF6F2",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans, sans-serif)",
              letterSpacing: "0.02em",
            }}
          >
            {t("common.got_it")}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
