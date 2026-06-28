import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
// Preferences Page v2 — Configurações
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { setLanguage, getCurrentLanguage, type SupportedLanguage } from "../i18n";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { NotificationPreferences } from "../features/aura/types";
import { useAuraStore } from "../features/aura/store";
import { PhaseLegendSheet } from "../components/PhaseLegendSheet";
import { computeMoodCycle } from "../utils/mood-cycle-engine";
import { api } from "../lib/api";
import { trackEvent } from "../lib/track";
import { isNativeShell, requestNativeHealthConnectSync } from "../utils/native-shell";
import { supabase } from "../lib/supabase";
import { ReferralCard } from "../components/ReferralCard";
import "../styles/aura.css";

type GCalCalendar = {
  id: string;
  summary: string;
  description: string;
  primary: boolean;
  backgroundColor: string;
  selected: boolean;
  accessRole?: string;
};

function getDefaultSelectedCalendarIds(calendars: GCalCalendar[]) {
  return calendars
    .filter((calendar) => calendar.selected && calendar.accessRole !== "none")
    .map((calendar) => calendar.id);
}

function GCalSettingsSection({ onStatusChange }: { onStatusChange: (msg: string | null) => void }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [calendarsOpen, setCalendarsOpen] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const res = await api.get("/gcal/calendars");
      const isConnected = !!res?.connected;
      setConnected(isConnected);

      if (isConnected && Array.isArray(res.calendars)) {
        const nextCalendars = res.calendars as GCalCalendar[];
        const saved = Array.isArray(res.selectedIds) ? (res.selectedIds as string[]) : [];
        setCalendars(nextCalendars);
        setSelectedIds(saved.length > 0 ? saved : getDefaultSelectedCalendarIds(nextCalendars));
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  async function loadCalendars() {
    try {
      const res = await api.get("/gcal/calendars");
      if (res?.connected && res?.calendars) {
        const nextCalendars = res.calendars as GCalCalendar[];
        setCalendars(nextCalendars);
        const saved = Array.isArray(res.selectedIds) ? (res.selectedIds as string[]) : [];
        setSelectedIds(saved.length > 0 ? saved : getDefaultSelectedCalendarIds(nextCalendars));
        setCalendarsOpen(true);
      }
    } catch {
      onStatusChange("Não consegui carregar as agendas.");
    }
  }

  async function handleConnect() {
    trackEvent("gcal_connect_clicked", {
      connected: false,
    });
    try {
      const res = await api.get("/gcal/auth-url");
      const url = res?.url || res?.authUrl;
      if (typeof url === "string" && url) {
        window.location.href = url;
        return;
      }
      onStatusChange("Não consegui abrir a conexão com o Google Agenda.");
    } catch {
      onStatusChange("Não consegui conectar o Google Agenda agora.");
    }
  }

  async function handleDisconnect() {
    try {
      await api.post("/gcal/disconnect", {});
      setConnected(false);
      setCalendars([]);
      setSelectedIds([]);
      setCalendarsOpen(false);
      onStatusChange("Google Agenda desconectado.");
    } catch {
      onStatusChange("Erro ao desconectar.");
    }
  }

  function toggleCalendar(calId: string) {
    setSelectedIds(prev => {
      if (prev.includes(calId)) {
        if (prev.length <= 1) return prev; // at least 1
        return prev.filter(id => id !== calId);
      }
      return [...prev, calId];
    });
  }

  async function saveSelection() {
    setSaving(true);
    try {
      await api.put("/gcal/calendars", { calendarIds: selectedIds });
      onStatusChange("Agendas selecionadas salvas!");
      setTimeout(() => onStatusChange(null), 2000);
    } catch {
      onStatusChange("Erro ao salvar seleção de agendas.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="config-row">
        <div className="config-row-label">
          <div className="icon-bg" style={{ background: "rgba(176,180,196,.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <p className="config-row-text">Google Agenda</p>
            <p className="config-row-sub">Verificando conexão...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Connection status row */}
      <div className="config-row" style={{ cursor: "pointer" }} onClick={connected ? () => { if (!calendarsOpen) loadCalendars(); setCalendarsOpen(o => !o); } : handleConnect}>
        <div className="config-row-label">
          <div className="icon-bg" style={{ background: connected ? "rgba(150,199,179,.14)" : "rgba(176,180,196,.12)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={connected ? "var(--accent-sage)" : "var(--accent-sky)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <p className="config-row-text">Google Agenda</p>
            <p className="config-row-sub">
              {connected ? `${selectedIds.length || calendars.length} agenda${(selectedIds.length || calendars.length) === 1 ? "" : "s"} sincronizada${(selectedIds.length || calendars.length) === 1 ? "" : "s"}` : "Toque para conectar sua agenda"}
            </p>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: calendarsOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Calendar selection panel */}
      {connected && calendarsOpen && (
        <div style={{
          padding: "12px 16px",
          background: "var(--bg-2, rgba(0,0,0,.02))",
          borderRadius: "8px",
          margin: "4px 0 8px",
        }}>
          {calendars.length === 0 ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 8px" }}>Carregando agendas...</p>
              <button
                onClick={loadCalendars}
                style={{
                  background: "none", border: "1px solid var(--accent-sky)", borderRadius: 8,
                  padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "var(--accent-sky)", cursor: "pointer"
                }}
              >
                Carregar agendas
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Agendas sincronizadas no Planner
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {calendars.map(cal => (
                  <label
                    key={cal.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      background: selectedIds.includes(cal.id) ? "rgba(150,199,179,.08)" : "transparent",
                      cursor: "pointer", transition: "background .15s",
                    }}
                  >
                    <span style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: cal.backgroundColor, flexShrink: 0,
                    }} />
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(cal.id)}
                      onChange={() => toggleCalendar(cal.id)}
                      style={{ display: "none" }}
                    />
                    <span style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: selectedIds.includes(cal.id) ? "none" : "1.5px solid var(--text-3)",
                      background: selectedIds.includes(cal.id) ? "var(--accent-sage)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s",
                    }}>
                      {selectedIds.includes(cal.id) && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cal.summary} {cal.primary && <span style={{ fontSize: 10, color: "var(--text-3)" }}>(principal)</span>}
                      </p>
                      {cal.description && (
                        <p style={{ fontSize: 10, color: "var(--text-3)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cal.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
                <button
                  onClick={handleDisconnect}
                  style={{
                    background: "none", border: "1px solid rgba(197,165,147,.3)", borderRadius: 8,
                    padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "var(--accent-peach)", cursor: "pointer",
                  }}
                >
                  Desconectar
                </button>
                <button
                  onClick={saveSelection}
                  disabled={saving}
                  style={{
                    background: "var(--accent-sage)", border: "none", borderRadius: 8,
                    padding: "6px 18px", fontSize: 11, fontWeight: 700, color: "#fff", cursor: saving ? "wait" : "pointer",
                    opacity: saving ? .7 : 1,
                  }}
                >
                  {saving ? "Salvando..." : "Salvar seleção"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function HealthConnectSettingsSection({ onStatusChange }: { onStatusChange: (msg: string | null) => void }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const nativeAvailable = isNativeShell();

  const loadLatest = useCallback(async () => {
    try {
      const res = await api.get("/health-connect/latest");
      setSnapshot(res?.snapshot && typeof res.snapshot === "object" ? res.snapshot as Record<string, unknown> : null);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLatest(); }, [loadLatest]);

  async function handleSync() {
    if (!nativeAvailable) {
      onStatusChange("Health Connect fica disponível no app Android instalado.");
      return;
    }

    setSyncing(true);
    try {
      const result = await requestNativeHealthConnectSync();
      if (!result.ok) {
        onStatusChange(result.error || "Não consegui sincronizar o Health Connect.");
        return;
      }
      await loadLatest();
      onStatusChange("Health Connect sincronizado.");
      setTimeout(() => onStatusChange(null), 2400);
    } finally {
      setSyncing(false);
    }
  }

  const sleepMinutes = typeof snapshot?.sleepMinutes === "number" ? snapshot.sleepMinutes : null;
  const steps = typeof snapshot?.steps === "number" ? snapshot.steps : null;
  const syncedAt = typeof snapshot?.syncedAt === "string" ? snapshot.syncedAt : null;
  const sleepText = sleepMinutes ? `${Math.round((sleepMinutes / 60) * 10) / 10}h de sono` : "sono ainda não sincronizado";
  const stepsText = steps != null ? `${Math.round(steps).toLocaleString("pt-BR")} passos` : "passos como complemento";

  return (
    <div className="config-row" style={{ cursor: syncing ? "wait" : "pointer", opacity: syncing ? 0.7 : 1 }} onClick={handleSync}>
      <div className="config-row-label">
        <div className="icon-bg" style={{ background: snapshot ? "rgba(150,199,179,.14)" : "rgba(176,180,196,.12)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={snapshot ? "var(--accent-sage)" : "var(--accent-sky)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </div>
        <div>
          <p className="config-row-text">Health Connect</p>
          <p className="config-row-sub">
            {loading ? "Verificando..." : snapshot ? `${sleepText} · ${stepsText}` : nativeAvailable ? "Conectar sono como base da bio-sincronia" : "Disponível no app Android"}
          </p>
          {syncedAt && (
            <p className="config-row-sub" style={{ marginTop: 2 }}>
              Atualizado {new Date(syncedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-peach)", flexShrink: 0 }}>
        {syncing ? "Sincronizando" : snapshot ? "Atualizar" : "Conectar"}
      </span>
    </div>
  );
}

type DeletionStatusResponse =
  | { status: "none" }
  | { status: "requested"; token: string; requestedAt: string; confirmDeadline: string }
  | { status: "confirmed"; confirmedAt: string; scheduledFor: string }
  | { status: "cancelled"; cancelledAt: string };

function PrivacyDeleteSection({ onStatusChange }: { onStatusChange: (msg: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<DeletionStatusResponse>({ status: "none" });

  const refresh = useCallback(async () => {
    try {
      const data = (await api.get("/privacy/deletion-status")) as DeletionStatusResponse;
      setState(data);
    } catch {
      // tolerate transient errors; user can retry
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRequest() {
    if (!confirm("Iniciar pedido de exclusão? Você terá 24h para confirmar.")) return;
    setBusy(true);
    onStatusChange(null);
    try {
      const data = (await api.post("/privacy/delete-request", {})) as DeletionStatusResponse;
      setState(data);
      onStatusChange("Pedido iniciado. Confirme em até 24h para agendar a exclusão.");
    } catch {
      onStatusChange("Não consegui iniciar o pedido agora.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (state.status !== "requested") return;
    if (!confirm("Confirmar exclusão? Seus dados serão removidos em 30 dias e isto pode ser cancelado durante esse período.")) return;
    setBusy(true);
    onStatusChange(null);
    try {
      const data = (await api.post("/privacy/delete-confirm", { token: state.token })) as DeletionStatusResponse;
      setState(data);
      onStatusChange("Exclusão agendada. Você pode cancelar até a data agendada.");
    } catch {
      onStatusChange("Não consegui confirmar o pedido. Tente reabrir o pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    onStatusChange(null);
    try {
      const data = (await api.post("/privacy/delete-cancel", {})) as DeletionStatusResponse;
      setState(data);
      onStatusChange("Pedido de exclusão cancelado.");
    } catch {
      onStatusChange("Não consegui cancelar agora.");
    } finally {
      setBusy(false);
    }
  }

  const subText =
    state.status === "requested"
      ? `Aguardando confirmação até ${new Date(state.confirmDeadline).toLocaleString("pt-BR")}`
      : state.status === "confirmed"
      ? `Agendada para ${new Date(state.scheduledFor).toLocaleDateString("pt-BR")} — você pode cancelar até lá`
      : "Remove permanentemente perfil, check-ins, diário, planner, hábitos e memórias após 30 dias";

  const primaryLabel =
    state.status === "requested"
      ? "Confirmar exclusão"
      : state.status === "confirmed"
      ? "Cancelar exclusão"
      : "Solicitar exclusão dos meus dados";

  const primaryAction =
    state.status === "requested"
      ? handleConfirm
      : state.status === "confirmed"
      ? handleCancel
      : handleRequest;

  const dangerColor = state.status === "confirmed" ? "var(--accent-sky)" : "var(--accent-warm-coral, #d77b6c)";

  return (
    <div
      className="config-row"
      style={{ cursor: busy ? "wait" : "pointer", opacity: busy ? 0.72 : 1 }}
      onClick={() => {
        if (!busy) void primaryAction();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !busy) {
          event.preventDefault();
          void primaryAction();
        }
      }}
    >
      <div className="config-row-label">
        <div className="icon-bg" style={{ background: "rgba(215,123,108,.12)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dangerColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </div>
        <div>
          <p className="config-row-text">{busy ? "Processando..." : primaryLabel}</p>
          <p className="config-row-sub">{subText}</p>
        </div>
      </div>
      {state.status === "requested" ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!busy) void handleCancel();
          }}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
            background: "transparent",
            border: "none",
            padding: "6px 10px",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function PrivacyDataSection({ onStatusChange }: { onStatusChange: (msg: string | null) => void }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    onStatusChange(null);

    try {
      const data = await api.get("/privacy/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `airia-dados-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onStatusChange("Arquivo de dados gerado.");
    } catch {
      onStatusChange("Não consegui exportar seus dados agora.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="config-row"
      style={{ cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.72 : 1 }}
      onClick={() => {
        if (!exporting) void handleExport();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !exporting) {
          event.preventDefault();
          void handleExport();
        }
      }}
    >
      <div className="config-row-label">
        <div className="icon-bg" style={{ background: "rgba(176,180,196,.12)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="m9 15 3 3 3-3" />
          </svg>
        </div>
        <div>
          <p className="config-row-text">{exporting ? "Gerando exportação..." : "Exportar meus dados"}</p>
          <p className="config-row-sub">Baixa um JSON com perfil, check-ins, diário, planner, hábitos, memórias e consentimentos</p>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-sky)", flexShrink: 0 }}>
        JSON
      </span>
    </div>
  );
}

type ToggleProps = { on: boolean; onToggle: () => void | Promise<void> };

function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div className={`toggle ${on ? "on" : "off"}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-knob" />
    </div>
  );
}

export function PreferencesPage() {
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [prefUserId, setPrefUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPrefUserId(session?.user?.id ?? null);
    });
  }, []);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const [aboutAppOpen, setAboutAppOpen] = useState(false);
  const [phaseLegendOpen, setPhaseLegendOpen] = useState(false);
  const gcalConnectedTrackedRef = useRef(false);
  const cycleReport = useMemo(
    () => computeMoodCycle(state.checkinHistory || []),
    [state.checkinHistory],
  );

  useEffect(() => {
    const gcalStatus = searchParams.get("gcal");
    if (!gcalStatus) return;

    if (gcalStatus === "connected") {
      setAccountStatus("Google Agenda conectado.");
      if (!gcalConnectedTrackedRef.current) {
        gcalConnectedTrackedRef.current = true;
        trackEvent("gcal_connected", {
          source: "oauth_return",
        });
      }
    } else if (gcalStatus === "error") {
      setAccountStatus("Não consegui conectar o Google Agenda.");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("gcal");
    nextParams.delete("reason");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
  const isDarkTheme = state.theme === "dark" || state.theme === "Tema escuro";
  const aboutAppSections = [
    ["ai", "✦", t("config.aboutApp.aiTitle"), t("config.aboutApp.aiDescription")],
    ["purpose", "🧭", t("config.aboutApp.purposeTitle"), t("config.aboutApp.purposeDescription")],
    ["phase", "🌙", t("config.aboutApp.phaseTitle"), t("config.aboutApp.phaseDescription")],
    ["chart", "📈", t("config.aboutApp.chartTitle"), t("config.aboutApp.chartDescription")],
    ["forecast", "🔮", t("config.aboutApp.forecastTitle"), t("config.aboutApp.forecastDescription")],
    ["autonomy", "🧭", t("config.aboutApp.autonomyTitle"), t("config.aboutApp.autonomyDescription")],
    ["alerts", "⚠️", t("config.aboutApp.alertsTitle"), t("config.aboutApp.alertsDescription")],
    ["patterns", "📊", t("config.aboutApp.patternsTitle"), t("config.aboutApp.patternsDescription")],
    ["patternsCards", "🕸️", t("config.aboutApp.patternCardsTitle"), t("config.aboutApp.patternCardsDescription")],
    ["harmony", "⚖️", t("config.aboutApp.harmonyTitle"), t("config.aboutApp.harmonyDescription")],
    ["weekly", "↔️", t("config.aboutApp.weeklyCompareTitle"), t("config.aboutApp.weeklyCompareDescription")],
    ["checkin", "😊", t("config.aboutApp.checkinTitle"), t("config.aboutApp.checkinDescription")],
    ["context", "🎯", t("config.aboutApp.contextTitle"), t("config.aboutApp.contextDescription")],
  ] as const;

  return (
    <div className="aura-page-shell">
      <div className="screen-content">
        {/* Header */}
        <div className="aura-page-header">
          <p className="aura-page-kicker">{t("config.kicker")}</p>
          <h2 className="aura-page-title">{t("config.title")}</h2>
          <p className="aura-page-subtitle">{t("config.subtitle")}</p>
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
              {displayName || t("config.user")}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "2px 0 0" }}>{state.email}</p>
          </div>
          <AuraButtonV2 className="aura-btn-pill" onClick={handleSaveProfile}>
            {t("common.save")}
          </AuraButtonV2>
        </div>

        {/* ── Idioma / Language ── */}
        <div
          className="aura-card"
          style={{
            marginBottom: "calc(var(--a) * 1.2)",
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  margin: "0 0 2px",
                }}
              >
                {t("config.language.label")}
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--text-3)",
                  margin: 0,
                  lineHeight: 1.35,
                }}
              >
                {t("config.language.description")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {(["pt", "en"] as const).map((lng) => {
              const isActive = currentLang === lng;
              return (
                <button
                  key={lng}
                  type="button"
                  onClick={async () => {
                    await setLanguage(lng);
                    setCurrentLang(lng);
                  }}
                  style={{
                    minWidth: 46,
                    padding: "7px 10px",
                    borderRadius: 12,
                    border: isActive
                      ? "1.5px solid rgba(215,137,127,0.55)"
                      : "1px solid rgba(74,59,55,0.1)",
                    background: isActive ? "rgba(215,137,127,0.10)" : "#FFFFFF",
                    color: isActive ? "#A8544A" : "var(--text-2)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans, sans-serif)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  aria-pressed={isActive}
                >
                  <span aria-hidden style={{ fontSize: 11, letterSpacing: ".04em" }}>{lng === "pt" ? "BR" : "US"}</span>
                </button>
              );
            })}
            </div>
          </div>
        </div>

        {/* ── Saiba sobre o app ── */}
        <div
          className="aura-card"
          style={{
            marginBottom: "calc(var(--a) * 1.2)",
            padding: aboutAppOpen ? "16px 18px" : "14px 16px",
          }}
        >
          <button
            type="button"
            onClick={() => setAboutAppOpen((open) => !open)}
            aria-expanded={aboutAppOpen}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "var(--font-sans, sans-serif)",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  margin: "0 0 4px",
                }}
              >
                {t("config.aboutApp.label")}
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-2)",
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                {t("config.aboutApp.description")}
              </p>
            </div>
            <span
              aria-hidden
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-peach)",
                background: "rgba(215,137,127,.10)",
                transform: aboutAppOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform .18s ease",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              ›
            </span>
          </button>

          {aboutAppOpen && (
            <>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {aboutAppSections.map(([key, icon, title, description]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 11px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,.72)",
                      border: "1px solid rgba(74,59,55,.08)",
                    }}
                  >
                    <span style={{ fontSize: 16, width: 22, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "var(--text-1)" }}>
                        {title}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11.5, lineHeight: 1.45, color: "var(--text-3)" }}>
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPhaseLegendOpen(true)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  border: "1.5px solid rgba(215,137,127,0.35)",
                  background: "rgba(215,137,127,0.10)",
                  color: "#A8544A",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "10px 12px",
                  borderRadius: 14,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans, sans-serif)",
                }}
              >
                {t("config.aboutApp.openPhases")}
              </button>
            </>
          )}
        </div>

        {/* Perfil section */}
        <div className="config-section">
          <p className="config-section-title">{t("config.profile")}</p>
          <div className="aura-input-wrap" style={{ marginBottom: "8px" }}>
            <label className="aura-input-label">{t("config.name")}</label>
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
          <div className="config-row" style={{ alignItems: "stretch" }}>
            <div className="config-row-label" style={{ alignItems: "center" }}>
              <div className="icon-bg" style={{ background: isDarkTheme ? "rgba(190,230,243,.14)" : "rgba(180,185,169,.12)" }}>
                {isDarkTheme ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sky-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.8A8.2 8.2 0 1 1 11.2 3 6.4 6.4 0 0 0 21 12.8Z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                )}
              </div>
              <div>
                <p className="config-row-text">Tema do app</p>
                <p className="config-row-sub">{isDarkTheme ? "Escuro ativo" : "Claro ativo"}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {[
                { id: "light", label: "Claro" },
                { id: "dark", label: "Escuro" },
              ].map((option) => {
                const active = option.id === (isDarkTheme ? "dark" : "light");
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (!active) toggleTheme();
                    }}
                    aria-pressed={active}
                    style={{
                      border: active ? "1.5px solid rgba(215,137,127,.55)" : "1px solid var(--warm-border)",
                      background: active ? "rgba(244,190,168,.16)" : "rgba(255,255,255,.58)",
                      color: active ? "var(--accent-peach-ink)" : "var(--text-3)",
                      borderRadius: 999,
                      padding: "7px 10px",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: active ? "default" : "pointer",
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Biblioteca section */}
        <div className="config-section">
          <p className="config-section-title">Conteúdo</p>
          <div
            className="config-row"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/conteudo")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/conteudo"); }}
          >
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(150,199,179,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--menthe, #96C7B3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <div>
                <p className="config-row-text">Biblioteca de conteúdo</p>
                <p className="config-row-sub">TDAH, bipolar II, ciclotimia e produtividade</p>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Plano section */}
        <div className="config-section">
          <p className="config-section-title">Plano</p>
          <div
            className="config-row"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/billing")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/billing"); }}
          >
            <div className="config-row-label">
              <div className="icon-bg" style={{ background: "rgba(215,137,127,.12)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach, #D7897F)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" />
                </svg>
              </div>
              <div>
                <p className="config-row-text">Airia Pro</p>
                <p className="config-row-sub">Assinatura, IA ilimitada e recursos avançados</p>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Conta e Integrações section */}
        <div className="config-section">
          <p className="config-section-title">Conta e Integrações</p>
          
          <PrivacyDataSection onStatusChange={setAccountStatus} />
          <div style={{ height: 1, background: "var(--warm-border)", opacity: 0.65, margin: "2px 0" }} />
          <PrivacyDeleteSection onStatusChange={setAccountStatus} />
          <div style={{ height: 1, background: "var(--warm-border)", opacity: 0.65, margin: "2px 0" }} />
          <GCalSettingsSection onStatusChange={setAccountStatus} />
          <div style={{ height: 1, background: "var(--warm-border)", opacity: 0.65, margin: "2px 0" }} />
          <HealthConnectSettingsSection onStatusChange={setAccountStatus} />
          
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
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Referral */}
        {prefUserId && (state.checkinHistory || []).length >= 7 && (
          <ReferralCard userId={prefUserId} />
        )}

        {/* Link onboarding */}
        <AuraButtonV2
          onClick={handleRedoOnboarding}
          className="btn btn-ghost btn-full"
          style={{ marginTop: 20, color: "var(--accent-peach)" }}
        >
          🔄 Refazer onboarding
        </AuraButtonV2>
      </div>
      <PhaseLegendSheet
        open={phaseLegendOpen}
        onClose={() => setPhaseLegendOpen(false)}
        currentPhase={cycleReport.phase === "insufficient_data" ? undefined : cycleReport.phase}
      />
    </div>
  );
}
