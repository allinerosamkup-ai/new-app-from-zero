// Onboarding: Como você pensa melhor? — cards de preferência cognitiva
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/aura.css";

const STEP = 4;
const TOTAL = 7;

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
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 3) {
      next.add(id);
    }
    setSelected(next);
  }

  return (
    <div className="aura-page-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px 0" }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 999,
              background: i < STEP ? "var(--nectarine)" : "rgba(215,137,127,.2)",
            }} />
          ))}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--nectarine)", marginBottom: 4 }}>
          PASSO {STEP} DE {TOTAL}
        </p>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25, marginBottom: 6 }}>
          Como você pensa melhor?
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 6 }}>
          Selecione até 3 preferências. Vamos usar para organizar sua agenda de forma inteligente.
        </p>
        <p style={{ fontSize: 11, color: "var(--nectarine-11)", fontWeight: 600, marginBottom: 24 }}>
          {selected.size}/3 selecionadas
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
                  border: `1.5px solid ${active ? "var(--nectarine)" : "var(--warm-border-2)"}`,
                  background: active ? "var(--nectarine-a3)" : "rgba(255,255,255,.62)",
                  opacity: disabled ? 0.45 : 1,
                  transition: "all 150ms", textAlign: "left",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 10px 24px rgba(243,176,140,.08)",
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--nectarine-11)" : "var(--text-1)", margin: "0 0 2px" }}>{c.label}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{c.sub}</p>
                </div>
                {active && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--nectarine)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.2L4.2 7.4L8 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* CTAs */}
        <button
          onClick={() => navigate("/onboarding/done")}
          disabled={selected.size === 0}
          style={{
            width: "100%", height: 46,
            background: selected.size > 0 ? "linear-gradient(135deg, var(--nectarine) 0%, var(--nectarine-10) 100%)" : "rgba(215,137,127,.3)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            boxShadow: selected.size > 0 ? "0 12px 24px rgba(243,176,140,.24)" : "none",
            marginBottom: 10, transition: "all 200ms",
          }}
        >
          Continuar →
        </button>
        <button
          onClick={() => navigate("/onboarding/done")}
          style={{ width: "100%", height: 40, background: "none", border: "none", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}
        >
          Pular por enquanto
        </button>
      </div>
    </div>
  );
}
