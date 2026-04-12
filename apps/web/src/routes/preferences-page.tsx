import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
// Preferences Page v2 — Configurações
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NotificationPreferences } from "../features/aura/types";
import { useAuraStore } from "../features/aura/store";
import "../styles/aura.css";

type ToggleProps = { on: boolean; onToggle: () => void | Promise<void> };

function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div className={`toggle ${on ? "on" : "off"}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-knob" />
    </div>
  );
}

export function PreferencesPage() {
  const navigate = useNavigate();
  const {
    state,
    setName,
    toggleCheckinReminder,
    setCheckinReminderTimes,
    updateNotificationPreferences,
    toggleQuietMode,
    toggleTheme,
    resetOnboardingDraft,
    saveProfile,
    signOut,
  } = useAuraStore();
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(true);

  const displayName = state.name
    ? state.name.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : "";

  async function handleSaveProfile() {
    setAccountStatus(null);
    try {
      await saveProfile();
      setAccountStatus("Perfil salvo.");
    } catch {
      setAccountStatus("Não consegui salvar o perfil agora.");
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleRedoOnboarding() {
    resetOnboardingDraft();
    navigate("/onboarding");
  }

  async function handleNotificationPatch(patch: Partial<NotificationPreferences>) {
    if (Object.values(patch).some((value) => value === true)) {
      const { requestNotificationPermission } = await import("../hooks/useHabitReminders");
      await requestNotificationPermission();
    }
    await updateNotificationPreferences(patch);
  }

  const notificationPrefs = state.notificationPreferences;

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
          <AuraButtonV2 className="aura-btn-pill" onClick={handleSaveProfile}>
            Salvar
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
                readOnly
                placeholder="E-mail de login"
                className="aura-inline-input"
                style={{ color: "var(--text-3)" }}
              />
            </div>
          </div>
          {accountStatus && (
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "8px 0 0" }}>
              {accountStatus}
            </p>
          )}
        </div>

        {/* Notificações section */}
        <div className="config-section">
          <button
            type="button"
            className="config-section-title config-section-toggle"
            onClick={() => setNotificationsOpen((open) => !open)}
            aria-expanded={notificationsOpen}
          >
            <span>Notificações</span>
            <span>{notificationsOpen ? "Recolher" : "Abrir"}</span>
          </button>
          {notificationsOpen && (
            <>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "var(--accent-peach-a3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Lembretes de check-in</p>
                <p className="config-row-sub">Manhã às {state.morningCheckinTime} e noite às {state.eveningCheckinTime}</p>
              </div>
            </div>
            <Toggle on={state.checkinReminder ?? true} onToggle={toggleCheckinReminder} />
          </div>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(150,199,179,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Horários do check-in</p>
                <p className="config-row-sub">Ajuste fino dos dois lembretes diários</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="time"
                value={state.morningCheckinTime}
                onChange={(event) => setCheckinReminderTimes({ morning: event.target.value })}
                className="aura-inline-input"
                style={{ width: 82, fontSize: 12, fontWeight: 700 }}
                aria-label="Horário do check-in da manhã"
              />
              <input
                type="time"
                value={state.eveningCheckinTime}
                onChange={(event) => setCheckinReminderTimes({ evening: event.target.value })}
                className="aura-inline-input"
                style={{ width: 82, fontSize: 12, fontWeight: 700 }}
                aria-label="Horário do check-in da noite"
              />
            </div>
          </div>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(212,196,224,.16)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9D8DB1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Escrever no diário</p>
                <p className="config-row-sub">Duas chamadas por dia, às {notificationPrefs.journalMorningTime} e {notificationPrefs.journalEveningTime}</p>
              </div>
            </div>
            <Toggle
              on={notificationPrefs.journal}
              onToggle={() => handleNotificationPatch({ journal: !notificationPrefs.journal })}
            />
          </div>
          {notificationPrefs.journal && (
            <div className="config-row">
              <div className="config-row-label">
                <div className="icon-bg" style={{ background: "rgba(176,180,196,.12)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="config-row-text">Horários do diário</p>
                  <p className="config-row-sub">Primeiro e segundo lembrete</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="time"
                  value={notificationPrefs.journalMorningTime}
                  onChange={(event) => handleNotificationPatch({ journalMorningTime: event.target.value })}
                  className="aura-inline-input"
                  style={{ width: 82, fontSize: 12, fontWeight: 700 }}
                  aria-label="Primeiro horário do diário"
                />
                <input
                  type="time"
                  value={notificationPrefs.journalEveningTime}
                  onChange={(event) => handleNotificationPatch({ journalEveningTime: event.target.value })}
                  className="aura-inline-input"
                  style={{ width: 82, fontSize: 12, fontWeight: 700 }}
                  aria-label="Segundo horário do diário"
                />
              </div>
            </div>
          )}
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(150,199,179,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Agenda e tarefas</p>
                <p className="config-row-sub">Avisos no horário marcado</p>
              </div>
            </div>
            <Toggle
              on={notificationPrefs.planner}
              onToggle={() => handleNotificationPatch({ planner: !notificationPrefs.planner })}
            />
          </div>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(244,168,150,.14)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" /><path d="M5 9c4 0 7-3 7-7 0 4 3 7 7 7" /><path d="M5 15c4 0 7 3 7 7 0-4 3-7 7-7" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Hábitos</p>
                <p className="config-row-sub">Água, plantas, remédios, rotina e metas pequenas</p>
              </div>
            </div>
            <Toggle
              on={notificationPrefs.habits}
              onToggle={() => handleNotificationPatch({ habits: !notificationPrefs.habits })}
            />
          </div>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(176,180,196,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4v6h6" /><path d="M20 20v-6h-6" /><path d="M20 9a8 8 0 0 0-13.5-3.5L4 8" /><path d="M4 15a8 8 0 0 0 13.5 3.5L20 16" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Notificação insistente</p>
                <p className="config-row-sub">Repete até a tarefa ou hábito ser concluído</p>
              </div>
            </div>
            <Toggle
              on={notificationPrefs.persistent}
              onToggle={() => handleNotificationPatch({ persistent: !notificationPrefs.persistent })}
            />
          </div>
          <div className="config-row">
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(184,217,200,.16)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Sugestões da Airia</p>
                <p className="config-row-sub">Toques de revisão, retomada e mudança de fase</p>
              </div>
            </div>
            <Toggle
              on={notificationPrefs.aiSuggestions}
              onToggle={() => handleNotificationPatch({ aiSuggestions: !notificationPrefs.aiSuggestions })}
            />
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
                <p className="config-row-sub">Sem notificações das {state.quietModeStartTime} às {state.quietModeEndTime}</p>
              </div>
            </div>
            <Toggle on={state.quietMode ?? false} onToggle={toggleQuietMode} />
          </div>
          </>
          )}
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
          <div
            className="config-row"
            style={{ cursor: isSigningOut ? "wait" : "pointer", opacity: isSigningOut ? 0.7 : 1 }}
            onClick={handleSignOut}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void handleSignOut();
              }
            }}
          >
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(197,165,147,.1)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <p className="config-row-text">{isSigningOut ? "Saindo..." : "Sair da conta"}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        {/* Link onboarding */}
        <AuraButtonV2
          onClick={handleRedoOnboarding}
          className="btn btn-ghost btn-full"
          style={{ marginTop: 20, color: "var(--accent-peach)" }}
        >
          🔄 Refazer onboarding
        </AuraButtonV2>
      </div>
    </div>
  );
}

