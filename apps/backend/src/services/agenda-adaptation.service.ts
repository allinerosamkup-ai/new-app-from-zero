import { AdaptiveAgendaEngine, type AdaptiveAgendaPlan } from './adaptive-agenda-engine.service';
import type { DailyContext } from './context-grounding.service';

export type AgendaAdaptationTrigger = 'manual' | 'checkin' | 'cron' | 'home' | 'planner';
export type AgendaAdaptationMode = 'preview' | 'apply';

export type AgendaAdaptationChange = {
  type: 'keep' | 'move' | 'shrink' | 'pause' | 'suggest' | 'convert' | 'notify' | 'block' | 'skip';
  title: string;
  targetId?: string | null;
  from?: string | null;
  to?: string | null;
  reason: string;
  confidence: number;
  score?: number;
  kind?: string;
  source?: string;
  requiresConfirmation?: boolean;
  notificationAllowed?: boolean;
};

export type AgendaAdaptationResult = {
  date: string;
  mode: AgendaAdaptationMode;
  trigger: AgendaAdaptationTrigger;
  summary: string;
  changes: AgendaAdaptationChange[];
  blockedSuggestions: string[];
  blockedDecisions: AgendaAdaptationChange[];
  adaptiveAgenda: AdaptiveAgendaPlan;
  applied: boolean;
};

export class AgendaAdaptationService {
  static buildPreview(input: {
    dailyContext: DailyContext;
    requestContext?: Record<string, unknown>;
    mode?: AgendaAdaptationMode;
    trigger?: AgendaAdaptationTrigger;
  }): AgendaAdaptationResult {
    const adaptiveAgenda = AdaptiveAgendaEngine.plan({
      dailyContext: input.dailyContext,
      requestContext: input.requestContext,
      trigger: input.trigger,
      surface: 'agenda',
    });
    const changes: AgendaAdaptationChange[] = adaptiveAgenda.decisions.map((decision) => ({
      type: decision.type,
      title: decision.title,
      from: decision.from,
      to: decision.to,
      reason: decision.reason,
      confidence: decision.confidence,
      score: decision.score,
      kind: decision.kind,
      source: decision.source,
      requiresConfirmation: decision.requiresConfirmation,
      notificationAllowed: decision.notificationAllowed,
    }));
    const blockedDecisions: AgendaAdaptationChange[] = adaptiveAgenda.blocked.map((decision) => ({
      type: decision.type,
      title: decision.title,
      from: decision.from,
      to: decision.to,
      reason: decision.reason,
      confidence: decision.confidence,
      score: decision.score,
      kind: decision.kind,
      source: decision.source,
      requiresConfirmation: decision.requiresConfirmation,
      notificationAllowed: decision.notificationAllowed,
    }));

    return {
      date: input.dailyContext.date,
      mode: input.mode ?? 'preview',
      trigger: input.trigger ?? 'manual',
      summary: adaptiveAgenda.summary,
      changes,
      blockedSuggestions: blockedDecisions.map((decision) => decision.title),
      blockedDecisions,
      adaptiveAgenda,
      applied: false,
    };
  }
}
