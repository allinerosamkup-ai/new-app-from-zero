import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CheckCircle2, ChevronLeft, ExternalLink, Sparkles } from "lucide-react";

import { useLocalizedCopy, useLanguage } from "../i18n";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/track";
import {
  useSubscription,
  type BillingOffer,
  type BillingPlan,
} from "../hooks/useSubscription";

type CheckoutVerification = {
  confirmed: boolean;
  plan: BillingPlan | null;
  status: string | null;
};

type ConfirmationDependencies = {
  get?: (path: string) => Promise<CheckoutVerification>;
  delay?: (milliseconds: number) => Promise<void>;
  attempts?: number;
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const VERIFICATION_STORAGE_KEY = "airia:billing:verification";

export function storeCheckoutVerification(
  verificationId: string,
  storage: Pick<Storage, "setItem"> = window.sessionStorage,
) {
  storage.setItem(VERIFICATION_STORAGE_KEY, verificationId);
}

export async function confirmCheckoutSession(
  sessionId: string,
  dependencies: ConfirmationDependencies = {},
): Promise<CheckoutVerification> {
  const get = dependencies.get ?? ((path) => api.get(path) as Promise<CheckoutVerification>);
  const delay = dependencies.delay ?? wait;
  const attempts = dependencies.attempts ?? 5;
  let last: CheckoutVerification = { confirmed: false, plan: null, status: "pending" };
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      last = await get(`/billing/checkout-session/${encodeURIComponent(sessionId)}`);
      if (last.confirmed) return last;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await delay(1200);
  }
  if (lastError) throw lastError;
  return last;
}

function formatMoney(amountCents: number, language: string) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function offerName(plan: BillingPlan, l: ReturnType<typeof useLocalizedCopy>) {
  if (plan === "monthly") return l("Mensal", "Monthly");
  if (plan === "annual") return l("Anual", "Annual");
  return l("Oferta vitalícia", "Lifetime offer");
}

function offerPeriod(offer: BillingOffer, l: ReturnType<typeof useLocalizedCopy>) {
  if (offer.billingPeriod === "month") return l("por mês", "per month");
  if (offer.billingPeriod === "year") return l("por ano", "per year");
  return l("pagamento único", "one-time payment");
}

