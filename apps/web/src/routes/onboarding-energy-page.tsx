// Onboarding: Mapa de Energia — chips drena mais/menos + slider foco
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";

const DRAINS_MORE = ["Reuniões", "Crises", "Criar conteúdo", "Feedbacks difíceis", "Multitarefas", "Ruídos", "Decisões"];
const DRAINS_LESS = ["E-mails", "Listas", "Caminhada", "Leitura", "Organização", "Música", "Rotina"];

const STEP = 2;
const TOTAL = 5;

export function OnboardingEnergyPage() {
  const navigate = useNavigate();
  const { state, updateOnboardingDraft } = useAuraStore();
  const [drainsMore, setDrainsMore] = useState<Set<string>>(new Set(state.onboardingDraft.energyDrainsMore));
  const [drainsLess, setDrainsLess] = useState<Set<string>>(new Set(state.onboardingDraft.energyDrainsLess));
  const [foco, setFoco] = useState(state.onboardingDraft.focusScore);

  const focoPct = ((foco - 1) / 9) * 100;

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, item: string) {
    const next = new Set(set);
    next.has(item) ? next.delete(item) : next.add(item);
    setSet(next);
  }

  function persistAndGo(path: string) {
    const energyDrainsMore = Array.from(drainsMore);
    const energyDrainsLess = Array.from(drainsLess);
    updateOnboardingDraft({
      energyDrainsMore,
      energyDrainsLess,
      focusScore: foco,
      mainEnergyPressure: [
        energyDrainsMore.length ? `Drena mais: ${energyDrainsMore.join(", ")}.` : null,
        energyDrainsLess.length ? `Recupera energia: ${energyDrainsLess.join(", ")}.` : null,
        `Foco disponível em dia bom: ${foco}/10.`,
      ].filter(Boolean).join(" "),
    });
    navigate(path);
  }

  return (
    <div className="aura-page-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Barra de progresso */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 999,
              background: i < STEP ? "var(--accent-peach)" : i === STEP - 1 ? "var(--accent-peach)" : "rgba(215,137,127,.2)",
              transition: "background .3s",
            }} />
          ))}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-peach)", marginBottom: 4 }}>
          PASSO {STEP} DE {TOTAL}
        </p>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25, marginBottom: 6 }}>
          Como VOCÊ gasta energia?
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 24 }}>
          Selecione o que mais te cansa e o que te renova. Vamos usar isso para montar sua agenda ideal.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        {/* Drena MAIS */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-peach-strong)", marginBottom: 10 }}>
          ❗ Drena MAIS
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {DRAINS_MORE.map(item => {
            const active = drainsMore.has(item);
            return (
              <button
                key={item}
                onClick={() => toggle(drainsMore, setDrainsMore, item)}
                style={{
                  height: 32, padding: "0 14px", borderRadius: 999,
                  border: `1.5px solid ${active ? "var(--accent-peach)" : "var(--accent-peach-a3)"}`,
                  background: active ? "var(--accent-peach-a3)" : "rgba(255,255,255,.7)",
                  color: active ? "var(--accent-peach-ink)" : "var(--text-2)",
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all 150ms",
                }}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Drena MENOS */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-sage-ink)", marginBottom: 10 }}>
          💚 Drena MENOS
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
          {DRAINS_LESS.map(item => {
            const active = drainsLess.has(item);
            return (
              <button
                key={item}
                onClick={() => toggle(drainsLess, setDrainsLess, item)}
                style={{
                  height: 32, padding: "0 14px", borderRadius: 999,
                  border: `1.5px solid ${active ? "var(--accent-sage)" : "rgba(150,199,179,.3)"}`,
                  background: active ? "rgba(150,199,179,.13)" : "rgba(255,255,255,.7)",
                  color: active ? "var(--accent-sage-ink)" : "var(--text-2)",
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all 150ms",
                }}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Slider foco */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-sky)", marginBottom: 10 }}>
          ⚡ Foco disponível num dia bom
        </p>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Pouco</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--accent-sky)" }}>{foco}/10</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Total</span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ width: "100%", height: 8, background: "rgba(99,152,169,.15)", borderRadius: 999, position: "relative", overflow: "visible" }}>
              <div style={{ width: `${focoPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--accent-sage), var(--accent-sky))" }} />
              <div style={{ width: 20, height: 20, background: "#fff", border: "2px solid var(--accent-sky)", borderRadius: "50%", position: "absolute", top: "50%", left: `${focoPct}%`, transform: "translate(-50%, -50%)", boxShadow: "0 2px 8px rgba(99,152,169,.3)", pointerEvents: "none" }} />
            </div>
            <input type="range" min={1} max={10} step={1} value={foco} onChange={e => setFoco(Number(e.target.value))}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }} />
          </div>
        </div>

        {/* CTAs */}
        <button
          onClick={() => persistAndGo("/onboarding/cycle")}
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
          onClick={() => persistAndGo("/onboarding/cycle")}
          style={{
            width: "100%", height: 40, background: "none", border: "none",
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)", cursor: "pointer",
          }}
        >
          Pular por enquanto
        </button>
      </div>
    </div>
  );
}

