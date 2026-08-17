import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type AiriaRiskSafety = {
  riskLevel: "none" | "low" | "moderate" | "high" | "crisis";
  route: "self_support" | "adapt_day" | "human_support" | "crisis_protocol";
  signals: string[];
};

/**
 * Quanto cabe hoje — inferido pela Airia, nunca perguntado.
 *
 * Vem pronto do servidor, frase inclusive: a Home e o resultado do check-in não
 * podem escrever versões diferentes disso sobre o mesmo dia. Opcional porque
 * leitura gravada antes desta versão não tem o campo.
 */
export type AiriaCapacity = {
  level: "protecao" | "baixa" | "media" | "alta";
  size: "quick" | "moderate" | "heavy";
  stepMinutes: number;
  reason: string;
  basis: string[];
  confidence: "alta" | "media" | "baixa";
  assumed: boolean;
  corrected: boolean;
};

export type AiriaReadingEnvelope = {
  version: "v1";
  generatedAt: string;
  capacity?: AiriaCapacity | null;
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

/**
 * Corrigir o tamanho do dia — um toque, sem campo de texto.
 *
 * O servidor recalcula a leitura e devolve o envelope já corrigido, então a
 * tela mostra o novo tamanho na hora em vez de esperar o próximo check-in.
 */
export async function correctAiriaCapacity(
  decisionId: string,
  direction: "mais" | "menos",
  surface: "home" | "checkin_result" | "daily_summary",
): Promise<AiriaReadingEnvelope | null> {
  try {
    const response = await api.post(`/airia/decisions/${decisionId}/feedback`, {
      status: "corrected",
      surface,
      capacityCorrection: direction,
    });
    return isReading(response) ? response : null;
  } catch {
    return null;
  }
}
