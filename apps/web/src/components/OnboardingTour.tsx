import { useState, useEffect } from "react";
import { AuraButtonV2 } from "./editorial/AuraButtonV2";

const TOUR_KEY = "aura_tour_v1_done";

const STEPS = [
  {
    icon: "🌡️",
    title: "Check-in diário",
    desc: "Registre seu humor, energia e sono uma vez por dia. A Aura usa esses dados para entender seus ciclos e orientar seu dia.",
    color: "var(--nectarine, #D7897F)",
    bg: "rgba(215,137,127,0.08)",
  },
  {
    icon: "🔁",
    title: "Hábitos",
    desc: "Crie micro-hábitos alinhados ao seu estado atual. Streaks, lembretes e conquistas para manter o ritmo.",
    color: "var(--menthe, #96C7B3)",
    bg: "rgba(150,199,179,0.08)",
  },
  {
    icon: "📔",
    title: "Diário reflexivo",
    desc: "Converse com a Aura sobre como está se sentindo. Ela escuta, reflete e guarda o que importa para te conhecer melhor.",
    color: "var(--lagune, #6398A9)",
    bg: "rgba(99,152,169,0.08)",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      // Pequeno delay para não sobrecarregar o carregamento inicial
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function finish() {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  if (!visible) return null;

  const s = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={finish}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(24,26,31,0.52)",
          zIndex: 9998,
          animation: "page-enter 0.2s ease-out",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#fff",
          borderRadius: "24px 24px 0 0",
          padding: "28px 24px 36px",
          animation: "tour-up 0.3s cubic-bezier(.22,.68,0,1.2) both",
        }}
      >
        {/* Step dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? s.color : "var(--warm-border)",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: s.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          margin: "0 auto 20px",
        }}>
          {s.icon}
        </div>

        {/* Text */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", margin: "0 0 10px" }}>
            {s.title}
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.65, margin: 0 }}>
            {s.desc}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={finish}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              border: "1.5px solid var(--warm-border)",
              background: "transparent",
              color: "var(--text-3)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Pular
          </button>
          <AuraButtonV2
            variant="primary"
            onClick={next}
            style={{ flex: 2, height: 48, fontSize: 14, fontWeight: 800 }}
          >
            {step < STEPS.length - 1 ? "Próximo →" : "Começar 🚀"}
          </AuraButtonV2>
        </div>
      </div>

      <style>{`
        @keyframes tour-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
