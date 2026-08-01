import type { CheckinEntry } from "./types";

type Input = {
  localDate: string;
  checkinSlot: string;
  entry: Omit<CheckinEntry, "date">;
};

export function buildCheckinSubmission({ localDate, checkinSlot, entry }: Input) {
  const note = entry.note?.trim() || undefined;
  return {
    localDate,
    checkinSlot,
    moodScore: entry.humor,
    energyScore: entry.energia,
    ...(entry.fisico !== undefined ? { physicalScore: entry.fisico } : {}),
    ...(entry.social !== undefined ? { socialScore: entry.social } : {}),
    ...(entry.sono !== undefined ? { sleepScore: entry.sono } : {}),
    ...(entry.sleepHours !== undefined ? { sleepHours: entry.sleepHours } : {}),
    source: "screen" as const,
    idempotencyKey: `screen:${localDate}:${checkinSlot}`,
    signalMetadata: {
      mood: { provenance: "reported" as const, confidence: 1, evidence: ["screen:mood"] },
      energy: { provenance: "reported" as const, confidence: 1, evidence: ["screen:energy"] },
      ...(entry.fisico !== undefined
        ? { physical: { provenance: "reported" as const, confidence: 1, evidence: ["screen:physical"] } }
        : {}),
      ...(entry.social !== undefined
        ? { social: { provenance: "reported" as const, confidence: 1, evidence: ["screen:social"] } }
        : {}),
      ...(entry.sono !== undefined
        ? { sleepScore: { provenance: "reported" as const, confidence: 1, evidence: ["screen:sleep"] } }
        : {}),
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
