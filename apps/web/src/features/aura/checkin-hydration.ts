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

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function hydrateCheckinEntry(raw: Record<string, unknown>): CheckinEntry {
  const aiState = asRecord(raw.aiState);
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
    emotions: stringList(raw.emotions) ?? stringList(aiState?.emotions),
    clareza: score(raw.clarityScore),
    irritabilidade: score(raw.irritabilityScore),
    fisico: score(raw.physicalScore),
    social: score(raw.socialScore),
    sono: score(raw.sleepScore),
    sleepHours: typeof raw.sleepHours === "number" && Number.isFinite(raw.sleepHours) ? raw.sleepHours : undefined,
    factors: stringList(raw.factors),
    note: typeof raw.note === "string" ? raw.note : undefined,
    source: typeof raw.source === "string" ? raw.source : undefined,
    signalMetadata: asRecord(raw.signalMetadata) ?? undefined,
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
