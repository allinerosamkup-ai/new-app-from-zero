import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
// Preferences Page v2 — Configurações
import { useNavigate } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";

type ToggleProps = { on: boolean; onToggle: () => void };

function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div className={`toggle ${on ? "on" : "off"}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-knob" />
    </div>
  );
}

export function PreferencesPage() {
  const navigate = useNavigate();
  const { state, setName, setEmail, toggleCheckinReminder, toggleQuietMode, toggleTheme } = useAuraStore();

  const displayName = state.name
    ? state.name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : "";

  return (
    <div className="aura-page-shell">
      <div className="screen-content">
        {/* Header */}
        <div className="aura-page-header">
          <p className="aura-page-kicker">Ajustes</p>
          <h2 className="aura-page-title">Configurações</h2>
          <p className="aura-page-subtitle">Notificações, conta e preferências do seu ritmo em um único padrão visual.</p>
        </div>

        {/* Profile card */}
        <div
          className="aura-card"
          style={{
            marginBottom: "calc(var(--a) * 1.2)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--accent-peach)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "20px", color: "#fff", fontWeight: 700 }}>
              {(displayName || "?").charAt(0)}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
              {displayName || "Usuário"}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "2px 0 0" }}>{state.email}</p>
          </div>
          <AuraButtonV2 className="aura-btn-pill">
            Editar
          </AuraButtonV2>
        </div>

        {/* Perfil section */}
        <div className="config-section">
          <p className="config-section-title">Perfil</p>
          <div className="aura-input-wrap" style={{ marginBottom: "8px" }}>
            <label className="aura-input-label">Nome</label>
            <div className="aura-input aura-inline-field">
              <input
                type="text"
                value={state.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="aura-inline-input"
              />
            </div>
          </div>
          <div className="aura-input-wrap">
            <label className="aura-input-label">Email</label>
            <div className="aura-input aura-inline-field">
              <input
                type="email"
                value={state.email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="aura-inline-input"
              />
            </div>
          </div>
        </div>

        {/* Notificações section */}
        <div className="config-section">
          <p className="config-section-title">Notificações</p>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "var(--accent-peach-a3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Lembrete de check-in</p>
                <p className="config-row-sub">Diário às 8h da manhã</p>
              </div>
            </div>
            <Toggle on={state.checkinReminder ?? true} onToggle={toggleCheckinReminder} />
          </div>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(176,180,196,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Modo Tranquilo</p>
                <p className="config-row-sub">Sem notificações das 22h às 8h</p>
              </div>
            </div>
            <Toggle on={state.quietMode ?? false} onToggle={toggleQuietMode} />
          </div>
        </div>

        {/* Aparência section */}
        <div className="config-section">
          <p className="config-section-title">Aparência</p>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(180,185,169,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Tema do app</p>
                <p className="config-row-sub">{state.theme === "dark" ? "Escuro" : "Claro"}</p>
              </div>
            </div>
            <Toggle on={state.theme === "dark"} onToggle={toggleTheme} />
          </div>
        </div>

        {/* Conta section */}
        <div className="config-section">
          <p className="config-section-title">Conta</p>
          <div className="config-row" style={{ cursor: "pointer" }}>
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(197,165,147,.1)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <p className="config-row-text">Sair da conta</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        {/* Link onboarding */}
        <AuraButtonV2
          onClick={() => navigate("/onboarding")}
          className="btn btn-ghost btn-full"
          style={{ marginTop: 20, color: "var(--accent-peach)" }}
        >
          🔄 Refazer onboarding
        </AuraButtonV2>
      </div>
    </div>
  );
}

