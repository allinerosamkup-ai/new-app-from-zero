import type { CheckinEntry } from "../features/aura/types";

export type ContextualCheckinDraft = {
  humor: number | null;
  energia: number | null;
  emotions?: string[];
  factors: string[];
  noFactorIdentified: boolean;
  sono?: number;
  sleepHours?: number;
  fisico?: number;
  social?: number;
  isFlowing?: boolean;
  flowDay?: number;
  flowIntensity?: "leve" | "moderado" | "intenso";
  symptomLevels?: { colica?: 1 | 2 | 3; dorCabeca?: 1 | 2 | 3 };
  medicationTakenToday?: boolean;
  focusScore?: number;
  hyperfocusOccurred?: boolean;
  mixedEpisodeNote?: string;
  dayType?: "up" | "down" | "mixed" | "stable";
  note?: string;
};

function compactStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

export function canSubmitContextualCheckin(
  input: Pick<ContextualCheckinDraft, "humor" | "energia" | "factors" | "noFactorIdentified">,
): boolean {
  const hasScores = input.humor !== null && input.energia !== null;
  const hasContextAnswer = compactStrings(input.factors).length > 0 || input.noFactorIdentified;
  return hasScores && hasContextAnswer;
}

export function buildContextualCheckinEntry(
  input: ContextualCheckinDraft,
): Omit<CheckinEntry, "date"> {
  if (input.humor === null || input.energia === null) {
    throw new Error("Humor e energia atuais são obrigatórios.");
  }

  const emotions = compactStrings(input.emotions);
  const factors = compactStrings(input.factors);
  const note = input.note?.trim();
  const mixedEpisodeNote = input.mixedEpisodeNote?.trim();

  return {
    humor: input.humor,
    energia: input.energia,
    ...(emotions.length > 0 ? { emotion: emotions[0], emotions } : {}),
    ...(factors.length > 0 ? { factors } : {}),
    ...(input.sono !== undefined ? { sono: input.sono } : {}),
    ...(input.sleepHours !== undefined ? { sleepHours: input.sleepHours } : {}),
    ...(input.fisico !== undefined ? { fisico: input.fisico } : {}),
    ...(input.social !== undefined ? { social: input.social } : {}),
    ...(input.isFlowing !== undefined ? { isFlowing: input.isFlowing } : {}),
    ...(input.flowDay !== undefined ? { flowDay: input.flowDay } : {}),
    ...(input.flowIntensity !== undefined ? { flowIntensity: input.flowIntensity } : {}),
    ...(input.symptomLevels && Object.keys(input.symptomLevels).length > 0
      ? { symptomLevels: input.symptomLevels }
      : {}),
    ...(input.medicationTakenToday !== undefined
      ? { medicationTakenToday: input.medicationTakenToday }
      : {}),
    ...(input.focusScore !== undefined ? { focusScore: input.focusScore } : {}),
    ...(input.hyperfocusOccurred !== undefined
      ? { hyperfocusOccurred: input.hyperfocusOccurred }
      : {}),
    ...(input.dayType !== undefined ? { dayType: input.dayType } : {}),
    ...(mixedEpisodeNote ? { mixedEpisodeNote } : {}),
    ...(note ? { note } : {}),
  };
}
