import { DecisionEngine, type DecisionCandidate, type DecisionResult, type DecisionSurface } from './decision-engine.service';
import type { DailyContext } from './context-grounding.service';

export type AgendaDecisionType = 'keep' | 'move' | 'shrink' | 'pause' | 'suggest' | 'convert' | 'notify' | 'block';

export type AgendaAdaptationDecision = {
  id: string;
  type: AgendaDecisionType;
  title: string;
  kind: DecisionCandidate['kind'];
  source: DecisionCandidate['source'];
  targetId?: string | null;
  targetType: NonNullable<DecisionCandidate['targetType']>;
  from?: string | null;
  to?: string | null;
  suggestedStartTime?: string | null;
  suggestedEndTime?: string | null;
  suggestedDate?: string | null;
  reason: string;
  bioReason: string;
  impactLabel: NonNullable<DecisionCandidate['impactLabel']>;
  score: number;
  confidence: number;
  requiresConfirmation: boolean;
  notificationAllowed: boolean;
};

export type AdaptiveAgendaPlan = {
  date: string;
  trigger: string;
  surface: DecisionSurface;
  summary: string;
  decisions: AgendaAdaptationDecision[];
  blocked: AgendaAdaptationDecision[];
  decisionBrain: DecisionResult;
  applied: false;
};

function toAgendaDecision(candidate: DecisionCandidate): AgendaAdaptationDecision {
  const type: AgendaDecisionType = candidate.action === 'insight' ? 'block' : candidate.action;
  return {
    id: candidate.id,
    type,
    title: candidate.title,
    kind: candidate.kind,
    source: candidate.source,
    targetId: candidate.targetId ?? null,
    targetType: candidate.targetType ?? 'system',
    from: candidate.from ?? null,
    to: candidate.to ?? null,
    suggestedStartTime: candidate.suggestedStartTime ?? null,
    suggestedEndTime: candidate.suggestedEndTime ?? null,
    suggestedDate: candidate.suggestedDate ?? null,
    reason: candidate.reason,
    bioReason: candidate.bioReason ?? candidate.reason,
    impactLabel: candidate.impactLabel ?? 'mantém ritmo',
    score: candidate.score,
    confidence: candidate.confidence,
    requiresConfirmation: candidate.requiresConfirmation,
    notificationAllowed: candidate.notificationAllowed,
  };
}

export class AdaptiveAgendaEngine {
  static plan(input: {
    dailyContext: DailyContext;
    trigger?: string;
    surface?: DecisionSurface;
    requestContext?: Record<string, unknown>;
  }): AdaptiveAgendaPlan {
    const surface = input.surface ?? 'agenda';
    const decisionBrain = DecisionEngine.evaluate({
      dailyContext: input.dailyContext,
      surface,
      requestContext: input.requestContext,
    });

    const decisions = decisionBrain.allowedActions
      .filter((candidate) => candidate.kind !== 'insight_only')
      .map(toAgendaDecision);
    const blocked = decisionBrain.blockedActions.map(toAgendaDecision);

    const optionalCount = decisions.filter((decision) => decision.kind === 'suggested_commitment').length;
    const realCount = decisions.filter((decision) => decision.kind === 'real_commitment').length;
    const summary = decisions.length > 0
      ? optionalCount > 0 && realCount === 0
        ? `Agenda adaptativa encontrou ${optionalCount} sugestão opcional, sem salvar nem notificar automaticamente.`
        : `Agenda adaptativa encontrou ${decisions.length} decisão(ões) possíveis, sem aplicar nada automaticamente.`
      : 'Agenda adaptativa não encontrou ajuste confiável; melhor não inventar compromisso.';

    return {
      date: input.dailyContext.date,
      trigger: input.trigger ?? 'manual',
      surface,
      summary,
      decisions,
      blocked,
      decisionBrain,
      applied: false,
    };
  }
}
