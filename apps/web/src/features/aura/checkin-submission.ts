import type { CheckinEntry } from "./types";

type Input = {
  localDate: string;
  checkinSlot: string;
  entry: Omit<CheckinEntry, "date">;
};

/**
 * Todo contexto explícito que chegar de uma superfície precisa chegar ao banco
 * — sem exceção silenciosa. A tela principal não pede capacidade nem prioridade:
 * quando esses campos existem, vieram de uma instrução explícita ou de uma
 * superfície compatível e devem ser preservados.
 *
 * Clareza e irritabilidade tinham coluna, contrato e leitor (o motor consome
 * `irritabilidade` na agregação diária) e nenhuma pergunta. Capacidade e
 * objetivo prioritário continuam opcionais no contrato para preservar contexto
 * explícito vindo de outras superfícies, mas não podem voltar a ser uma etapa
 * obrigatória de decisão no check-in principal.
 */
export function buildCheckinSubmission({ localDate, checkinSlot, entry }: Input) {
  const note = entry.note?.trim() || undefined;
  const dayPlan = {
    ...(entry.capacity !== undefined ? { capacity: entry.capacity } : {}),
    ...(entry.priorityGoalId !== undefined ? { priorityGoalId: entry.priorityGoalId } : {}),
  };
  return {
    localDate,
    checkinSlot,
    moodScore: entry.humor,
    energyScore: entry.energia,
    ...(entry.clareza !== undefined ? { clarityScore: entry.clareza } : {}),
    ...(entry.irritabilidade !== undefined ? { irritabilityScore: entry.irritabilidade } : {}),
    ...(entry.fisico !== undefined ? { physicalScore: entry.fisico } : {}),
    ...(entry.social !== undefined ? { socialScore: entry.social } : {}),
    ...(entry.sono !== undefined ? { sleepScore: entry.sono } : {}),
    ...(entry.sleepHours !== undefined ? { sleepHours: entry.sleepHours } : {}),
    source: "screen" as const,
    idempotencyKey: `screen:${localDate}:${checkinSlot}`,
    signalMetadata: {
      mood: { provenance: "reported" as const, confidence: 1, evidence: ["screen:mood"] },
      energy: { provenance: "reported" as const, confidence: 1, evidence: ["screen:energy"] },
      ...(entry.clareza !== undefined
        ? { clarity: { provenance: "reported" as const, confidence: 1, evidence: ["screen:clarity"] } }
        : {}),
      ...(entry.irritabilidade !== undefined
        ? { irritability: { provenance: "reported" as const, confidence: 1, evidence: ["screen:irritability"] } }
        : {}),
      ...(entry.fisico !== undefined
        ? { physical: { provenance: "reported" as const, confidence: 1, evidence: ["screen:physical"] } }
        : {}),
      ...(entry.social !== undefined
        ? { social: { provenance: "reported" as const, confidence: 1, evidence: ["screen:social"] } }
        : {}),
      ...(entry.sono !== undefined
        ? { sleepScore: { provenance: "reported" as const, confidence: 1, evidence: ["screen:sleep"] } }
        : {}),
      ...(Object.keys(dayPlan).length > 0 ? { dayPlan } : {}),
    },
    ...(note ? { note } : {}),
    factors: entry.factors,
    emotions: entry.emotions,
    isFlowing: entry.isFlowing,
    flowDay: entry.flowDay,
    flowIntensity: entry.flowIntensity,
    symptomLevels: entry.symptomLevels,
    medicationTakenToday: entry.medicationTakenToday,
    focusScore: entry.focusScore,
    hyperfocusOccurred: entry.hyperfocusOccurred,
    mixedEpisodeNote: entry.mixedEpisodeNote,
    dayType: entry.dayType,
  };
}

export type CheckinSubmission = ReturnType<typeof buildCheckinSubmission>;
