import { Suspense, lazy, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";

const loadAuraLayout = () => import("./routes/aura-layout");
const loadLoginPage = () => import("./routes/login-page");
const loadHomePage = () => import("./routes/home-page");
const loadJournalPage = () => import("./routes/journal-page");
const loadGoalsPage = () => import("./routes/goals-page");
const loadPreferencesPage = () => import("./routes/preferences-page");
const loadOnboardingPage = () => import("./routes/onboarding-page");
const loadAuraV2Showcase = () => import("./routes/aura-v2-showcase");
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

const AuraLayout = lazy(() => loadAuraLayout().then((module) => ({ default: module.AuraLayout })));
const LoginPage = lazy(() => loadLoginPage().then((module) => ({ default: module.LoginPage })));
const HomePage = lazy(() => loadHomePage().then((module) => ({ default: module.HomePage })));
const JournalPage = lazy(() => loadJournalPage().then((module) => ({ default: module.JournalPage })));
const GoalsPage = lazy(() => loadGoalsPage().then((module) => ({ default: module.GoalsPage })));
const PreferencesPage = lazy(() => loadPreferencesPage().then((module) => ({ default: module.PreferencesPage })));
const OnboardingPage = lazy(() => loadOnboardingPage().then((module) => ({ default: module.OnboardingPage })));
const AuraV2Showcase = lazy(() => loadAuraV2Showcase().then((module) => ({ default: module.AuraV2Showcase })));
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

  useEffect(() => {
    preloadNextRoutes(location.pathname);
  }, [location.pathname]);

  return (
    <Suspense fallback={<RouteLoader />}>
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
        <Route path="/aura-v2" element={<AuraV2Showcase />} />
        <Route path="/auth-v2" element={<AuthV2Page />} />

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
        </Route>
      </Routes>
    </Suspense>
  );
}
