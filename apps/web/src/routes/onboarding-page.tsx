import { AuraButtonV2 } from "../components/aura-v2/AuraButtonV2";
// Onboarding Page v2 — chat AI mockup
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";

const perguntas = [
  "Olá! Vou te fazer 6 perguntas rápidas para entender sua rotina e ciclagem de humor. 👏",
  "Como você está se sentindo agora?",
  "Como tem sido seu sono ultimamente?",
  "Qual horário você costuma acordar e dormir?",
  "Você tem alguma rotina fixa durante o dia?",
  "O que te deixa com mais energia ao longo do dia?",
];

const respostasExemplo = [
  null,
  "Cansada mas esperançosa com o novo app!",
  "Irregular, acordo no meio da noite às vezes.",
  null, // step 4 = input de horário
  "Sim, academia de manhã e meditação.",
  "Café da manhã caprichado e conversas com amigas.",
];

export function OnboardingPage() {
  const { state, nextOnboardingStep } = useAuraStore();
  const navigate = useNavigate();
  const step = state.onboardingStep; // 1–6

  const [inputValue, setInputValue] = useState("");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");

  // Mensagens visíveis até o step atual (índices 0..step-1)
  const visibleMessages = perguntas.slice(0, step);

  function handleContinue() {
    if (step >= 6) {
      navigate("/home");
    } else {
      setInputValue("");
      nextOnboardingStep();
    }
  }

  const isStepHorario = step === 4;

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
        {/* Header */}
        <div className="aura-page-header">
          <p className="aura-page-kicker">Onboarding</p>
          <h1 className="aura-page-title">Vamos conhecer sua ciclagem.</h1>
          <p className="aura-page-subtitle">A Aura ajusta o app para energia, sono e rotina desde a primeira entrada.</p>
          {/* Progress bar */}
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(243,176,140,.12)",
              overflow: "hidden",
              margin: "12px 0 4px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(step / 6) * 100}%`,
                background: "var(--nectarine)",
                borderRadius: 999,
                transition: "width .35s ease",
              }}
            />
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              textAlign: "right",
            }}
          >
            {step} / 6
          </p>
        </div>

        {/* Chat bubbles */}
        <div className="aura-message-stack">
          {visibleMessages.map((pergunta, idx) => {
            const hasResposta =
              respostasExemplo[idx] !== null && idx < step - 1;
            const isHorarioStep = idx === 3 && idx < step - 1;

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Label Aura IA */}
                {idx === 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "var(--text-3)",
                      paddingBottom: 4,
                    }}
                  >
                    Aura IA
                  </span>
                )}

                {/* Bubble AI */}
                <div className="aura-bubble-ai-soft">
                  {pergunta}
                </div>

                {/* Resposta do usuário (horário) */}
                {isHorarioStep && (
                  <div className="aura-bubble-user-soft">
                    ☀️ {wakeTime} — 🌙 {sleepTime}
                  </div>
                )}

                {/* Resposta do usuário (texto) */}
                {hasResposta && !isHorarioStep && (
                  <div className="aura-bubble-user-soft">
                    {respostasExemplo[idx]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Input area */}
        <div style={{ marginTop: 8 }}>
          {isStepHorario ? (
            /* Step 4: inputs de horário */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                {/* Acordar */}
                <div
                  className="aura-surface-row"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 52,
                    padding: "0 12px",
                  }}
                >
                  <span style={{ fontSize: 16 }}>☀️</span>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "var(--text-3)",
                        letterSpacing: "0.08em",
                        marginBottom: 1,
                      }}
                    >
                      ACORDAR
                    </p>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                      className="aura-inline-input"
                      style={{ fontWeight: 600, width: "100%" }}
                    />
                  </div>
                </div>

                {/* Dormir */}
                <div
                  className="aura-surface-row"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 52,
                    padding: "0 12px",
                  }}
                >
                  <span style={{ fontSize: 16 }}>🌙</span>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "var(--text-3)",
                        letterSpacing: "0.08em",
                        marginBottom: 1,
                      }}
                    >
                      DORMIR
                    </p>
                    <input
                      type="time"
                      value={sleepTime}
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="aura-inline-input"
                      style={{ fontWeight: 600, width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              <AuraButtonV2
                variant="primary"
                size="lg"
                onClick={handleContinue}
                style={{ width: "100%" }}
              >
                Salvar horário →
              </AuraButtonV2>
            </div>
          ) : (
            /* Input de texto padrão */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="aura-input aura-inline-field" style={{ minHeight: 52 }}>
                <input
                  type="text"
                  placeholder="Escreva sua resposta..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContinue();
                  }}
                  className="aura-inline-input"
                />
              </div>
              <AuraButtonV2
                variant="primary"
                size="lg"
                onClick={handleContinue}
                style={{ width: "100%" }}
              >
                {step >= 6 ? "Concluir →" : "Continuar →"}
              </AuraButtonV2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
