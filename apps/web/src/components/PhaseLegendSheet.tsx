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
      aria-label="As 8 fases de humor e energia"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(24, 26, 31, 0.34)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
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
          maxWidth: 480,
          maxHeight: "86vh",
          background: "var(--warm-bg)",
          border: "1px solid var(--warm-border)",
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          boxShadow: "0 -18px 48px rgba(17,24,39,0.18)",
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
              background: "var(--warm-border-2)",
            }}
          />
        </div>

        {/* Header */}
        <div style={{ padding: "8px 20px 14px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent-peach-ink)",
              marginBottom: 6,
              fontFamily: "var(--font-sans, sans-serif)",
            }}
          >
            {t("phases.kicker")}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              lineHeight: 1.18,
              fontWeight: 700,
              color: "var(--text-1)",
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
              color: "var(--text-2)",
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
            padding: "0 16px 14px",
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
                  padding: 14,
                  borderRadius: 18,
                  background: isCurrent ? "rgba(191,220,203,.14)" : "var(--warm-surface)",
                  border: isCurrent
                    ? "1.5px solid rgba(191,220,203,.46)"
                    : "1px solid var(--warm-border)",
                  boxShadow: isCurrent
                    ? "0 10px 24px rgba(191,220,203,.13)"
                    : "var(--shadow-3d)",
                  transition: "all 200ms ease",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    minWidth: 42,
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    background: `color-mix(in srgb, ${cfg.color} 22%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${cfg.color} 48%, transparent)`,
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
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--text-1)",
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
                          color: "var(--accent-peach-ink)",
                          background: "rgba(191,220,203,.18)",
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
                      color: "var(--text-2)",
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
                      color: "var(--text-3)",
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
            borderTop: "1px solid var(--warm-border)",
            background: "var(--warm-bg)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 16,
              background: "var(--accent-peach)",
              color: "#7B493B",
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
