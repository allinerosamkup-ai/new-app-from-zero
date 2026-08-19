// Forgot Password — recuperação de senha com timer 60s
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/aura.css";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  async function handleSend() {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
      setTimer(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.recovery.sendError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (timer > 0) return;
    setSent(false);
    setTimer(0);
    await handleSend();
  }

  return (
    <div className="aura-page-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "48px 24px 32px" }}>
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", cursor: "pointer", alignSelf: "flex-start", padding: 0, marginBottom: 32, display: "flex", alignItems: "center", gap: 6, color: "var(--text-2)", fontSize: 14 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t("common.back")}
      </button>

      {/* Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: "var(--accent-peach-a3)",
        border: "1px solid var(--accent-peach-a5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 20,
      }}>
        🔑
      </div>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", marginBottom: 8 }}>
        {t("auth.recovery.forgotTitle")}
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 32 }}>
        {t("auth.recovery.forgotSubtitle")}
      </p>

      {!sent ? (
        <>
          <div className="aura-input-wrap">
            <label className="aura-input-label">{t("auth.recovery.yourEmail")}</label>
            <div className="aura-input aura-inline-field">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="m2 7 10 7 10-7" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                onKeyDown={e => e.key === "Enter" && handleSend()}
                className="aura-inline-input"
              />
            </div>
          </div>

          {error && (
            <p className="aura-banner-error">
              {error}
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={loading || !email.trim()}
            style={{
              width: "100%", height: 46,
              background: "linear-gradient(135deg, #5A7A64 0%, #4E6B57 100%)",
              color: "#fff", border: "none", borderRadius: 16,
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
              cursor: loading || !email.trim() ? "not-allowed" : "pointer",
              opacity: loading || !email.trim() ? 0.6 : 1,
              boxShadow: "0 14px 24px rgba(90,122,100,.18)",
              transition: "all 150ms",
            }}
          >
            {loading ? t("auth.recovery.sending") : t("auth.recovery.send")}
          </button>
        </>
      ) : (
        /* Sucesso */
        <div style={{
          background: "rgba(255,255,255,.98)",
          border: "1px solid rgba(17,24,39,.05)",
          borderRadius: 24, padding: 24, textAlign: "center",
          backdropFilter: "blur(18px)",
          boxShadow: "0 18px 32px rgba(17,24,39,.06)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>
            {t("auth.recovery.sent")}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 20 }}>
            {t("auth.recovery.checkInbox", { email })}
          </p>

          <button
            onClick={handleResend}
            disabled={timer > 0}
            style={{
              background: "none", border: "none", cursor: timer > 0 ? "default" : "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600,
              color: timer > 0 ? "var(--text-3)" : "var(--accent-peach-ink)",
            }}
          >
            {timer > 0 ? t("auth.recovery.resendIn", { seconds: timer }) : t("auth.recovery.resend")}
          </button>
        </div>
      )}

      <button
        onClick={() => navigate("/login")}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "var(--text-3)",
          marginTop: 24, textAlign: "center",
        }}
      >
        {t("auth.recovery.remembered")} <span style={{ color: "var(--accent-peach-ink)", fontWeight: 600 }}>{t("auth.signIn")}</span>
      </button>
    </div>
  );
}
