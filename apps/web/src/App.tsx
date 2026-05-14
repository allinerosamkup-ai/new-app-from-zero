import { Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { InstallPWA } from "./components/InstallPWA";
import { trackInstallConversionOnce, trackMetaPixelPageView } from "./lib/meta-pixel";

const loadAuraLayout = () => import("./routes/aura-layout");
const loadLoginPage = () => import("./routes/login-page");
const loadHomePage = () => import("./routes/home-page");
const loadJournalPage = () => import("./routes/journal-page");
const loadGoalsPage = () => import("./routes/goals-page");
const loadPreferencesPage = () => import("./routes/preferences-page");
const loadOnboardingPage = () => import("./routes/onboarding-page");
const loadEditorialShowcase = () => import("./routes/editorial-showcase");
const loadAuthV2Page = () => import("./routes/auth-v2-page");
const loadCheckinPage = () => import("./routes/checkin-page");
const loadPlannerPage = () => import("./routes/planner-page");
const loadInsightsPage = () => import("./routes/insights-page");
const loadPomodoroPage = () => import("./routes/pomodoro-page");
const loadDailySummaryPage = () => import("./routes/daily-summary-page");
const loadHarmonyPage = () => import("./routes/harmony-page");
const loadUIKitPage = () => import("./routes/ui-kit-page");
const loadCheckinResultPage = () => import("./routes/checkin-result-page");
const loadHabitsPage = () => import("./routes/habits-page");
const loadAuraChatPage = () => import("./routes/aura-chat-page");
const loadSplashPage = () => import("./routes/splash-page");
const loadForgotPasswordPage = () => import("./routes/forgot-password-page");
const loadResetPasswordPage = () => import("./routes/reset-password-page");
const loadOnboardingEnergyPage = () => import("./routes/onboarding-energy-page");
const loadOnboardingCyclePage = () => import("./routes/onboarding-cycle-page");
const loadOnboardingSleepPage = () => import("./routes/onboarding-sleep-page");
const loadOnboardingPreferencesPage = () => import("./routes/onboarding-preferences-page");
const loadOnboardingDonePage = () => import("./routes/onboarding-done-page");
const loadPrivacyPage = () => import("./routes/privacy-page");
const loadTermsPage = () => import("./routes/terms-page");
const loadConteudoPage = () => import("./routes/conteudo-page");
const loadContextoPage = () => import("./routes/contexto-page");

const AuraLayout = lazy(() => loadAuraLayout().then((module) => ({ default: module.AuraLayout })));
const LoginPage = lazy(() => loadLoginPage().then((module) => ({ default: module.LoginPage })));
const HomePage = lazy(() => loadHomePage().then((module) => ({ default: module.HomePage })));
const JournalPage = lazy(() => loadJournalPage().then((module) => ({ default: module.JournalPage })));
const GoalsPage = lazy(() => loadGoalsPage().then((module) => ({ default: module.GoalsPage })));
const PreferencesPage = lazy(() => loadPreferencesPage().then((module) => ({ default: module.PreferencesPage })));
const OnboardingPage = lazy(() => loadOnboardingPage().then((module) => ({ default: module.OnboardingPage })));
const EditorialShowcase = lazy(() => loadEditorialShowcase().then((module) => ({ default: module.EditorialShowcase })));
const AuthV2Page = lazy(() => loadAuthV2Page().then((module) => ({ default: module.AuthV2Page })));
const CheckinPage = lazy(() => loadCheckinPage().then((module) => ({ default: module.CheckinPage })));
const PlannerPage = lazy(() => loadPlannerPage().then((module) => ({ default: module.PlannerPage })));
const InsightsPage = lazy(() => loadInsightsPage().then((module) => ({ default: module.InsightsPage })));
const PomodoroPage = lazy(() => loadPomodoroPage().then((module) => ({ default: module.PomodoroPage })));
const DailySummaryPage = lazy(() => loadDailySummaryPage().then((module) => ({ default: module.DailySummaryPage })));
const HarmonyPage = lazy(() => loadHarmonyPage().then((module) => ({ default: module.HarmonyPage })));
const UIKitPage = lazy(() => loadUIKitPage().then((module) => ({ default: module.UIKitPage })));
const CheckinResultPage = lazy(() => loadCheckinResultPage().then((module) => ({ default: module.CheckinResultPage })));
const HabitsPage = lazy(() => loadHabitsPage().then((module) => ({ default: module.HabitsPage })));
const AuraChatPage = lazy(() => loadAuraChatPage().then((module) => ({ default: module.AuraChatPage })));
const SplashPage = lazy(() => loadSplashPage().then((module) => ({ default: module.SplashPage })));
const ForgotPasswordPage = lazy(() => loadForgotPasswordPage().then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => loadResetPasswordPage().then((module) => ({ default: module.ResetPasswordPage })));
const OnboardingEnergyPage = lazy(() => loadOnboardingEnergyPage().then((module) => ({ default: module.OnboardingEnergyPage })));
const OnboardingCyclePage = lazy(() => loadOnboardingCyclePage().then((module) => ({ default: module.OnboardingCyclePage })));
const OnboardingSleepPage = lazy(() => loadOnboardingSleepPage().then((module) => ({ default: module.OnboardingSleepPage })));
const OnboardingPreferencesPage = lazy(() => loadOnboardingPreferencesPage().then((module) => ({ default: module.OnboardingPreferencesPage })));
const OnboardingDonePage = lazy(() => loadOnboardingDonePage().then((module) => ({ default: module.OnboardingDonePage })));
const PrivacyPage = lazy(() => loadPrivacyPage().then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => loadTermsPage().then((module) => ({ default: module.TermsPage })));
const ConteudoPage = lazy(() => loadConteudoPage().then((module) => ({ default: module.ConteudoPage })));
const ContextoPage = lazy(() => loadContextoPage().then((module) => ({ default: module.ContextoPage })));

const preloadByPath: Record<string, Array<() => Promise<unknown>>> = {
  "/": [loadSplashPage, loadLoginPage],
  "/splash": [loadLoginPage],
  "/login": [loadAuraLayout, loadHomePage, loadCheckinPage, loadPlannerPage],
  "/forgot-password": [loadResetPasswordPage, loadLoginPage],
  "/home": [loadCheckinPage, loadPlannerPage, loadJournalPage],
  "/checkin": [loadCheckinResultPage, loadHomePage],
  "/checkin-result": [loadHomePage, loadPlannerPage, loadJournalPage],
  "/planner": [loadHomePage, loadJournalPage, loadGoalsPage],
  "/journal": [loadHomePage, loadPlannerPage, loadAuraChatPage],
  "/goals": [loadPlannerPage, loadHomePage],
  "/insights": [loadHomePage, loadDailySummaryPage],
};

function preloadNextRoutes(pathname: string) {
  if (typeof window === "undefined") {
    return;
  }

  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;

  if (connection?.saveData) {
    return;
  }

  for (const loader of preloadByPath[pathname] ?? []) {
    void loader();
  }
}

const DEV_SCREENS = [
  { path: "home", label: "Home" },
  { path: "checkin", label: "Checkin" },
  { path: "checkin-result", label: "Result" },
  { path: "planner", label: "Planner" },
  { path: "journal", label: "Diário" },
  { path: "goals", label: "Metas" },
  { path: "insights", label: "Insights" },
  { path: "daily-summary", label: "Resumo" },
  { path: "preferences", label: "Config" },
  { path: "aura", label: "Aura IA" },
  { path: "ui-kit", label: "UI Kit" },
];

function DevLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.replace("/dev/", "");
  return (
    <div style={{ minHeight: "100vh", background: "var(--warm-bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#1a1a1a", padding: "6px 10px", display: "flex", gap: "6px", flexWrap: "wrap", position: "sticky", top: 0, zIndex: 999 }}>
        {DEV_SCREENS.map(s => (
          <button key={s.path} onClick={() => navigate(`/dev/${s.path}`)}
            style={{ padding: "3px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 600,
              background: current === s.path ? "#C5A593" : "#333", color: current === s.path ? "#fff" : "#aaa" }}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, paddingBottom: 80 }}><Outlet /></div>
    </div>
  );
}

function RouteLoader() {
  return (
    <div className="aura-loader-container">
      <div className="aura-loader-spinner" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const firstPixelPageView = useRef(true);

  useEffect(() => {
    preloadNextRoutes(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (firstPixelPageView.current) {
      firstPixelPageView.current = false;
      return;
    }
    trackMetaPixelPageView();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const doc = document.documentElement;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.__AIRIA_NATIVE_SHELL__ === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isStandalone) {
      doc.classList.add("airia-installed-shell");
      trackInstallConversionOnce("standalone_open");
    }

    if (!isIOS || !isStandalone) {
      return () => {
        doc.classList.remove("airia-installed-shell");
      };
    }

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      startX = touch?.clientX ?? 0;
      startY = touch?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const isEdgeGesture = startX < 28 || startX > window.innerWidth - 28;
      const isHorizontal = Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

      if (isEdgeGesture && isHorizontal) {
        event.preventDefault();
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      doc.classList.remove("airia-installed-shell");
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <Suspense fallback={<RouteLoader />}>
      <div className="app-viewport">
      <div key={location.pathname} className="page-transition">
      <Routes>
        <Route path="/" element={<Navigate to="/splash" replace />} />
        <Route path="/splash" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding/energy" element={<OnboardingEnergyPage />} />
        <Route path="/onboarding/cycle" element={<OnboardingCyclePage />} />
        <Route path="/onboarding/sleep" element={<OnboardingSleepPage />} />
        <Route path="/onboarding/preferences" element={<OnboardingPreferencesPage />} />
        <Route path="/onboarding/done" element={<OnboardingDonePage />} />
        <Route path="/editorial-showcase" element={<EditorialShowcase />} />
        <Route path="/auth-v2" element={<AuthV2Page />} />
        <Route path="/auth/callback" element={<Navigate to={`/planner${location.search}`} replace />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Rotas de preview sem auth — só desenvolvimento */}
        <Route path="/dev" element={<DevLayout />}>
          <Route path="home" element={<HomePage />} />
          <Route path="checkin" element={<CheckinPage />} />
          <Route path="checkin-result" element={<CheckinResultPage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="harmony" element={<HarmonyPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="daily-summary" element={<DailySummaryPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="pomodoro" element={<PomodoroPage />} />
          <Route path="aura" element={<AuraChatPage />} />
          <Route path="ui-kit" element={<UIKitPage />} />
        </Route>

        <Route element={<AuraLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/profile" element={<Navigate to="/insights" replace />} />
          <Route path="/preferences" element={<PreferencesPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/daily-summary" element={<DailySummaryPage />} />
          <Route path="/harmony" element={<HarmonyPage />} />
          <Route path="/checkin-result" element={<CheckinResultPage />} />
          <Route path="/aura" element={<AuraChatPage />} />
          <Route path="/conteudo" element={<ConteudoPage />} />
          <Route path="/contexto" element={<ContextoPage />} />
        </Route>
      </Routes>
      </div>
      <InstallPWA />
      </div>
    </Suspense>
  );
}
