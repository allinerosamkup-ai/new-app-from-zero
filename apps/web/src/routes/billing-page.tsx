import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, CheckCircle2, ExternalLink } from "lucide-react";
import { api } from "../lib/api";

type SubscriptionStatus = {
  status: string | null;
  plan: string | null;
  periodEnd: string | null;
};

const FEATURES_FREE = [
  "Check-in diário de humor e energia",
  "Hábitos básicos (até 5)",
  "Diário reflexivo",
  "Planner básico",
];

const FEATURES_PRO = [
  "Tudo do plano gratuito",
  "IA Airia ilimitada (Aura, Planner, Check-in)",
  "Memória de longo prazo",
  "Insights e padrões avançados",
  "Previsão de fase (7 dias)",
  "Knowledge graph pessoal",
  "Hábitos ilimitados",
  "Exportação de dados",
];

export default function BillingPage() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const statusParam = searchParams.get("status");

  useEffect(() => {
    (api.get("/api/billing/status") as Promise<SubscriptionStatus>)
      .then((data) => setSub(data))
      .catch(() => setSub({ status: null, plan: null, periodEnd: null }))
      .finally(() => setLoading(false));
  }, []);

  const isActive = sub?.status === "active" || sub?.status === "trialing";

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      const res = await api.post("/api/billing/checkout", {}) as { url: string };
      window.location.href = res.url;
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await api.post("/api/billing/portal", {}) as { url: string };
      window.location.href = res.url;
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--warm-bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: 4 }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Plano</h1>
      </div>

      <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {statusParam === "success" && (
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(150,199,179,0.12)", border: "1.5px solid rgba(150,199,179,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={18} color="var(--accent-sage)" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--accent-sage)" }}>
              Assinatura ativada. Obrigada!
            </p>
          </div>
        )}

        {loading ? (
          <div style={{ height: 120, borderRadius: 20, background: "var(--warm-border)", animation: "pulse 1.5s infinite" }} />
        ) : (
          <div style={{
            padding: "20px",
            borderRadius: 20,
            border: isActive
              ? "1.5px solid rgba(150,199,179,0.35)"
              : "1.5px solid rgba(215,137,127,0.3)",
            background: isActive ? "rgba(150,199,179,0.07)" : "rgba(255,255,255,.9)",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: isActive ? "var(--accent-sage)" : "var(--accent-peach-ink)" }}>
              {isActive ? "Plano atual" : "Plano gratuito"}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "var(--text-1)" }}>
              {isActive ? "Airia Pro" : "Gratuito"}
            </p>
            {isActive && sub?.periodEnd && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>
                Renova em {new Date(sub.periodEnd).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        )}

        {!isActive && (
          <div style={{ padding: "20px", borderRadius: 20, border: "1.5px solid rgba(215,137,127,0.25)", background: "rgba(255,253,249,.97)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Sparkles size={16} color="var(--accent-peach)" />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-1)" }}>Airia Pro</p>
              <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 900, color: "var(--accent-peach-ink)" }}>
                R$29<span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>/mês</span>
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {FEATURES_PRO.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CheckCircle2 size={14} color="var(--accent-sage)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 999,
                border: "none",
                background: "var(--accent-peach)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 900,
                cursor: checkoutLoading ? "default" : "pointer",
                opacity: checkoutLoading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {checkoutLoading ? "Aguarde..." : "Assinar Airia Pro"}
            </button>
          </div>
        )}

        {isActive && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              minHeight: 48,
              borderRadius: 999,
              border: "1.5px solid var(--warm-border)",
              background: "transparent",
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 700,
              cursor: portalLoading ? "default" : "pointer",
              opacity: portalLoading ? 0.7 : 1,
            }}
          >
            <ExternalLink size={14} />
            {portalLoading ? "Aguarde..." : "Gerenciar assinatura"}
          </button>
        )}

        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>
            Plano gratuito inclui
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FEATURES_FREE.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-3)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
