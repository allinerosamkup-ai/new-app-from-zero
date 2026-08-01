import type { CheckinEntry } from "./types";

function dateKey(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function score(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10
    ? value
    : undefined;
}

function symptom(value: unknown): 1 | 2 | 3 | undefined {
  return value === 1 || value === 2 || value === 3 ? value : undefined;
}

export function hydrateCheckinEntry(raw: Record<string, any>): CheckinEntry {
  const colica = symptom(raw.symptomColica);
  const dorCabeca = symptom(raw.symptomDorCabeca);
  const symptomLevels = colica || dorCabeca ? { ...(colica ? { colica } : {}), ...(dorCabeca ? { dorCabeca } : {}) } : undefined;

  return {
    date: dateKey(raw.localDate ?? raw.recordedAt ?? raw.date),
    recordedAt: typeof raw.recordedAt === "string" ? raw.recordedAt : undefined,
    checkinSlot: typeof raw.checkinSlot === "string" ? raw.checkinSlot : undefined,
    humor: score(raw.moodScore) ?? 5,
    energia: score(raw.energyScore) ?? 5,
    emotion: typeof raw.stateLabelType === "string" ? raw.stateLabelType : "calm",
    stateLabel: typeof raw.stateLabel === "string" ? raw.stateLabel : null,
    stateLabelType: typeof raw.stateLabelType === "string" ? raw.stateLabelType : null,
    emotions: Array.isArray(raw.emotions)
      ? raw.emotions.filter((value: unknown): value is string => typeof value === "string")
      : (Array.isArray(raw.aiState?.emotions) ? raw.aiState.emotions : undefined),
    clareza: score(raw.clarityScore),
    irritabilidade: score(raw.irritabilityScore),
    fisico: score(raw.physicalScore),
    social: score(raw.socialScore),
    sono: score(raw.sleepScore),
    sleepHours: typeof raw.sleepHours === "number" && Number.isFinite(raw.sleepHours) ? raw.sleepHours : undefined,
    factors: Array.isArray(raw.factors)
      ? raw.factors.filter((value: unknown): value is string => typeof value === "string")
      : undefined,
    note: typeof raw.note === "string" ? raw.note : undefined,
    source: typeof raw.source === "string" ? raw.source : undefined,
    signalMetadata: raw.signalMetadata && typeof raw.signalMetadata === "object" ? raw.signalMetadata : undefined,
    isFlowing: typeof raw.isFlowing === "boolean" ? raw.isFlowing : undefined,
    flowDay: typeof raw.flowDay === "number" ? raw.flowDay : undefined,
    flowIntensity: raw.flowIntensity === "leve" || raw.flowIntensity === "moderado" || raw.flowIntensity === "intenso"
      ? raw.flowIntensity
      : undefined,
    symptomLevels,
    medicationTakenToday: typeof raw.medicationTakenToday === "boolean" ? raw.medicationTakenToday : null,
    focusScore: score(raw.focusScore) ?? null,
    hyperfocusOccurred: typeof raw.hyperfocusOccurred === "boolean" ? raw.hyperfocusOccurred : null,
    mixedEpisodeNote: typeof raw.mixedEpisodeNote === "string" ? raw.mixedEpisodeNote : null,
    dayType: raw.dayType === "up" || raw.dayType === "down" || raw.dayType === "mixed" || raw.dayType === "stable"
      ? raw.dayType
      : null,
  };
}
