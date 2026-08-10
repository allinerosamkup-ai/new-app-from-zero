import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useEffect, useState, type KeyboardEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { supabase } from "../lib/supabase";
import { trackRegistrationConversion } from "../lib/meta-pixel";
import { trackEvent } from "../lib/track";
import { capturePendingReferral, claimPendingReferral } from "../features/referrals/capture";
import "../styles/aura.css";

type Tab = "entrar" | "criar";
const REMEMBER_ME_KEY = "aura.rememberMe";
const REMEMBERED_EMAIL_KEY = "aura.rememberedEmail";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, setName, setEmail } = useAuraStore();
  const [tab, setTab] = useState<Tab>("entrar");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(REMEMBER_ME_KEY);
    return saved ? saved === "true" : true;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);

  useEffect(() => {
    capturePendingReferral();
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active || !session) return;
      void claimPendingReferral().finally(() => {
        if (active) navigate("/home", { replace: true });
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session || event === "SIGNED_OUT") return;
      void claimPendingReferral().finally(() => {
        if (active) navigate("/home", { replace: true });
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rememberMe || state.email) return;
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) setEmail(rememberedEmail);
  }, [rememberMe, setEmail, state.email]);

  const handleEnterSubmit = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || loading) return;
    event.preventDefault();
    void handleLogin();
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      let authenticated = false;
      if (tab === "entrar") {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: state.email,
          password,
        });
        if (err) throw err;
        authenticated = Boolean(data.session);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: state.email,
          password,
          options: { data: { full_name: state.name } },
        });
        if (err) throw err;
        authenticated = Boolean(data.session);
      }
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_ME_KEY, "true");
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, state.email);
      } else {
        window.localStorage.setItem(REMEMBER_ME_KEY, "false");
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      if (tab === "criar") {
        trackRegistrationConversion("email");
        trackEvent("user_signed_up", { method: "email" });
        if (authenticated) await claimPendingReferral();
        setShowConfirmEmail(true);
        return;
      }
      if (authenticated) await claimPendingReferral();
      navigate("/home");
    } catch (err: any) {
      const msg = err?.message || t("auth.errors.generic");
      if (msg.includes("Invalid login credentials")) setError(t("auth.errors.credentials"));
      else if (msg.includes("already registered")) setError(t("auth.errors.registered"));
      else if (msg.includes("Password should be")) setError(t("auth.errors.shortPassword"));
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aura-page-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Status bar simulada */}
      <div className="phone-status">
        <span>9:41</span>
        <div className="status-icons">
          {/* Signal */}
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            <rect x="0" y="6" width="2" height="4" rx="1" fill="currentColor" />
            <rect x="3" y="4" width="2" height="6" rx="1" fill="currentColor" />
            <rect x="6" y="2" width="2" height="8" rx="1" fill="currentColor" />
            <rect x="9" y="0" width="2" height="10" rx="1" fill="currentColor" />
          </svg>
          {/* WiFi */}
          <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
            <path d="M7 9.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" fill="currentColor" />
            <path d="M4.2 7.3a4 4 0 0 1 5.6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M1.8 4.9a7 7 0 0 1 10.4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
          {/* Battery */}
          <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
            <rect x="0.5" y="0.5" width="16" height="10" rx="2.5" stroke="currentColor" />
            <rect x="2" y="2" width="11" height="7" rx="1.5" fill="currentColor" />
            <path d="M17.5 3.5v4a1.5 1.5 0 0 0 0-4Z" fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="screen-content" style={{ flex: 1 }}>
        {/* Hero card */}
        <div className="auth-hero">
          <div className="auth-hero-eyebrow">Mood Energy</div>
          <h1>{t("auth.heroTitle")}</h1>
          <p>{t("auth.heroSubtitle")}</p>
        </div>

        {/* Tab switcher */}
        <div className="aura-tabs">
          <div
            className={`aura-tab${tab === "entrar" ? " active" : ""}`}
            onClick={() => setTab("entrar")}
          >
            {t("auth.signIn")}
          </div>
          <div
            className={`aura-tab${tab === "criar" ? " active" : ""}`}
            onClick={() => setTab("criar")}
          >
            {t("auth.createAccount")}
          </div>
        </div>

        {/* Tab: Entrar */}
        {tab === "entrar" && (
          <>
            <div className="aura-input-wrap">
              <label className="aura-input-label">{t("auth.email")}</label>
              <div className="aura-input aura-inline-field">
                {/* Ícone email */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
                <input
                  type="email"
                  value={state.email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEnterSubmit}
                  placeholder="voce@exemplo.com"
                  className="aura-inline-input"
                />
              </div>
            </div>

            <div className="aura-input-wrap" style={{ marginBottom: 20 }}>
              <label className="aura-input-label">{t("auth.password")}</label>
              <div
                className="aura-input"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div className="aura-inline-field">
                  {/* Ícone lock */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleEnterSubmit}
                    placeholder="••••••••"
                    className="aura-inline-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  style={{ border: "none", background: "transparent", padding: 0, display: "flex", cursor: "pointer" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <line x1="3" y1="21" x2="21" y2="3" />}
                  </svg>
                </button>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", color: "var(--text-2)", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: "var(--accent-peach)" }}
              />
              {t("auth.rememberMe")}
            </label>

            <div style={{ textAlign: "right", marginBottom: 16 }}>
              <Link to="/forgot-password" className="aura-muted-link">
                {t("auth.forgotPassword")}
              </Link>
            </div>

            {error && (
              <p className="aura-banner-error">
                {error}
              </p>
            )}

            <AuraButtonV2 className="aura-btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? t("auth.signingIn") : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  {t("auth.signInContinue")}
                </>
              )}
            </AuraButtonV2>

            <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 12 }}>
              {t("auth.afterLogin")}
            </p>

          </>
        )}

        {tab === "criar" && (
          <>
            <div className="aura-input-wrap">
              <label className="aura-input-label">{t("auth.name")}</label>
              <div className="aura-input aura-inline-field">
                {/* Ícone user */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="7" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleEnterSubmit}
                  placeholder={t("auth.namePlaceholder")}
                  className="aura-inline-input"
                />
              </div>
            </div>

            <div className="aura-input-wrap">
              <label className="aura-input-label">{t("auth.email")}</label>
              <div className="aura-input aura-inline-field">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
                <input
                  type="email"
                  value={state.email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEnterSubmit}
                  placeholder="voce@exemplo.com"
                  className="aura-inline-input"
                />
              </div>
            </div>

            <div className="aura-input-wrap" style={{ marginBottom: 20 }}>
              <label className="aura-input-label">{t("auth.password")}</label>
              <div
                className="aura-input"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div className="aura-inline-field">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleEnterSubmit}
                    placeholder="••••••••"
                    className="aura-inline-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  style={{ border: "none", background: "transparent", padding: 0, display: "flex", cursor: "pointer" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <line x1="3" y1="21" x2="21" y2="3" />}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <p className="aura-banner-error">
                {error}
              </p>
            )}

            <AuraButtonV2 className="aura-btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? t("auth.creating") : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="16" y1="11" x2="22" y2="11" />
                  </svg>
                  {t("auth.createContinue")}
                </>
              )}
            </AuraButtonV2>

            <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 12 }}>
              {t("auth.afterLogin")}
            </p>

          </>
        )}

        {/* Overlay de Confirmação de E-mail */}
        {showConfirmEmail && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'auraFadeIn 300ms ease-out'
          }}>
            <div className="aura-card" style={{ maxWidth: '340px', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'var(--accent-sage)',
                borderRadius: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'var(--accent-sage-ink)',
                boxShadow: 'var(--shadow-3d)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              </div>
              
              <h2 className="aura-page-title" style={{ marginBottom: '12px' }}>{t("auth.almostThere")}</h2>
              <p className="aura-page-subtitle" style={{ marginBottom: '24px', fontSize: '14px' }}>
                <Trans i18nKey="auth.confirmEmail" values={{ email: state.email }} components={{ 1: <b /> }} />
              </p>

              <AuraButtonV2 
                className="aura-btn-primary" 
                onClick={() => {
                  setShowConfirmEmail(false);
                  setTab("entrar");
                }}
              >
                {t("auth.goToLogin")}
              </AuraButtonV2>

              <button 
                onClick={() => setShowConfirmEmail(false)}
                style={{
                  marginTop: '16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t("auth.correctEmail")}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer legal */}
      <footer className="auth-footer" style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--warm-bg)' }}>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px', color: 'var(--text-3)' }}>
          <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-black transition-colors">{t("auth.terms")}</Link>
          <span style={{ color: 'var(--warm-border)' }}>|</span>
          <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }} className="hover:text-black transition-colors">{t("auth.privacy")}</Link>
        </div>
        <p style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text-3)', opacity: 0.6 }}>
          {t("auth.copyright")}
        </p>
      </footer>
    </div>
  );
}
