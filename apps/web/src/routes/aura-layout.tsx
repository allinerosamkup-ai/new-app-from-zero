import { X } from "lucide-react";
// Aura Layout v2 — bottom nav + Phase Transition Alert + Follow-up Card
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuraStore } from "../features/aura/store";
import { supabase } from "../lib/supabase";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AutonomousAIEngine } from "../components/AutonomousAIEngine";
import { AuraIcon } from "../components/AuraIcon";
import { useHabitReminders } from "../hooks/useHabitReminders";
import "../styles/aura.css";
import "../styles/editorial.css";

const NAV_ITEMS = [
  {
    label: "Início",
    route: "/home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: "Planner",
    route: "/planner",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Airia",
    route: "/aura",
    icon: <AuraIcon size={64} />,
  },
  {
    label: "Diário",
    route: "/journal",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="8" y1="15" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    label: "Config",
    route: "/preferences",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10.91 3H11a2 2 0 1 1 4 0h.09a1.65 1.65 0 0 0 1.51 1h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21 10.91V11a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

const SEVERITY_CONFIG = {
  info:     { color: "var(--accent-sage)",    bg: "rgba(150,199,179,.12)", border: "rgba(150,199,179,.3)", emoji: "✨" },
  warning:  { color: "var(--accent-peach)", bg: "rgba(215,137,127,.10)", border: "rgba(215,137,127,.3)", emoji: "📉" },
  critical: { color: "#A17D6C",          bg: "rgba(161,125,108,.10)", border: "rgba(161,125,108,.3)", emoji: "🌙" },
};

const PHASE_ALERT_CONFIG: Record<string, { color: string; bg: string; border: string; emoji: string }> = {
  elevated: { color: "var(--accent-sky)", bg: "rgba(176,180,196,.14)", border: "rgba(176,180,196,.34)", emoji: "🚀" },
  flowing: { color: "var(--accent-sage)", bg: "rgba(180,185,169,.14)", border: "rgba(180,185,169,.34)", emoji: "✨" },
  stable: { color: "var(--accent-sage)", bg: "rgba(180,185,169,.14)", border: "rgba(180,185,169,.34)", emoji: "💚" },
  falling: { color: "var(--accent-peach)", bg: "rgba(215,137,127,.12)", border: "rgba(215,137,127,.34)", emoji: "📉" },
  low: { color: "var(--accent-peach-strong)", bg: "rgba(215,137,127,.14)", border: "rgba(215,137,127,.36)", emoji: "🌙" },
  depleted: { color: "var(--accent-peach-ink)", bg: "rgba(161,125,108,.12)", border: "rgba(161,125,108,.34)", emoji: "😴" },
  recovering: { color: "var(--accent-sage)", bg: "rgba(180,185,169,.14)", border: "rgba(180,185,169,.34)", emoji: "🌱" },
  mixed: { color: "var(--accent-peach)", bg: "rgba(215,137,127,.12)", border: "rgba(215,137,127,.34)", emoji: "⚡" },
};

const ONBOARDING_PROMPT_WINDOW_DAYS = 7;
const ONBOARDING_PROMPT_MAX_SHOWS = 2;

function getOnboardingPromptKey(userId: string | null) {
  return userId ? `aura.onboardingPrompt.${userId}` : null;
}

function isWithinOnboardingPromptWindow(accountCreatedAt?: string | null) {
  if (!accountCreatedAt) return false;
  const createdAtMs = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  return Date.now() - createdAtMs <= ONBOARDING_PROMPT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function AuraLayout() {
  const { hydrated, refreshData, state, dismissPhaseTransitionAlert, resolveFollowUp } = useAuraStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);

  useHabitReminders(state.habits ?? [], state.tasks ?? [], state.notificationPreferences, {
    morning: state.morningCheckinTime,
    evening: state.eveningCheckinTime,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setSessionUserId(session?.user?.id ?? null);
      setAuthChecked(true);
      if (session) refreshData();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setHasSession(true);
        setSessionUserId(session.user.id);
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setHasSession(false);
        setSessionUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshData, navigate]);

  const onboardingPromptEligible = useMemo(
    () => !state.onboardingDone && isWithinOnboardingPromptWindow(state.accountCreatedAt),
    [state.accountCreatedAt, state.onboardingDone],
  );

  useEffect(() => {
    if (!hydrated || !hasSession || !onboardingPromptEligible || location.pathname.startsWith('/onboarding')) {
      setShowOnboardingPrompt(false);
      return;
    }

    const key = getOnboardingPromptKey(sessionUserId);
    if (!key) return;
    const sessionKey = `${key}.shownThisSession`;
    if (sessionStorage.getItem(sessionKey) === "true") {
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}") as { count?: number; dismissed?: boolean };
      if (stored.dismissed || (stored.count ?? 0) >= ONBOARDING_PROMPT_MAX_SHOWS) {
        setShowOnboardingPrompt(false);
        return;
      }

      localStorage.setItem(key, JSON.stringify({ ...stored, count: (stored.count ?? 0) + 1, lastShownAt: new Date().toISOString() }));
      sessionStorage.setItem(sessionKey, "true");
      setShowOnboardingPrompt(true);
    } catch {
      sessionStorage.setItem(sessionKey, "true");
      setShowOnboardingPrompt(true);
    }
  }, [hasSession, hydrated, location.pathname, onboardingPromptEligible, sessionUserId]);

  function dismissOnboardingPrompt(permanent = false) {
    const key = getOnboardingPromptKey(sessionUserId);
    if (key && permanent) {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || "{}");
        localStorage.setItem(key, JSON.stringify({ ...stored, dismissed: true }));
      } catch {
        localStorage.setItem(key, JSON.stringify({ dismissed: true, count: ONBOARDING_PROMPT_MAX_SHOWS }));
      }
    }
    setShowOnboardingPrompt(false);
  }

  if (!authChecked) {
    return (
      <div className="aura-loader-container">
        <div className="aura-loader-spinner" />
      </div>
    );
  }

  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }

  if (!hydrated) {
    return (
      <div className="aura-loader-container">
        <div className="aura-loader-spinner" />
      </div>
    );
  }

  return (
    <div className="aura-layout-root min-h-screen overflow-x-hidden" style={{ color: 'var(--on-surface)' }}>
      {/* Daemon IA proativa — invisível, roda após hydration */}
      <AutonomousAIEngine />

      {showOnboardingPrompt && (
        <div style={{
          position: "fixed",
          top: "calc(10px + env(safe-area-inset-top))",
          left: 0,
          right: 0,
          zIndex: 520,
          width: "min(calc(100% - 24px), 424px)",
          marginLeft: "auto",
          marginRight: "auto",
          background: "rgba(255,255,255,.96)",
          border: "1px solid rgba(215,137,127,.25)",
          borderRadius: 18,
          boxShadow: "0 18px 32px rgba(17,24,39,.10)",
          backdropFilter: "blur(16px)",
          padding: "12px 14px",
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AuraIcon size={22} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-1)", margin: "0 0 3px" }}>
                Quer calibrar sua Airia?
              </p>
              <p style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.45, margin: 0 }}>
                O onboarding ajuda a ajustar humor, energia e sugestões. Dá para usar o app sem fazer isso agora.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => {
                    dismissOnboardingPrompt(true);
                    navigate("/onboarding");
                  }}
                  style={{ flex: 1, height: 32, border: "none", borderRadius: 10, background: "var(--accent-peach)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Fazer agora
                </button>
                <button
                  onClick={() => dismissOnboardingPrompt(false)}
                  style={{ flex: 1, height: 32, border: "1px solid var(--warm-border-2)", borderRadius: 10, background: "transparent", color: "var(--text-2)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  Depois
                </button>
                <button
                  onClick={() => dismissOnboardingPrompt(true)}
                  style={{ height: 32, border: "none", background: "transparent", color: "var(--text-3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  Não mostrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── #2: Phase Transition Alert — banner fixo topo ── */}
      {state.phaseTransitionAlert && !state.phaseTransitionAlert.dismissed && (() => {
        const alert = state.phaseTransitionAlert!;
        const cfg = PHASE_ALERT_CONFIG[alert.toPhase] ?? SEVERITY_CONFIG[alert.severity];
        return (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
            background: "rgba(255,255,255,.94)", borderBottom: `1px solid ${cfg.border}`,
            backdropFilter: "blur(16px)",
            padding: "10px 16px 12px",
            width: "min(100%, 480px)", marginLeft: "auto", marginRight: "auto",
            boxShadow: "0 10px 24px rgba(17,24,39,.05)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{cfg.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Mudança de fase
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                    {alert.fromLabel} → {alert.toLabel}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-1)", margin: "0 0 4px", lineHeight: 1.5, fontStyle: "italic" }}>
                  "{alert.message}"
                </p>
                {alert.tip && (
                  <p style={{ fontSize: 11, color: cfg.color, margin: 0, lineHeight: 1.4, fontWeight: 600 }}>
                    💡 {alert.tip}
                  </p>
                )}
              </div>
              <button
                onClick={dismissPhaseTransitionAlert}
                style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `1px solid ${cfg.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={12} color={cfg.color} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── #7: Follow-up Card — banner fixo acima do bottom nav ── */}
      {state.pendingFollowUp?.followUpMessage && state.pendingFollowUp.response === null && (() => {
        const followUp = state.pendingFollowUp!;
        return (
          <div style={{
            position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))", left: 0, right: 0, zIndex: 450,
            width: "min(calc(100% - 24px), 424px)", marginLeft: "auto", marginRight: "auto",
            background: "rgba(255,255,255,.96)", borderRadius: 22, border: "1px solid rgba(17,24,39,.06)",
            boxShadow: "0 18px 30px rgba(17,24,39,.08)", backdropFilter: "blur(16px)",
            padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent-peach)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 3px" }}>
                  Airia pergunta
                </p>
                <p style={{ fontSize: 12, color: "var(--text-1)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>
                  "{followUp.followUpMessage}"
                </p>
                <p style={{ fontSize: 10, color: "var(--text-3)", margin: "3px 0 0" }}>
                  Sobre: {followUp.suggestionTitle}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => resolveFollowUp("done")}
                style={{ flex: 1, height: 34, borderRadius: 9, border: "none", background: "var(--accent-peach)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Sim, fiz! 🎉
              </button>
              <button
                onClick={() => resolveFollowUp("skip")}
                style={{ flex: 1, height: 34, borderRadius: 9, border: "1.5px solid var(--warm-border-2)", background: "transparent", color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Não dessa vez
              </button>
            </div>
          </div>
        );
      })()}

      {/* Conteúdo das rotas filhas */}
      <div className="aura-layout-content" style={{
        paddingTop: state.phaseTransitionAlert && !state.phaseTransitionAlert.dismissed
          ? "calc(80px + env(safe-area-inset-top))"
          : "calc(18px + env(safe-area-inset-top))",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
      }}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>

        {/* Link de conformidade Google/Privacy */}
        <div style={{ padding: "40px 0 20px", textAlign: "center", opacity: 0.4 }}>
            <a href="https://airia.pro/privacy" target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--text-3)", textDecoration: "none", fontWeight: 600, letterSpacing: "0.05em" }}>
                POLÍTICA DE PRIVACIDADE
            </a>
        </div>
      </div>

      {/* Bottom Nav — Floating Pill — sempre fixo */}
      <div className="bottom-nav" style={{
        position: "fixed",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        left: 0,
        right: 0,
        marginLeft: "auto",
        marginRight: "auto",
        width: "calc(min(100%, 480px) - 32px)",
        maxWidth: 448,
        borderRadius: 28,
        zIndex: 50,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "10px 16px 12px",
      }}>
        {NAV_ITEMS.map((item, idx) => {
          const isActive = location.pathname === item.route;
          if (idx === 2) { // Centro (Aura)
            return (
              <div key={item.route} className="nav-item-center cursor-pointer hover:scale-110 transition-transform duration-300"
                   onClick={() => navigate(item.route)}>
                {item.icon}
              </div>
            );
          }
          return (
            <div key={item.route}
                 className={`flex flex-col items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 hover:scale-110 p-2 nav-item${isActive ? ' active' : ''}`}
                 onClick={() => navigate(item.route)}>
              <span className="mb-0.5">{item.icon}</span>
              <span className="text-[9px] font-bold tracking-wider uppercase">{item.label === 'Início' ? 'Home' : item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
