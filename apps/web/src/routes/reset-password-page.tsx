// Reset Password — nova senha via token Supabase
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/aura.css";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase coloca o token na hash da URL; onAuthStateChange detecta automaticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("auth.recovery.tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.recovery.mismatch"));
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    }
  }

  if (done) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFB 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "40px 28px", textAlign: "center",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 28,
          background: "linear-gradient(135deg, #5A7A64, #BFDCCB)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, marginBottom: 20,
          boxShadow: "0 18px 32px rgba(17,24,39,.08)",
        }}>✅</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", marginBottom: 10 }}>
          {t("auth.recovery.resetDone")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-2)" }}>
          {t("auth.recovery.redirecting")}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFB 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 24px",
    }}>
      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: 24,
        background: "linear-gradient(135deg, #5A7A64 0%, #4E6B57 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32, marginBottom: 20,
        boxShadow: "0 18px 32px rgba(17,24,39,.08)",
      }}>🔐</div>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-1)", marginBottom: 6, textAlign: "center" }}>
        {t("auth.recovery.resetTitle")}
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 28, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
        {t("auth.recovery.resetSubtitle")}
      </p>

      {!sessionReady && (
        <div style={{
          width: "100%", maxWidth: 360, padding: "12px 16px",
          background: "rgba(229,219,247,.28)", borderRadius: 16,
          border: "1px solid rgba(229,219,247,.6)", marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: "var(--accent-peach-ink)", margin: 0, textAlign: "center" }}>
            {t("auth.recovery.waiting")}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
        {/* Password */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
            {t("auth.recovery.resetTitle")}
          </p>
          <div style={{ position: "relative" }}>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t("auth.recovery.minimum")}
              required
              style={{
                width: "100%", height: 50, borderRadius: 16,
                border: "1px solid var(--warm-border)",
                padding: "0 44px 0 16px",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--text-1)",
                background: "rgba(255,255,255,.98)", outline: "none",
                boxSizing: "border-box",
                backdropFilter: "blur(18px)",
                boxShadow: "0 10px 22px rgba(17,24,39,.05)",
              }}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-3)" }}
            >
              {show ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {/* Confirm */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
            {t("auth.recovery.confirm")}
          </p>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={t("auth.recovery.repeat")}
              required
              style={{
                width: "100%", height: 50, borderRadius: 16,
                border: `1px solid ${confirm && confirm !== password ? "#c0392b" : "var(--warm-border)"}`,
                padding: "0 44px 0 16px",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "var(--text-1)",
                background: "rgba(255,255,255,.98)", outline: "none",
                boxSizing: "border-box",
                backdropFilter: "blur(18px)",
                boxShadow: "0 10px 22px rgba(17,24,39,.05)",
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-3)" }}
            >
              {showConfirm ? "🙈" : "👁️"}
            </button>
          </div>
          {confirm && confirm !== password && (
            <p style={{ fontSize: 11, color: "#c0392b", marginTop: 4 }}>{t("auth.recovery.mismatch")}</p>
          )}
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(192,57,43,.08)", border: "1px solid rgba(192,57,43,.2)",
            marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, color: "#c0392b", margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !sessionReady}
          style={{
            width: "100%", height: 50,
            background: loading || !sessionReady
              ? "rgba(90,122,100,.24)"
              : "linear-gradient(135deg, #5A7A64 0%, #4E6B57 100%)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: loading || !sessionReady ? "not-allowed" : "pointer",
            boxShadow: loading || !sessionReady ? "none" : "0 14px 26px rgba(90,122,100,.18)",
            transition: "all 200ms",
          }}
        >
          {loading ? t("auth.recovery.resetting") : t("auth.recovery.reset")}
        </button>
      </form>

      <button
        onClick={() => navigate("/login")}
        style={{ marginTop: 20, background: "none", border: "none", fontSize: 13, color: "var(--text-3)", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        ← {t("auth.recovery.backToLogin")}
      </button>
    </div>
  );
}

