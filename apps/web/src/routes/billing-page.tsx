import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, CheckCircle2, ExternalLink, Zap, Check } from "lucide-react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/track";
import { useTranslation } from "react-i18next";
import { resolveIntlLocale } from "../i18n";

type SubscriptionStatus = {
  status: string | null;
  plan: string | null;
  periodEnd: string | null;
};

type BillingPlan = "monthly" | "annual";

export default function BillingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan>("annual");

  const searchParams = new URLSearchParams(window.location.search);
  const statusParam = searchParams.get("status");

  useEffect(() => {
    if (statusParam === "success") {
      trackEvent("subscription_started", { plan: selectedPlan });
    }
    (api.get("/api/billing/status") as Promise<SubscriptionStatus>)
      .then((data) => setSub(data))
      .catch(() => setSub({ status: null, plan: null, periodEnd: null }))
      .finally(() => setLoading(false));
  }, []);

  const isActive = sub?.status === "active" || sub?.status === "trialing";

  const monthlyPrice = 29;
  const annualTotal = 249;
  const annualMonthly = Math.round(annualTotal / 12);
  const savingsPct = Math.round((1 - annualMonthly / monthlyPrice) * 100);
  const annualSavings = monthlyPrice * 12 - annualTotal;

  async function handleCheckout() {
    setCheckoutLoading(true);
    trackEvent("upgrade_clicked", { plan: selectedPlan });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await api.post("/api/billing/checkout", {
        email: session?.user?.email,
        plan: selectedPlan,
      }) as { url: string };
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
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{t("billing.title")}</h1>
      </div>

      <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {statusParam === "success" && (
          <div style={{
            padding: "14px 16px", borderRadius: 16,
            background: "rgba(150,199,179,0.12)", border: "1.5px solid rgba(150,199,179,0.3)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <CheckCircle2 size={18} color="var(--accent-sage)" />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--accent-sage)" }}>
              {t("billing.activated")}
            </p>
          </div>
        )}

        {loading ? (
          <div style={{ height: 80, borderRadius: 20, background: "var(--warm-border)", animation: "pulse 1.5s infinite" }} />
        ) : (
          <div style={{
            padding: "18px 20px", borderRadius: 20,
            border: isActive ? "1.5px solid rgba(150,199,179,0.35)" : "1.5px solid rgba(215,137,127,0.2)",
            background: isActive ? "rgba(150,199,179,0.07)" : "rgba(255,255,255,.85)",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", color: isActive ? "var(--accent-sage)" : "var(--text-3)" }}>
              {isActive ? t("billing.currentPlan") : t("billing.freePlan")}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "var(--text-1)" }}>
              {isActive ? "Airia Pro" : t("billing.free")}
            </p>
            {isActive && sub?.periodEnd && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>
                {t("billing.renewsOn", { date: new Date(sub.periodEnd).toLocaleDateString(resolveIntlLocale(i18n.language)) })}
              </p>
            )}
          </div>
        )}

        {!isActive && (
          <div style={{ padding: "20px", borderRadius: 20, border: "1.5px solid rgba(215,137,127,0.28)", background: "rgba(255,253,249,.97)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Sparkles size={16} color="var(--accent-peach)" />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-1)" }}>Airia Pro</p>
            </div>

            <div style={{ display: "flex", background: "rgba(215,137,127,0.08)", borderRadius: 14, padding: 4, marginBottom: 18, gap: 4 }}>
              {(["monthly", "annual"] as BillingPlan[]).map((p) => {
                const active = selectedPlan === p;
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPlan(p)}
                    style={{
                      flex: 1, height: 40, borderRadius: 10, border: "none",
                      background: active ? "var(--accent-peach)" : "transparent",
                      color: active ? "#fff" : "var(--text-2)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                      transition: "all .2s ease",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {p === "monthly" ? t("billing.monthly") : t("billing.annual")}
                    {p === "annual" && (
                      <span style={{
                        fontSize: 10, fontWeight: 900,
                        background: active ? "rgba(255,255,255,0.25)" : "var(--accent-peach)",
                        color: "#fff", padding: "1px 6px", borderRadius: 999, letterSpacing: ".04em",
                      }}>
                        -{savingsPct}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 18, textAlign: "center" }}>
              {selectedPlan === "monthly" ? (
                <div>
                  <span style={{ fontSize: 36, fontWeight: 900, color: "var(--accent-peach-ink)" }}>R$29</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)" }}>{t("billing.perMonth")}</span>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: "var(--accent-peach-ink)" }}>
                      {"R$"}{annualMonthly}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)" }}>{t("billing.perMonth")}</span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>
                    {t("billing.annualCharge", { total: annualTotal })}{" "}
                    <span style={{
                      background: "rgba(150,199,179,0.18)", color: "var(--accent-sage)",
                      padding: "1px 7px", borderRadius: 999, fontWeight: 800, fontSize: 10.5,
                    }}>
                      {t("billing.annualSaving", { saving: annualSavings })}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {(t("billing.proFeatures", { returnObjects: true }) as string[]).map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(150,199,179,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}>
                    <Check size={11} color="var(--accent-sage)" strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              style={{
                width: "100%", minHeight: 50, borderRadius: 999, border: "none",
                background: "var(--accent-peach)", color: "#fff",
                fontSize: 15, fontWeight: 900,
                cursor: checkoutLoading ? "default" : "pointer",
                opacity: checkoutLoading ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 24px rgba(215,137,127,0.28)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {checkoutLoading ? t("billing.wait") : (
                <>
                  <Zap size={16} />
                  {selectedPlan === "annual"
                    ? t("billing.subscribeAnnual", { total: annualTotal })
                    : t("billing.subscribeMonthly")}
                </>
              )}
            </button>

            <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
              {t("billing.cancelAnytime")}
            </p>
          </div>
        )}

        {isActive && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", minHeight: 48, borderRadius: 999,
              border: "1.5px solid rgba(215,137,127,0.22)",
              background: "rgba(255,255,255,.85)", color: "var(--text-1)",
              fontSize: 13, fontWeight: 700,
              cursor: portalLoading ? "default" : "pointer",
              opacity: portalLoading ? 0.7 : 1,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <ExternalLink size={15} />
            {portalLoading ? t("billing.wait") : t("billing.manage")}
          </button>
        )}

        {!isActive && (
          <div style={{ padding: "16px 20px", borderRadius: 18, background: "rgba(255,255,255,.7)", border: "1px solid var(--warm-border)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-3)" }}>
              {t("billing.freeIncludes")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(t("billing.freeFeatures", { returnObjects: true }) as string[]).map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={12} color="var(--text-3)" strokeWidth={2.5} />
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