export default function BillingPage() {
  const l = useLocalizedCopy();
  const language = useLanguage();
  const navigate = useNavigate();
  const subscription = useSubscription();
  const enabledOffers = useMemo(
    () => subscription.offers.filter((offer) => offer.enabled),
    [subscription.offers],
  );
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan>("annual");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<"idle" | "pending" | "confirmed" | "delayed" | "error">("idle");
  const checkoutAttempt = useRef<{ plan: BillingPlan; key: string } | null>(null);
  const checkoutInFlight = useRef(false);

  const sessionId = new URLSearchParams(window.location.search).get("session_id")
    ?? window.sessionStorage.getItem(VERIFICATION_STORAGE_KEY);

  useEffect(() => {
    if (!enabledOffers.some((offer) => offer.plan === selectedPlan) && enabledOffers[0]) {
      setSelectedPlan(enabledOffers[0].plan);
    }
  }, [enabledOffers, selectedPlan]);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    setVerification("pending");
    confirmCheckoutSession(sessionId)
      .then((result) => {
        if (!alive) return;
        if (result.confirmed) {
          window.sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);
          setVerification("confirmed");
          trackEvent("subscription_started", { plan: result.plan });
          subscription.refresh();
        } else {
          setVerification("delayed");
        }
      })
      .catch(() => { if (alive) setVerification("error"); });
    return () => { alive = false; };
  }, [sessionId]);

  async function handleCheckout() {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setCheckoutLoading(true);
    setCheckoutError(null);
    trackEvent("upgrade_clicked", { plan: selectedPlan });
    try {
      if (!checkoutAttempt.current || checkoutAttempt.current.plan !== selectedPlan) {
        checkoutAttempt.current = { plan: selectedPlan, key: globalThis.crypto.randomUUID() };
      }
      const { data: { session } } = await supabase.auth.getSession();
      const result = await api.post("/billing/checkout", {
        email: session?.user?.email,
        plan: selectedPlan,
        attemptKey: checkoutAttempt.current.key,
      }) as { url: string; verificationId: string };
      storeCheckoutVerification(result.verificationId);
      window.location.assign(result.url);
    } catch {
      setCheckoutError("checkout_failed");
    } finally {
      setCheckoutLoading(false);
      checkoutInFlight.current = false;
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    setCancelMessage(null);
    try {
      await api.post("/billing/cancel", { confirm: true });
      setCancelConfirm(false);
      setCancelMessage("canceled");
      subscription.refresh();
    } catch {
      setCancelMessage("error");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const result = await api.post("/billing/portal", {}) as { url: string };
      window.location.assign(result.url);
    } finally {
      setPortalLoading(false);
    }
  }

  const paid = subscription.source === "paid";
  const showOffers = subscription.source === "free" || subscription.source === "trial";

  return (
    <main style={{ minHeight: "100dvh", background: "var(--warm-bg)", paddingBottom: 32 }}>
      <header style={{ padding: "16px 20px 4px", display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" aria-label={l("Voltar", "Back")} onClick={() => navigate(-1)} style={{ border: 0, background: "none", padding: 4, cursor: "pointer" }}>
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: 20 }}>{l("Plano", "Plan")}</h1>
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: 20, display: "grid", gap: 16 }}>
        {verification !== "idle" && (
          <section role="status" style={{ padding: 16, borderRadius: 16, background: "rgba(150,199,179,.12)", border: "1px solid rgba(150,199,179,.3)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {verification === "confirmed" ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
              <strong>
                {verification === "confirmed"
                  ? l("Pagamento confirmado", "Payment confirmed")
                  : verification === "pending"
                    ? l("Confirmando seu pagamento", "Confirming your payment")
                    : l("A confirmação está demorando um pouco", "Confirmation is taking a little longer")}
              </strong>
            </div>
            {(verification === "delayed" || verification === "error") && (
              <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 10 }}>
                {l("Tentar novamente", "Try again")}
              </button>
            )}
          </section>
        )}

        {subscription.loading ? (
          <div role="status" aria-label={l("Carregando plano", "Loading plan")} style={{ minHeight: 96, borderRadius: 20, background: "var(--warm-border)" }} />
        ) : subscription.error ? (
          <section style={{ padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--warm-border)" }}>
            <strong>{l("Não consegui carregar seu plano agora.", "Your plan could not be loaded right now.")}</strong>
            <button type="button" onClick={subscription.refresh} style={{ display: "block", marginTop: 12 }}>
              {l("Tentar novamente", "Try again")}
            </button>
          </section>
        ) : (
          <section style={{ padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--warm-border)" }}>
            <small style={{ fontWeight: 900, textTransform: "uppercase", color: "var(--text-3)" }}>
              {l("Seu acesso", "Your access")}
            </small>
            <h2 style={{ margin: "5px 0", fontSize: 22 }}>
              {subscription.source === "trial"
                ? l(`Airia Pro · ${subscription.daysRemaining} dias restantes`, `Airia Pro · ${subscription.daysRemaining} days left`)
                : subscription.source === "professional"
                  ? l("Airia Pro · profissional verificada", "Airia Pro · verified professional")
                  : paid
                    ? `Airia Pro · ${offerName(subscription.plan ?? "monthly", l)}`
                    : l("Plano gratuito", "Free plan")}
            </h2>
            {subscription.trialEndsAt && subscription.source === "trial" && (
              <p style={{ margin: 0, color: "var(--text-2)" }}>
                {l("Seu período Pro continua até ", "Your Pro period continues until ")}
                {new Date(subscription.trialEndsAt).toLocaleDateString(language === "en" ? "en-US" : "pt-BR")}.
              </p>
            )}
          </section>
        )}

        {showOffers && enabledOffers.length > 0 && (
          <section style={{ padding: 20, borderRadius: 20, background: "rgba(255,253,249,.98)", border: "1.5px solid rgba(134,183,154,.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles size={17} />
              <strong>{l("Continue com a Airia Pro", "Continue with Airia Pro")}</strong>
            </div>
            <div role="radiogroup" aria-label={l("Escolha um plano", "Choose a plan")} style={{ display: "grid", gap: 10 }}>
              {enabledOffers.map((offer) => {
                const selected = selectedPlan === offer.plan;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    key={offer.plan}
                    onClick={() => setSelectedPlan(offer.plan)}
                    style={{ minHeight: 70, padding: "12px 14px", borderRadius: 14, textAlign: "left", cursor: "pointer", background: selected ? "rgba(134,183,154,.12)" : "#fff", border: selected ? "2px solid var(--accent-peach)" : "1px solid var(--warm-border)" }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 900 }}>
                      <span>{offerName(offer.plan, l)}</span>
                      <span>{formatMoney(offer.amountCents, language)}</span>
                    </span>
                    <small style={{ color: "var(--text-2)" }}>{offerPeriod(offer, l)}</small>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: 7, margin: "18px 0" }}>
              {[
                l("Airia, Planner e Check-in com IA", "AI across Airia, Planner, and Check-in"),
                l("Memória e padrões de longo prazo", "Long-term memory and patterns"),
                l("Hábitos e insights avançados", "Advanced habits and insights"),
              ].map((feature) => <span key={feature}><Check size={13} /> {feature}</span>)}
            </div>

            <button type="button" onClick={handleCheckout} disabled={checkoutLoading || !subscription.checkoutAvailable} style={{ width: "100%", minHeight: 50, borderRadius: 999, border: 0, background: "var(--accent-peach)", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
              {checkoutLoading ? l("Abrindo pagamento...", "Opening checkout...") : l("Escolher este plano", "Choose this plan")}
            </button>
            {checkoutError && <p role="alert">{l("Não consegui abrir o pagamento. Tente novamente.", "Checkout could not be opened. Try again.")}</p>}
            <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
              {selectedPlan === "lifetime"
                ? l("Uma única cobrança. Sem renovação.", "One charge. No renewal.")
                : l("Você pode cancelar a renovação quando quiser.", "You can cancel renewal at any time.")}
            </p>
          </section>
        )}

        {paid && subscription.provider === "stripe" && (
          <button type="button" onClick={handlePortal} disabled={portalLoading} style={{ minHeight: 48, borderRadius: 999, border: "1px solid var(--warm-border)", background: "#fff", fontWeight: 800 }}>
            <ExternalLink size={15} /> {portalLoading ? l("Abrindo...", "Opening...") : l("Gerenciar pagamento", "Manage payment")}
          </button>
        )}

        {paid && subscription.provider === "cakto" && subscription.plan !== "lifetime" && (
          <section style={{ display: "grid", gap: 10 }}>
            {!cancelConfirm ? (
              <button type="button" onClick={() => setCancelConfirm(true)} style={{ minHeight: 48, borderRadius: 999, border: "1px solid var(--warm-border)", background: "#fff", fontWeight: 800 }}>
                {l("Cancelar renovação", "Cancel renewal")}
              </button>
            ) : (
              <div role="alert" style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid var(--warm-border)" }}>
                <strong>{l("Confirmar cancelamento da renovação?", "Confirm renewal cancellation?")}</strong>
                <p>{l("Seu acesso continua até o fim do período já pago.", "Your access continues through the paid period.")}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={handleCancel} disabled={cancelLoading}>
                    {cancelLoading ? l("Cancelando...", "Canceling...") : l("Confirmar cancelamento", "Confirm cancellation")}
                  </button>
                  <button type="button" onClick={() => setCancelConfirm(false)} disabled={cancelLoading}>
                    {l("Manter assinatura", "Keep subscription")}
                  </button>
                </div>
              </div>
            )}
            {cancelMessage === "canceled" && <p role="status">{l("Renovação cancelada. Seu acesso continua até o fim do período pago.", "Renewal canceled. Access continues through the paid period.")}</p>}
            {cancelMessage === "error" && <p role="alert">{l("Não consegui cancelar agora. Tente novamente.", "Cancellation failed. Try again.")}</p>}
          </section>
        )}

        <button type="button" onClick={() => navigate("/")} style={{ minHeight: 44, border: 0, background: "none", color: "var(--text-2)", fontWeight: 800, cursor: "pointer" }}>
          {l("Continuar gratuitamente", "Continue for free")}
        </button>
      </div>
    </main>
  );
}
