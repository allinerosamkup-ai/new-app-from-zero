import { useState, useEffect } from "react";
import { api } from "../lib/api";

export type SubscriptionStatus = {
  status: string | null;
  plan: string | null;
  periodEnd: string | null;
};

export type UseSubscriptionResult = SubscriptionStatus & {
  isPro: boolean;
  loading: boolean;
  refresh: () => void;
};

/**
 * Consulta o status de assinatura via /api/billing/status.
 * `isPro` é true quando a assinatura está active ou trialing.
 */
export function useSubscription(): UseSubscriptionResult {
  const [sub, setSub] = useState<SubscriptionStatus>({ status: null, plan: null, periodEnd: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (api.get("/api/billing/status") as Promise<SubscriptionStatus>)
      .then((data) => { if (alive) setSub(data); })
      .catch(() => { if (alive) setSub({ status: null, plan: null, periodEnd: null }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tick]);

  const isPro = sub.status === "active" || sub.status === "trialing";

  return { ...sub, isPro, loading, refresh: () => setTick((n) => n + 1) };
}
