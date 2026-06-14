import { X } from "lucide-react";
// Aura Layout v2 — bottom nav (valor + camadas) + Phase Transition Alert + Follow-up Card
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuraStore } from "../features/aura/store";
import { supabase } from "../lib/supabase";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AutonomousAIEngine } from "../components/AutonomousAIEngine";
import { AuraIcon } from "../components/AuraIcon";
import { useHabitReminders } from "../hooks/useHabitReminders";
import { getActivationState } from "../features/aura/activation";
import { resolveActiveBanner } from "./aura-layout.helpers";
import { resolveUnlockedNav, type NavKey } from "./nav-access.helpers";
import "../styles/aura.css";
import "../styles/editorial.css";

type NavItem = {
  key: NavKey;
  labelKey: string;
  route: string;
  icon: ReactNode;
  side?: "left" | "right";
  center?: boolean;
};

// Ordem por valor: Hoje · Planner · Airia (centro) · Padrões · Diário.
// Config saiu da barra e virou o gear no header da Home.
const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    side: "left",
    labelKey: "nav.home",
    route: "/home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    key: "planner",
    side: "left",
    labelKey: "nav.planner",
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
    key: "aura",
    center: true,
    labelKey: "nav.aura",
    route: "/aura",
    icon: <AuraIcon size={88} variant="hybrid" />,
  },
  {
    key: "insights",
    side: "right",
    labelKey: "nav.insights",
    route: "/insights",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 15 8 10 13 13 21 5" />
        <polyline points="15 5 21 5 21 11" />
      </svg>
    ),
  },
  {
    key: "journal",
    side: "right",
    labelKey: "nav.journal",
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
  const { t } = useTranslation();
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
      } else if (event === 'SIGNED_OUT') {
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

  // Camadas de onboarding: a barra revela Planner/Padrões conforme o uso.
  const activation = useMemo(() => getActivationState(state), [state]);
  const unlockedNav = useMemo(
    () => resolveUnlockedNav({ checkinCount: activation.checkinCount, isNewUser: activation.isNewUser }),
    [activation.checkinCount, activation.isNewUser],
  );
  const leftNavItems = NAV_ITEMS.filter((item) => item.side === "left" && unlockedNav.has(item.key));
  const rightNavItems = NAV_ITEMS.filter((item) => item.side === "right" && unlockedNav.has(item.key));
  const centerNavItem = NAV_ITEMS.find((item) => item.center)!;

  function renderNavItem(item: NavItem) {
    const isActive = location.pathname === item.route;
    return (
      <button
        key={item.route}
        type="button"
        className={`airia-nav-item flex flex-col items-center justify-center p-2 nav-item${isActive ? ' active' : ''}`}
        onClick={() => navigate(item.route)}
      >
        <span className="mb-0.5">{item.icon}</span>
        <span className="text-[10px] font-bold tracking-normal">{t(item.labelKey)}</span>
      </button>
    );
  }

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

  // Um banner por vez (prioridade: fase > onboarding > follow-up) para não empilhar avisos.
  const hasPhaseAlert = Boolean(state.phaseTransitionAlert && !state.phaseTransitionAlert.dismissed);
  const hasFollowUp = Boolean(state.pendingFollowUp?.followUpMessage && state.pendingFollowUp.response === null);
  const activeBanner = resolveActiveBanner({ hasPhaseAlert, showOnboarding: showOnboardingPrompt, hasFollowUp });

  return (
    <div className="aura-layout-root min-h-screen overflow-x-hidden" style={{ color: 'var(--on-surface)' }}>
      {/* Daemon IA proativa — invisível, roda após hydration */}
      <AutonomousAIEngine />

      {activeBanner === "onboarding" && (
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
      {activeBanner === "phase" && (() => {
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
                    {t("alerts.phaseTransition", "Mudança de fase")}
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
      {activeBanner === "followup" && (() => {
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
                  {t("alerts.auraAsks", "Airia pergunta")}
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
                {t("alerts.doneButton")}
              </button>
              <button
                onClick={() => resolveFollowUp("skip")}
                style={{ flex: 1, height: 34, borderRadius: 9, border: "1.5px solid var(--warm-border-2)", background: "transparent", color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {t("alerts.skipButton")}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Conteúdo das rotas filhas */}
      <div className="aura-layout-content" style={{
        paddingTop: activeBanner === "phase"
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
                {t("privacy")}
            </a>
        </div>
      </div>

      {/* Bottom Nav — Floating Pill — Airia sempre no centro, laterais por camada */}
      <div className="bottom-nav airia-bottom-nav" style={{
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
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px 12px",
      }}>
        <div style={{ display: "flex", flex: 1, justifyContent: "space-around", alignItems: "center" }}>
          {leftNavItems.map(renderNavItem)}
        </div>
        <button
          key={centerNavItem.route}
          type="button"
          className={`airia-nav-center${location.pathname === centerNavItem.route ? " active" : ""}`}
          aria-label={t(centerNavItem.labelKey)}
          onClick={() => navigate(centerNavItem.route)}
        >
          {centerNavItem.icon}
        </button>
        <div style={{ display: "flex", flex: 1, justifyContent: "space-around", alignItems: "center" }}>
          {rightNavItems.map(renderNavItem)}
        </div>
      </div>
    </div>
  );
}
