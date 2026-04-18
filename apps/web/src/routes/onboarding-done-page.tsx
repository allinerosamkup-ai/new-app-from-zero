// Onboarding: Conclusão — confetti + resumo do perfil
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { buildOnboardingProcessPayload } from "../features/aura/onboarding";
import { api } from "../lib/api";
import { AuraIcon } from "../components/AuraIcon";
import "../styles/aura.css";

function ConfettiPiece({ delay, x }: { delay: number; x: number }) {
  const colors = ["var(--accent-peach)", "var(--accent-sage)", "var(--accent-sky)", "var(--accent-peach-strong)", "var(--accent-sage-ink)"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: -10,
      width: 8,
      height: 8,
      borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      background: color,
      animation: `confetti-fall 2s ease-in ${delay}s both`,
    }} />
  );
}

export function OnboardingDonePage() {
  const navigate = useNavigate();
  const { state, refreshData } = useAuraStore();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  const nameSource = state.onboardingDraft.fullName || state.name;
  const name = nameSource ? nameSource.split(" ")[0] : "você";
  const preferredFocus = state.onboardingDraft.cognitivePreferences[0] ?? "A calibrar";
  const sleepQuality = state.onboardingDraft.sleepQuality || "não informado";

  async function handleFinish() {
    setSubmitting(true);
    setError(null);

    try {
      await api.post("/onboarding/process", buildOnboardingProcessPayload(state.onboardingDraft));
      await refreshData();
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFB 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "40px 28px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Confetti */}
        {show && Array.from({ length: 20 }, (_, i) => (
          <ConfettiPiece key={i} delay={i * 0.1} x={Math.random() * 100} />
        ))}

        {/* Logo Airia oficial */}
        <div style={{
          width: 84, height: 84, borderRadius: 28,
          background: "linear-gradient(135deg, #FFFFFF 0%, #FAFBFB 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 22,
          boxShadow: "0 20px 38px rgba(17,24,39,.08), 0 4px 12px rgba(17,24,39,.05)",
          border: "1px solid rgba(17,24,39,.04)",
          animation: "fade-up 0.6s ease both",
        }}>
          <AuraIcon size={54} />
        </div>

        {/* Título */}
        <h1 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 26, fontWeight: 800,
          color: "var(--text-1)", marginBottom: 10, lineHeight: 1.25,
          animation: "fade-up 0.6s ease 0.2s both",
        }}>
          Tudo pronto, {name}!
        </h1>
        <p style={{
          fontSize: 14, color: "var(--text-2)", lineHeight: 1.65, marginBottom: 32, maxWidth: 280,
          animation: "fade-up 0.6s ease 0.35s both",
        }}>
          Seu perfil foi criado com sucesso. A Airia já sabe como te ajudar melhor.
        </p>

        {/* Resumo do perfil */}
        <div style={{
          width: "100%", background: "rgba(255,255,255,.98)", backdropFilter: "blur(16px)",
          border: "1px solid rgba(17,24,39,.05)", borderRadius: 26,
          padding: 20, marginBottom: 32,
          animation: "fade-up 0.6s ease 0.5s both",
          boxShadow: "0 18px 32px rgba(17,24,39,.06)",
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 14 }}>
            SEU PERFIL
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { emoji: "🌙", label: "Ciclo",             value: state.onboardingDraft.cycleStart ? "Informado" : "A calibrar" },
              { emoji: "⚡", label: "Energia",           value: `${state.onboardingDraft.focusScore}/10 em dia bom` },
              { emoji: "😴", label: "Sono",              value: `${state.onboardingDraft.sleepHours}h (${sleepQuality})` },
              { emoji: "🎯", label: "Foco preferido",    value: preferredFocus },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.emoji}</span>
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p style={{
            width: "100%",
            color: "var(--accent-peach-ink)",
            background: "rgba(215,137,127,.1)",
            border: "1px solid rgba(215,137,127,.22)",
            borderRadius: 14,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.5,
            margin: "0 0 14px",
          }}>
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleFinish}
          disabled={submitting}
          style={{
            width: "100%", height: 50,
            background: "linear-gradient(135deg, #5A7A64 0%, #4E6B57 100%)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: submitting ? "wait" : "pointer", boxShadow: "0 14px 26px rgba(90,122,100,.18)",
            opacity: submitting ? 0.72 : 1,
            animation: "fade-up 0.6s ease 0.65s both",
          }}
        >
          {submitting ? "Salvando perfil..." : "Começar minha jornada"}
        </button>
      </div>
    </>
  );
}
