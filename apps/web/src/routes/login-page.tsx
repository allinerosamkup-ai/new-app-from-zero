import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuraStore } from "../features/aura/store";
import { supabase } from "../lib/supabase";
import "../styles/aura.css";

type Tab = "entrar" | "criar";
const REMEMBER_ME_KEY = "aura.rememberMe";
const REMEMBERED_EMAIL_KEY = "aura.rememberedEmail";

export function LoginPage() {
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
      if (tab === "entrar") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: state.email,
          password,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: state.email,
          password,
          options: { data: { full_name: state.name } },
        });
        if (err) throw err;
      }
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_ME_KEY, "true");
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, state.email);
      } else {
        window.localStorage.setItem(REMEMBER_ME_KEY, "false");
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      navigate("/home");
    } catch (err: any) {
      const msg = err?.message || "Erro ao autenticar";
      if (msg.includes("Invalid login credentials")) setError("Email ou senha incorretos.");
      else if (msg.includes("already registered")) setError("Email já cadastrado. Tente entrar.");
      else if (msg.includes("Password should be")) setError("Senha muito curta — mínimo 6 caracteres.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/home`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar com Google');
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
          <h1>Seu ritmo merece um ponto de partida mais gentil.</h1>
          <p>Acompanhe humor, energia e rotina em um fluxo que respeita sua ciclagem.</p>
        </div>

        {/* Tab switcher */}
        <div className="aura-tabs">
          <div
            className={`aura-tab${tab === "entrar" ? " active" : ""}`}
            onClick={() => setTab("entrar")}
          >
            Entrar
          </div>
          <div
            className={`aura-tab${tab === "criar" ? " active" : ""}`}
            onClick={() => setTab("criar")}
          >
            Criar conta
          </div>
        </div>

        {/* Tab: Entrar */}
        {tab === "entrar" && (
          <>
            <div className="aura-input-wrap">
              <label className="aura-input-label">Email</label>
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
              <label className="aura-input-label">Senha</label>
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
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
              Lembrar de mim
            </label>

            <div style={{ textAlign: "right", marginBottom: 16 }}>
              <Link to="/forgot-password" className="aura-muted-link">
                Esqueci minha senha
              </Link>
            </div>

            {error && (
              <p className="aura-banner-error">
                {error}
              </p>
            )}

            <AuraButtonV2 className="aura-btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? "Entrando..." : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Entrar e continuar
                </>
              )}
            </AuraButtonV2>

            <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 12 }}>
              Depois do login, seguimos direto para seu dia.
            </p>

            <div style={{ margin: "24px 0", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "var(--warm-border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>OU</span>
              <div style={{ flex: 1, height: 1, background: "var(--warm-border)" }} />
            </div>

            <AuraButtonV2
              variant="ghost"
              onClick={handleGoogleLogin}
              style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", justifyContent: "center", background: "white", border: "1.5px solid var(--warm-border)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </AuraButtonV2>
          </>
        )}

        {/* Tab: Criar conta */}
        {tab === "criar" && (
          <>
            <div className="aura-input-wrap">
              <label className="aura-input-label">Seu nome</label>
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
                  placeholder="Como quer ser chamado(a)?"
                  className="aura-inline-input"
                />
              </div>
            </div>

            <div className="aura-input-wrap">
              <label className="aura-input-label">Email</label>
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
              <label className="aura-input-label">Senha</label>
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
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
              {loading ? "Criando conta..." : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="16" y1="11" x2="22" y2="11" />
                  </svg>
                  Criar conta e continuar
                </>
              )}
            </AuraButtonV2>

            <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 12 }}>
              Depois do login, seguimos direto para seu dia.
            </p>

            <div style={{ margin: "24px 0", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "var(--warm-border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>OU</span>
              <div style={{ flex: 1, height: 1, background: "var(--warm-border)" }} />
            </div>

            <AuraButtonV2
              variant="ghost"
              onClick={handleGoogleLogin}
              style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", justifyContent: "center", background: "white", border: "1.5px solid var(--warm-border)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </AuraButtonV2>
          </>
        )}
      </div>
    </div>
  );
}
