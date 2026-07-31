import {
  CheckinDraftSchema,
  type CheckinDraft,
  type CheckinSignal,
  type CheckinSource,
} from '../contracts/checkin-draft.contract';

type CandidatePayload = Record<string, unknown>;

type UnderstandInput = {
  message: string;
  localDate: string;
  occurredAt?: string;
  source?: CheckinSource;
  sourceMessageId?: string | null;
  idempotencyKey?: string | null;
  candidate?: CandidatePayload | null;
};

type LexicalSignal = {
  pattern: RegExp;
  value: number;
  confidence: number;
  emotion?: string;
};

const MOOD_SIGNALS: LexicalSignal[] = [
  { pattern: /\bradiante\b/, value: 9, confidence: 0.95, emotion: 'radiant' },
  { pattern: /\b(?:muito feliz|feliz|contente)\b/, value: 8, confidence: 0.92, emotion: 'happy' },
  { pattern: /\b(?:calm[oa]|tranquil[oa]|estou bem|to bem)\b/, value: 7, confidence: 0.85, emotion: 'calm' },
  { pattern: /\b(?:chatead[oa]|abatid[oa])\b/, value: 3, confidence: 0.92, emotion: 'sad' },
  { pattern: /\b(?:trist[ea]|deprimid[oa])\b/, value: 2, confidence: 0.95, emotion: 'sad' },
  { pattern: /\b(?:pessim[oa]|horrivel|no chao|um lixo)\b/, value: 2, confidence: 0.94, emotion: 'sad' },
  { pattern: /\b(?:ansios[oa]|angustiad[oa])\b/, value: 4, confidence: 0.82, emotion: 'anxious' },
  { pattern: /\b(?:irritad[oa]|com raiva)\b/, value: 4, confidence: 0.88, emotion: 'angry' },
  { pattern: /\b(?:estressad[oa]|sobrecarregad[oa])\b/, value: 4, confidence: 0.82, emotion: 'stressed' },
];

const ENERGY_SIGNALS: LexicalSignal[] = [
  { pattern: /\b(?:sem energia(?: nenhuma)?|energia zerada|nao tenho energia|sem forcas?)\b/, value: 1, confidence: 0.98, emotion: 'tired' },
  { pattern: /\b(?:exaust[oa]|esgotad[oa]|acabad[oa])\b/, value: 1, confidence: 0.96, emotion: 'exhausted' },
  { pattern: /\b(?:cansad[oa]|fatigad[oa])\b/, value: 3, confidence: 0.95, emotion: 'tired' },
  { pattern: /\b(?:chei[oa] de energia|energia maxima|muita energia)\b/, value: 9, confidence: 0.95, emotion: 'agitated' },
  { pattern: /\b(?:dispost[oa]|animad[oa]|energizad[oa])\b/, value: 8, confidence: 0.9, emotion: 'happy' },
  { pattern: /\b(?:acelerad[oa]|agitad[oa])\b/, value: 8, confidence: 0.82, emotion: 'agitated' },
];

const CANONICAL_EMOTIONS = new Set([
  'radiant', 'calm', 'happy', 'anxious', 'tired', 'focused',
  'sad', 'angry', 'stressed', 'sensitive', 'exhausted', 'agitated',
]);

