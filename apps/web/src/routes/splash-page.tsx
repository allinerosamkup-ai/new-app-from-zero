// Splash / Welcome — tela de entrada antes do auth
import { useNavigate } from "react-router-dom";
import "../styles/aura.css";
import "../styles/aura-v2.css";

export function SplashPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #FFF7F1 0%, #FFF0E5 48%, #F7F3ED 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "60px 28px 48px",
    }}>

      {/* Logo + tagline */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {/* Ícone / logo */}
        <div style={{
          width: 80, height: 80,
          borderRadius: 28,
          background: "linear-gradient(135deg, var(--nectarine) 0%, var(--nectarine-10) 60%, var(--menthe) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38,
          boxShadow: "0 8px 32px rgba(243,176,140,.28), 0 2px 8px rgba(243,176,140,.16)",
          marginBottom: 28,
        }}>
          🌸
        </div>

        <h1 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 28,
          fontWeight: 800,
          color: "var(--text-1)",
          lineHeight: 1.25,
          marginBottom: 14,
          letterSpacing: "-0.02em",
        }}>
          Mood Energy
        </h1>

        <p style={{
          fontSize: 15,
          color: "var(--text-2)",
          lineHeight: 1.65,
          maxWidth: 280,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          Produtividade que respeita o seu ritmo — humor, energia e rotina em harmonia.
        </p>

        {/* Decoração de fases */}
        <div style={{ display: "flex", gap: 8, marginTop: 32 }}>
          {["🌙", "🌱", "🚀", "🌊"].map((e, i) => (
            <div key={i} style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,.62)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,.82)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 10px 24px rgba(243,176,140,.10)",
            }}>
              {e}
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={() => navigate("/login?tab=criar")}
          style={{
            width: "100%", height: 50,
            background: "linear-gradient(135deg, var(--nectarine) 0%, var(--nectarine-10) 100%)",
            color: "#fff", border: "none", borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 12px 28px rgba(243,176,140,.28)",
            transition: "all 150ms ease",
          }}
        >
          Criar minha conta
        </button>
        <button
          onClick={() => navigate("/login")}
          style={{
            width: "100%", height: 50,
            background: "rgba(255,255,255,.62)",
            backdropFilter: "blur(16px)",
            color: "var(--nectarine-11)", border: "1.5px solid var(--nectarine-a5)",
            borderRadius: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          Já tenho conta
        </button>

        <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 4 }}>
          Respeitamos sua privacidade e sua ciclagem 🌸
        </p>
      </div>
    </div>
  );
}
