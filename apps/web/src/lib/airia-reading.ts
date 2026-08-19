import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { trackProductEvent } from "./track";

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

export type AiriaDecisionSurface = "journal" | "checkin_result";

type LocalizeCopy = (pt: string, en: string) => string;

/** Mantém os valores canônicos em português no backend, traduzindo só a apresentação. */
export function localizeAiriaPhase(phase: string | null | undefined, l: LocalizeCopy): string {
  const normalized = phase?.trim().toLocaleLowerCase("pt-BR");
  const translations: Record<string, string> = {
    "ritmo mais baixo": "lower pace",
    "bom fôlego hoje": "good momentum today",
    "ritmo possível": "a workable pace",
  };
  return normalized && translations[normalized] ? l(phase ?? "", translations[normalized]) : phase ?? "";
}

/** Explicação curta e fundamentada para a interface; não traduz notas nem fatos da pessoa. */
export function localizeAiriaCapacityReason(
  capacity: AiriaCapacity | null | undefined,
  energyScore: number | null | undefined,
  l: LocalizeCopy,
): string {
  if (!capacity) return "";
  if (capacity.level === "protecao" && /prioridade é apoio/i.test(capacity.reason)) {
    return l("Hoje a prioridade é apoio, não tarefa.", "Today, support—not a task—is the priority.");
  }
  if (!Number.isFinite(energyScore)) return capacity.reason;

  const energy = Math.round(Number(energyScore));
  const prefix = capacity.level === "protecao"
    ? l("Deixei hoje no menor tamanho possível", "I kept today's scope as small as possible")
    : capacity.level === "baixa"
    ? l("Reduzi o tamanho de hoje", "I reduced today's scope")
    : capacity.level === "alta"
      ? l("Hoje cabe um passo maior", "A bigger step can fit today")
      : l("Mantive um tamanho intermediário", "I kept a moderate scope");

  return `${prefix}: ${l(`sua energia está em ${energy} de 10`, `your energy is ${energy} out of 10`)}.`;
}

/** Localiza somente o conector estrutural de término, sem traduzir a ação da pessoa. */
export function localizeVisibleConcreteAction(text: string, l: LocalizeCopy): string {
  return text.replace(/\bPronto quando\s*:/gi, l("Pronto quando:", "Done when:"));
}

/**
 * Uma proposta é operacional, não uma frase solta para repetir em toda tela.
 * O Diário usa apenas a conversa e seus planos explícitos; o resultado de
 * Check-in pode oferecer uma ação de Objetivo quando há base suficiente para
 * explicar por que ela cabe agora.
 */
export function canShowContextualDecision(
  reading: AiriaReadingEnvelope | null | undefined,
  surface: AiriaDecisionSurface,
): boolean {
  if (surface === "journal") return false;

  const decision = reading?.decision;
  const riskRoute = reading?.riskSafety?.route;
  const observedDays = Number(reading?.period.observedDays ?? 0);
  const confidence = Number(reading?.period.confidence ?? 0);
  const capacityReason = reading?.capacity?.reason?.trim();

  return Boolean(
    decision
      && decision.status === "proposed"
      && decision.requiresConfirmation
      && decision.objectiveId
      && decision.actionId
      && capacityReason
      && observedDays >= 2
      && confidence >= 0.35
      && riskRoute !== "crisis_protocol"
      && riskRoute !== "human_support",
  );
}

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
  const presentedDecisionIds = useRef(new Set<string>());

  const reload = useCallback(async () => {
    setLoading(true);
    const next = await fetchAiriaReading(range);
    setReading(next);
    setAvailable(Boolean(next));
    setLoading(false);
    return next;
  }, [range?.from, range?.to]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const decision = reading?.decision;
    if (!decision || decision.status !== "proposed" || presentedDecisionIds.current.has(decision.id)) return;
    presentedDecisionIds.current.add(decision.id);
    const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
    const surface = pathname.startsWith("/insights") ? "patterns"
      : pathname.startsWith("/journal") ? "journal"
        : pathname.startsWith("/goals") ? "goals"
          : pathname.startsWith("/checkin-result") ? "checkin_result"
            : pathname.startsWith("/checkin") ? "checkin"
              : "home";
    const confidence = Number(reading?.period?.confidence ?? 0);
    trackProductEvent("decision.presented.v1", surface, {
      decisionId: decision.id,
      evidenceBand: confidence >= 0.7 ? "supported" : confidence >= 0.35 ? "limited" : "insufficient",
    });
  }, [reading]);
  return { reading, loading, available, reload };
}

function productSurfaceForDecision(surface: "home" | "insights" | "journal" | "goals" | "checkin_result" | "daily_summary" | "aura") {
  if (surface === "insights") return "patterns" as const;
  if (surface === "journal") return "journal" as const;
  if (surface === "goals") return "goals" as const;
  if (surface === "checkin_result" || surface === "daily_summary") return "checkin_result" as const;
  return "home" as const;
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
    trackProductEvent("decision.feedback_submitted.v1", productSurfaceForDecision(surface), {
      decisionId,
      feedback: status,
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
    trackProductEvent("decision.feedback_submitted.v1", productSurfaceForDecision(surface), {
      decisionId,
      feedback: "corrected",
    });
    return isReading(response) ? response : null;
  } catch {
    return null;
  }
}