const CANONICAL_FACTORS = new Set([
  'slept_well', 'slept_little', 'woke_up_night', 'exercise', 'no_exercise',
  'healthy_meal', 'skipped_meals', 'took_meds', 'forgot_meds', 'fresh_air',
  'good_talk', 'kind_words', 'support', 'social_drain', 'loneliness',
  'relationship_conflict', 'focused_session', 'hyperfocus_stuck', 'small_win',
  'finished_task', 'feeling_valued', 'work_pressure', 'plan_changed',
  'hard_decision', 'dissociated', 'low_dopamine', 'stuck', 'overwhelmed',
  'self_trust', 'rest', 'fiz_algo_gosto', 'financial_stress', 'bad_news',
  'pms_symptoms', 'heavy_period',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function absentSignal(): CheckinSignal {
  return { value: null, provenance: 'absent', confidence: 0, evidence: [] };
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10
    ? Math.round(value)
    : null;
}

function extractExplicitScore(text: string, labels: string[]): { value: number; evidence: string } | null {
  const labelPattern = labels.join('|');
  const after = new RegExp(`\\b(?:${labelPattern})\\b.{0,18}?\\b(10|[1-9])\\b`).exec(text);
  if (after) return { value: Number(after[1]), evidence: after[0] };
  const before = new RegExp(`\\b(10|[1-9])\\b.{0,12}?\\b(?:${labelPattern})\\b`).exec(text);
  return before ? { value: Number(before[1]), evidence: before[0] } : null;
}

function lexicalSignal(text: string, definitions: LexicalSignal[]): { signal: CheckinSignal; emotion?: string } | null {
  for (const definition of definitions) {
    const match = definition.pattern.exec(text);
    if (!match) continue;
    return {
      signal: {
        value: definition.value,
        provenance: 'inferred',
        confidence: definition.confidence,
        evidence: [match[0]],
      },
      emotion: definition.emotion,
    };
  }
  return null;
}

function candidateNumber(candidate: CandidatePayload, keys: string[]): number | null {
  for (const key of keys) {
    const value = numeric(candidate[key]);
    if (value !== null) return value;
  }
  return null;
}

function candidateStrings(candidate: CandidatePayload, key: string, allowed: Set<string>, max: number): string[] {
  if (!Array.isArray(candidate[key])) return [];
  return candidate[key]
    .filter((item): item is string => typeof item === 'string' && allowed.has(item))
    .slice(0, max);
}

function refused(text: string): boolean {
  return /\b(?:so|apenas) (?:estou )?(?:desabafando|falando)\b/.test(text)
    || /\bnao (?:registre|registra|salve|salva|anote|anota|faca|faz|quero).{0,30}\b(?:check-?in|isso|nada)\b/.test(text)
    || /\b(?:nao quero|nao precisa) (?:que )?(?:voce )?(?:registre|salve|anote)\b/.test(text);
}

function isGeneralizedPattern(text: string): boolean {
  return /\b(?:percebi|notei|reparei) que\b.{0,100}\b(?:quando|sempre|costumo|fico)\b/.test(text)
    && !/\b(?:hoje|agora|neste momento|estou|to|tou|me sinto|sinto-me)\b/.test(text);
}

export class CheckinUnderstandingService {
  static understand(input: UnderstandInput): CheckinDraft {
    const message = input.message.trim().slice(0, 30_000);
    const text = normalize(message);
    const candidate = input.candidate ?? {};
    const captureBlocked = refused(text) || isGeneralizedPattern(text);

    let mood = absentSignal();
    let energy = absentSignal();
    let clarity = absentSignal();
    let irritability = absentSignal();
    let physical = absentSignal();
    let social = absentSignal();
    let sleepScore = absentSignal();
    const emotions: string[] = [];

    if (!captureBlocked) {
      const explicitMood = extractExplicitScore(text, ['humor', 'mood']);
      const explicitEnergy = extractExplicitScore(text, ['energia', 'energy']);
      const moodLexical = lexicalSignal(text, MOOD_SIGNALS);
      const energyLexical = lexicalSignal(text, ENERGY_SIGNALS);
      const candidateMood = candidateNumber(candidate, ['moodScore', 'humor']);
      const candidateEnergy = candidateNumber(candidate, ['energyScore', 'energia']);
      const optionalSignals = [
        { labels: ['clareza', 'foco', 'clarity', 'focus'], keys: ['clarityScore', 'focusScore'], assign: (signal: CheckinSignal) => { clarity = signal; } },
        { labels: ['irritabilidade', 'irritacao', 'irritability'], keys: ['irritabilityScore'], assign: (signal: CheckinSignal) => { irritability = signal; } },
        { labels: ['fisico', 'corpo', 'physical'], keys: ['physicalScore'], assign: (signal: CheckinSignal) => { physical = signal; } },
        { labels: ['social'], keys: ['socialScore'], assign: (signal: CheckinSignal) => { social = signal; } },
        { labels: ['sono', 'sleep'], keys: ['sleepScore'], assign: (signal: CheckinSignal) => { sleepScore = signal; } },
      ];

      if (explicitMood) {
        mood = { value: explicitMood.value, provenance: 'reported', confidence: 1, evidence: [explicitMood.evidence] };
      } else if (moodLexical) {
        mood = moodLexical.signal;
      } else if (candidateMood !== null) {
        mood = { value: candidateMood, provenance: 'inferred', confidence: 0.7, evidence: ['model_candidate'] };
      }

      if (explicitEnergy) {
        energy = { value: explicitEnergy.value, provenance: 'reported', confidence: 1, evidence: [explicitEnergy.evidence] };
      } else if (energyLexical) {
        energy = energyLexical.signal;
      } else if (candidateEnergy !== null) {
        energy = { value: candidateEnergy, provenance: 'inferred', confidence: 0.7, evidence: ['model_candidate'] };
      }

      for (const definition of optionalSignals) {
        const explicit = extractExplicitScore(text, definition.labels);
        const candidateValue = candidateNumber(candidate, definition.keys);
        if (explicit) {
          definition.assign({ value: explicit.value, provenance: 'reported', confidence: 1, evidence: [explicit.evidence] });
        } else if (candidateValue !== null) {
          definition.assign({ value: candidateValue, provenance: 'inferred', confidence: 0.7, evidence: ['model_candidate'] });
        }
      }

      for (const emotion of [moodLexical?.emotion, energyLexical?.emotion, ...candidateStrings(candidate, 'emotions', CANONICAL_EMOTIONS, 3)]) {
        if (emotion && !emotions.includes(emotion)) emotions.push(emotion);
      }
    }

    const status = captureBlocked
      ? 'unsupported'
      : mood.value !== null && energy.value !== null
        ? 'ready'
        : mood.value !== null || energy.value !== null || /\bcheck-?in\b/.test(text)
          ? 'needs_clarification'
          : 'unsupported';

    return CheckinDraftSchema.parse({
      status,
      localDate: input.localDate,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      source: input.source ?? 'aura_text',
      sourceMessageId: input.sourceMessageId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      rawText: message || null,
      note: message || null,
      emotions: emotions.slice(0, 3),
      factors: candidateStrings(candidate, 'factors', CANONICAL_FACTORS, 12),
      mood,
      energy,
      clarity,
      irritability,
      physical,
      social,
      sleepScore,
      sleepHours: typeof candidate.sleepHours === 'number' && candidate.sleepHours >= 0 && candidate.sleepHours <= 24
        ? candidate.sleepHours
        : null,
    });
  }
}
