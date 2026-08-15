import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type AiriaRiskSafety = {
  riskLevel: "none" | "low" | "moderate" | "high" | "crisis";
  route: "self_support" | "adapt_day" | "human_support" | "crisis_protocol";
  signals: string[];
};

export type AiriaReadingEnvelope = {
  version: "v1";
  generatedAt: string;
  currentState: {
    phase?: string;
    confidence?: number;
    observedAt?: string;
    moodScore?: number | null;
    energyScore?: number | null;
    intraday?: {
      observations?: number;
      direction?: string;
      range?: number;
      oscillation?: string;
    };
  };
  period: {
    from?: string;
    to?: string;
    observedDays?: number;
    windowDays?: number;
    coverage?: number;
    confidence?: number;
  };
  alerts: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    evidenceIds?: string[];
    route?: string;
  }>;
  riskSafety?: AiriaRiskSafety;
  decision?: {
    id: string;
    status: "proposed" | "accepted" | "corrected" | "rejected" | "done" | "substituted";
    title: string;
    reason: string;
    objectiveId?: string | null;
    actionId?: string | null;
    evidenceIds?: string[];
    requiresConfirmation?: boolean;
  };
};

function isReading(value: unknown): value is AiriaReadingEnvelope {
  if (!value || typeof value !== "object") return false;
  const reading = value as Partial<AiriaReadingEnvelope>;
  return reading.version === "v1"
    && Boolean(reading.currentState && typeof reading.currentState === "object")
    && Boolean(reading.period && typeof reading.period === "object")
    && Array.isArray(reading.alerts);
}

export async function fetchAiriaReading(range?: { from?: string; to?: string }): Promise<AiriaReadingEnvelope | null> {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);
  try {
    const response = await api.get(`/airia/reading${params.size ? `?${params.toString()}` : ""}`);
    return isReading(response) ? response : null;
  } catch {
    // A leitura canônica é progressiva durante o rollout. Cada tela mantém a
    // leitura antiga só enquanto a API ainda não estiver disponível.
    return null;
  }
}

export function useAiriaReading(range?: { from?: string; to?: string }) {
  const [reading, setReading] = useState<AiriaReadingEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await fetchAiriaReading(range);
    setReading(next);
    setAvailable(Boolean(next));
    setLoading(false);
    return next;
  }, [range?.from, range?.to]);

  useEffect(() => { void reload(); }, [reload]);
  return { reading, loading, available, reload };
}

export async function sendAiriaDecisionFeedback(
  decisionId: string,
  status: "accepted" | "corrected" | "rejected" | "done" | "substituted",
  surface: "home" | "insights" | "journal" | "goals" | "checkin_result" | "daily_summary" | "aura",
  correction?: string,
): Promise<boolean> {
  try {
    await api.post(`/airia/decisions/${decisionId}/feedback`, {
      status,
      surface,
      ...(correction?.trim() ? { correction: correction.trim() } : {}),
    });
    return true;
  } catch {
    return false;
  }
}
