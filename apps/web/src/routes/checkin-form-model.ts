import type { CheckinEntry } from "../features/aura/types";

export const CHECKIN_EMOTION_IDS = [
  "radiant", "calm", "happy", "anxious", "tired", "focused", "sad", "angry",
  "stressed", "sensitive", "exhausted", "agitated",
] as const;

export const CHECKIN_FACTOR_IDS = [
  "slept_well", "slept_little", "woke_up_night", "exercise", "no_exercise", "healthy_meal",
  "skipped_meals", "took_meds", "forgot_meds", "fresh_air", "good_talk", "kind_words", "support",
  "social_drain", "loneliness", "relationship_conflict", "focused_session", "hyperfocus_stuck",
  "small_win", "finished_task", "feeling_valued", "work_pressure", "plan_changed", "hard_decision",
  "dissociated", "low_dopamine", "stuck", "overwhelmed", "self_trust", "rest", "fiz_algo_gosto",
  "financial_stress", "bad_news", "pms_symptoms", "heavy_period",
] as const;

export type ParsedVoiceCheckin = {
  humor: number | null;
  energia: number | null;
  sleepHours: number | null;
  emotions: string[];
  factors: string[];
  note: string | null;
};

export type ContextualCheckinDraft = {
  humor: number | null;
  energia: number | null;
  emotions?: string[];
  factors: string[];
  noFactorIdentified: boolean;
  sono?: number;
  sleepHours?: number;
  clareza?: number;
  irritabilidade?: number;
  fisico?: number;
  social?: number;
  capacity?: "quick" | "moderate" | "heavy";
  priorityGoalId?: string;
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

/**
 * O fundo da tela responde enquanto ela responde.
 *
 * O check-in tem 36 fatores, 12 emoções e nove escalas, e hoje tudo tem o mesmo
 * peso cinza — é isso que faz a tela parecer formulário e não conversa. Apps que
 * sustentam o hábito diário devolvem algo imediato a cada toque; aqui o retorno
 * é o ambiente mudando com humor e energia, sem custar um toque a mais.
 *
 * Duas regras de identidade limitam o resultado, e por isso ele é função pura
 * com teste: o acento é **verde** (rosa saiu do app por leitura "muito
 * feminino") e humor baixo **não** vira cor de alarme. Estado difícil recebe um
 * azul-esverdeado frio e calmo — a tela acolhe, não diagnostica.
 */
export function checkinAmbience(humor: number | null, energia: number | null): string {
  const white = "#FFFFFF";
  if (humor === null && energia === null) return white;

  const mood = (humor ?? energia ?? 5) / 10;
  const energy = (energia ?? humor ?? 5) / 10;

  // Humor baixo puxa para o azul sereno (--accent-sky), alto para o verde da
  // identidade (--accent-primary). Nenhum dos extremos é quente.
  const cool = { r: 190, g: 230, b: 243 };
  const warm = { r: 191, g: 220, b: 203 };
  const mix = (a: number, b: number) => Math.round(a + (b - a) * mood);
  const tint = { r: mix(cool.r, warm.r), g: mix(cool.g, warm.g), b: mix(cool.b, warm.b) };

  // Energia move só a presença da cor. Teto baixo de propósito: o fundo comenta
  // o estado, não compete com o conteúdo.
  const alpha = (0.16 + energy * 0.26).toFixed(3);
  const halo = (0.06 + energy * 0.12).toFixed(3);

  return [
    `radial-gradient(120% 62% at 50% 0%, rgba(${tint.r},${tint.g},${tint.b},${alpha}) 0%, rgba(${tint.r},${tint.g},${tint.b},${halo}) 45%, rgba(255,255,255,0) 78%)`,
    white,
  ].join(", ");
}

function compactStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScore(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : null;
}

function filterCanonicalIds(
  value: unknown,
  canonical: readonly string[],
  limit?: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(canonical);
  const values = Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => allowed.has(item)),
  ));
  return limit === undefined ? values : values.slice(0, limit);
}

export function parseVoiceCheckinResponse(value: unknown): ParsedVoiceCheckin {
  if (!isRecord(value)) {
    return { humor: null, energia: null, sleepHours: null, emotions: [], factors: [], note: null };
  }

  const sleepHours = typeof value.sleepHours === "number"
    && Number.isFinite(value.sleepHours)
    && value.sleepHours >= 0
    && value.sleepHours <= 24
    ? value.sleepHours
    : null;
  const note = typeof value.note === "string" && value.note.trim() ? value.note.trim() : null;

  return {
    humor: parseScore(value.humor),
    energia: parseScore(value.energia),
    sleepHours,
    emotions: filterCanonicalIds(value.emotions, CHECKIN_EMOTION_IDS, 3),
    factors: filterCanonicalIds(value.factors, CHECKIN_FACTOR_IDS),
    note,
  };
}

export async function finalizeContextualCheckin<T>({
  persist,
  onConfirmed,
}: {
  persist: () => Promise<T | null>;
  onConfirmed: (receipt: T) => void | Promise<void>;
}): Promise<T> {
  const receipt = await persist();
  if (!receipt) throw new Error("Não foi possível salvar o check-in.");
  await onConfirmed(receipt);
  return receipt;
}

export function canSubmitContextualCheckin(
  input: Pick<ContextualCheckinDraft, "humor" | "energia" | "factors" | "noFactorIdentified">,
): boolean {
  return missingCheckinAnswers(input).length === 0;
}

export type MissingCheckinAnswer = "humor" | "energia" | "fator";

/**
 * O que ainda falta para o check-in poder ser registrado.
 *
 * Existe porque um botão desabilitado sem explicação é indistinguível de um
 * botão quebrado — e foi assim que um check-in inteiro se perdeu em produção:
 * humor e energia não tinham sido capturados, o botão ficou morto, nada na tela
 * disse o motivo, e a leitura de quem usa foi "fiz o check-in e não saiu o
 * resultado". O log confirma: nenhum `POST /checkins` chegou ao servidor.
 *
 * A ordem segue a da tela, para o texto apontar de cima para baixo.
 */
export function missingCheckinAnswers(
  input: Pick<ContextualCheckinDraft, "humor" | "energia" | "factors" | "noFactorIdentified">,
): MissingCheckinAnswer[] {
  const missing: MissingCheckinAnswer[] = [];
  if (input.humor === null) missing.push("humor");
  if (input.energia === null) missing.push("energia");
  if (compactStrings(input.factors).length === 0 && !input.noFactorIdentified) missing.push("fator");
  return missing;
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
    ...(input.clareza !== undefined ? { clareza: input.clareza } : {}),
    ...(input.irritabilidade !== undefined ? { irritabilidade: input.irritabilidade } : {}),
    ...(input.fisico !== undefined ? { fisico: input.fisico } : {}),
    ...(input.social !== undefined ? { social: input.social } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.priorityGoalId !== undefined ? { priorityGoalId: input.priorityGoalId } : {}),
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
