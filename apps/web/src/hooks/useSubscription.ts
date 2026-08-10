import { useCallback, useEffect, useState } from "react";

import { api } from "../lib/api";

export type BillingPlan = "monthly" | "annual" | "lifetime";

export type BillingOffer = {
  plan: BillingPlan;
  amountCents: number;
  currency: "BRL";
  billingPeriod: "month" | "year" | "once";
  enabled: boolean;
};

export type BillingAccessSummary = {
  access: "pro" | "free";
  source: "paid" | "professional" | "trial" | "free";
  subscriptionStatus: string | null;
  plan: BillingPlan | null;
  periodEnd: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  checkoutAvailable: boolean;
  offers: BillingOffer[];
};

export type UseSubscriptionResult = BillingAccessSummary & {
  isPro: boolean;
  loading: boolean;
  error: "status_unavailable" | null;
  refresh: () => void;
};

const EMPTY_SUMMARY: BillingAccessSummary = {
  access: "free",
  source: "free",
  subscriptionStatus: null,
  plan: null,
  periodEnd: null,
  trialEndsAt: null,
  daysRemaining: 0,
  checkoutAvailable: false,
  offers: [],
};

export function useSubscription(): UseSubscriptionResult {
  const [summary, setSummary] = useState<BillingAccessSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"status_unavailable" | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await api.get("/billing/status") as BillingAccessSummary;
        if (alive) setSummary({ ...data, offers: Array.isArray(data.offers) ? data.offers : [] });
      } catch {
        if (alive) {
          setSummary(EMPTY_SUMMARY);
          setError("status_unavailable");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return {
    ...summary,
    isPro: summary.access === "pro",
    loading,
    error,
    refresh,
  };
}
