import type { AdaptationPermission, TemporalPolicy } from './planner.service';

export type AdaptabilityInferenceSource =
  | 'manual_override'
  | 'google_calendar'
  | 'recurring_schedule'
  | 'commitment_pattern'
  | 'ai_suggestion'
  | 'postponed_task'
  | 'ambiguous_commitment';

export type TimelineAdaptabilityInference = {
  temporalPolicy: TemporalPolicy;
  adaptationPermission: AdaptationPermission;
  inferenceSource: AdaptabilityInferenceSource;
  inferenceConfidence: number;
};

const FIXED_COMMITMENT_PATTERN = /\b(reuni[aã]o|consulta|m[eé]dic[oa]|dentista|terapia|entrevista|aula|curso|plant[aã]o|turno|expediente|trabalho|atendimento|voo|viagem|appointment|meeting|class|shift|office|work)\b/i;

/**
 * Classifies an existing real commitment. It never creates work from journal,
 * conversation or memory; those inputs are intentionally absent.
 */
export function inferTimelineAdaptability(input: {
  title: string;
  gcalEventId?: string | null;
  recurring?: unknown;
  isAiSuggested?: boolean | null;
  status?: string | null;
  temporalPolicy?: TemporalPolicy | null;
  adaptationPermission?: AdaptationPermission | null;
  manualOverride?: boolean;
  adaptabilitySource?: string | null;
  adaptabilityConfidence?: number | null;
  wasPostponed?: boolean;
}): TimelineAdaptabilityInference {
  if (input.gcalEventId) {
    return {
      temporalPolicy: 'fixed',
      adaptationPermission: 'protected',
      inferenceSource: 'google_calendar',
      inferenceConfidence: 1,
    };
  }

  if ((input.manualOverride || input.adaptabilitySource === 'manual') && input.temporalPolicy && input.adaptationPermission) {
    return {
      temporalPolicy: input.temporalPolicy,
      adaptationPermission: input.temporalPolicy === 'fixed' ? 'protected' : input.adaptationPermission,
      inferenceSource: 'manual_override',
      inferenceConfidence: 1,
    };
  }

  if (input.wasPostponed) {
    return {
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
      inferenceSource: 'postponed_task',
      inferenceConfidence: 0.84,
    };
  }

  const recurring = input.recurring && typeof input.recurring === 'object'
    ? input.recurring as { enabled?: unknown }
    : null;
  if (recurring?.enabled === true) {
    return {
      temporalPolicy: 'windowed',
      adaptationPermission: 'preview',
      inferenceSource: 'recurring_schedule',
      inferenceConfidence: 0.7,
    };
  }

  if (FIXED_COMMITMENT_PATTERN.test(input.title)) {
    return {
      temporalPolicy: 'windowed',
      adaptationPermission: 'preview',
      inferenceSource: 'commitment_pattern',
      inferenceConfidence: 0.68,
    };
  }

  if (input.isAiSuggested) {
    return {
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
      inferenceSource: 'ai_suggestion',
      inferenceConfidence: 0.9,
    };
  }

  if (input.status === 'postponed') {
    return {
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
      inferenceSource: 'postponed_task',
      inferenceConfidence: 0.84,
    };
  }

  return {
    temporalPolicy: 'windowed',
    adaptationPermission: 'preview',
    inferenceSource: 'ambiguous_commitment',
    inferenceConfidence: 0.55,
  };
}
