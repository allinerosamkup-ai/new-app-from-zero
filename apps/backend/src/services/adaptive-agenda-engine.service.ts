import { DecisionEngine, type DecisionCandidate, type DecisionResult, type DecisionSurface } from './decision-engine.service';
import type { DailyContext } from './context-grounding.service';
import type { AgendaStylePattern } from './agenda-pattern-recognition.service';

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

export type DayStructureMode = 'open' | 'mixed' | 'structured';
export type DayInitiativeLevel = 'lead' | 'collaborate' | 'protect';

export type ProtectedDayAnchor = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  source: 'google_calendar' | 'planner';
};

export type DayStructureProfile = {
  mode: DayStructureMode;
  freedomScore: number;
  initiativeLevel: DayInitiativeLevel;
  scheduledMinutes: number;
  protectedMinutes: number;
  flexibleMinutes: number;
  freeMinutes: number;
  protectedAnchors: ProtectedDayAnchor[];
  observedFreedomScore?: number;
  patternConfidence?: number;
};

export type AdaptiveAgendaPlan = {
  date: string;
  trigger: string;
  surface: DecisionSurface;
  summary: string;
  dayStructure: DayStructureProfile;
  decisions: AgendaAdaptationDecision[];
  blocked: AgendaAdaptationDecision[];
  decisionBrain: DecisionResult;
  applied: boolean;
};

const PLANNING_START_MINUTE = 8 * 60;
const PLANNING_END_MINUTE = 20 * 60;
const PLANNING_CAPACITY_MINUTES = PLANNING_END_MINUTE - PLANNING_START_MINUTE;

function toDayMinute(date: Date, dateKey: string): number {
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  return Math.round((date.getTime() - dayStart) / 60_000);
}

function formatMinute(minute: number): string {
  const dayOffset = Math.floor(minute / (24 * 60));
  const localMinute = ((minute % (24 * 60)) + (24 * 60)) % (24 * 60);
  const time = `${String(Math.floor(localMinute / 60)).padStart(2, '0')}:${String(localMinute % 60).padStart(2, '0')}`;
  if (dayOffset > 0) return `${time} (+${dayOffset})`;
  if (dayOffset < 0) return `${time} (${dayOffset})`;
  return time;
}

function isProtectedTask(task: DailyContext['tasks'][number]): boolean {
  return Boolean(task.gcalEventId)
    || task.temporalPolicy === 'fixed'
    || task.adaptationPermission === 'protected';
}

/**
 * Pure day-shape reading. It only classifies real timeline blocks already in
 * DailyContext; it never creates a commitment or turns memory into a task.
 */
export function buildDayStructureProfile(dailyContext: DailyContext): DayStructureProfile {
  const intervals = dailyContext.tasks.flatMap((task) => {
    if (task.status === 'completed' || !task.startAt || !task.endAt) return [];
    const rawStart = toDayMinute(task.startAt, dailyContext.date);
    let rawEnd = toDayMinute(task.endAt, dailyContext.date);
    while (rawEnd <= rawStart) rawEnd += 24 * 60;
    const duration = Math.min(24 * 60, rawEnd - rawStart);
    const normalizedStart = ((rawStart % (24 * 60)) + (24 * 60)) % (24 * 60);
    return [{ task, normalizedStart, duration }];
  });
  // A fixed 12-hour capacity keeps equal-duration day and night shifts equally rigid.
  // Occupancy itself is read on a circular 24-hour clock, so cross-midnight blocks
  // are split and overlaps are deduplicated before clamping to that capacity.
  const occupancy = new Uint8Array(24 * 60);
  const protectedAnchors: ProtectedDayAnchor[] = [];

  for (const { task, normalizedStart, duration } of intervals) {
    const protectedTask = isProtectedTask(task);
    for (let elapsed = 0; elapsed < duration; elapsed += 1) {
      const index = (normalizedStart + elapsed) % (24 * 60);
      occupancy[index] = protectedTask ? 2 : Math.max(occupancy[index], 1);
    }

    if (protectedTask) {
      protectedAnchors.push({
        id: task.id ?? `anchor:${task.title}:${normalizedStart}`,
        title: task.title,
        startTime: formatMinute(normalizedStart),
        endTime: formatMinute(normalizedStart + duration),
        source: task.gcalEventId ? 'google_calendar' : 'planner',
      });
    }
  }

  const protectedUnion = occupancy.reduce((total, value) => total + (value === 2 ? 1 : 0), 0);
  const flexibleUnion = occupancy.reduce((total, value) => total + (value === 1 ? 1 : 0), 0);
  const protectedMinutes = Math.min(PLANNING_CAPACITY_MINUTES, protectedUnion);
  const flexibleMinutes = Math.min(
    Math.max(0, PLANNING_CAPACITY_MINUTES - protectedMinutes),
    flexibleUnion,
  );
  const scheduledMinutes = protectedMinutes + flexibleMinutes;
  const freeMinutes = Math.max(0, PLANNING_CAPACITY_MINUTES - scheduledMinutes);
  const freedomScore = Math.round((freeMinutes / PLANNING_CAPACITY_MINUTES) * 100);
  const mode: DayStructureMode = freedomScore >= 70 ? 'open' : freedomScore <= 35 ? 'structured' : 'mixed';
  const initiativeLevel: DayInitiativeLevel = mode === 'open' ? 'lead' : mode === 'structured' ? 'protect' : 'collaborate';

  return {
    mode,
    freedomScore,
    initiativeLevel,
    scheduledMinutes,
    protectedMinutes,
    flexibleMinutes,
    freeMinutes,
    protectedAnchors: protectedAnchors.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  };
}

/** Longitudinal pattern only calibrates initiative. Real blocks from today stay
 * dominant and remain the sole source of protected anchors and commitments. */
export function calibrateDayStructureWithPattern(
  current: DayStructureProfile,
  pattern: AgendaStylePattern | null | undefined,
  weekday: number,
): DayStructureProfile {
  if (!pattern?.confirmed || pattern.confidence < 0.65) return current;
  const historicalFreedom = pattern.freedomByWeekday?.[String(weekday)] ?? pattern.freedomScore;
  const freedomScore = Math.round(current.freedomScore * 0.8 + historicalFreedom * 100 * 0.2);
  const mode: DayStructureMode = freedomScore >= 70 ? 'open' : freedomScore <= 35 ? 'structured' : 'mixed';
  const initiativeLevel: DayInitiativeLevel = mode === 'open' ? 'lead' : mode === 'structured' ? 'protect' : 'collaborate';
  return {
    ...current,
    freedomScore,
    mode,
    initiativeLevel,
    observedFreedomScore: current.freedomScore,
    patternConfidence: pattern.confidence,
    // Deliberately preserve real current-day anchors/minutes unchanged.
    protectedAnchors: current.protectedAnchors,
  };
}

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

    const currentDayStructure = buildDayStructureProfile(input.dailyContext);
    const agendaStylePattern = input.requestContext?.agendaStylePattern as AgendaStylePattern | undefined;
    const weekday = new Date(`${input.dailyContext.date}T12:00:00.000Z`).getUTCDay();
    const dayStructure = calibrateDayStructureWithPattern(currentDayStructure, agendaStylePattern, weekday);
    const actionableLimit = dayStructure.initiativeLevel === 'lead'
      ? 4
      : dayStructure.initiativeLevel === 'protect' ? 2 : 3;

    const decisions = decisionBrain.allowedActions
      .filter((candidate) => candidate.kind !== 'insight_only'
        && candidate.targetType !== 'system'
        && candidate.source !== 'system')
      .map(toAgendaDecision)
      .filter((decision) => !['keep', 'block', 'notify'].includes(decision.type))
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, actionableLimit);
    const blocked = decisionBrain.blockedActions.map(toAgendaDecision);

    const optionalCount = decisions.filter((decision) => decision.kind === 'suggested_commitment').length;
    const realCount = decisions.filter((decision) => decision.kind === 'real_commitment').length;
    const initiativeSummary = dayStructure.initiativeLevel === 'lead'
      ? 'Seu dia tem mais liberdade, então a Airia toma a frente com poucas sugestões claras.'
      : dayStructure.initiativeLevel === 'protect'
        ? 'Seu dia tem âncoras: a Airia protege suas âncoras e adapta somente o restante.'
        : 'Seu dia mistura âncoras e espaços livres; a Airia colabora sem enrijecer sua agenda.';
    const decisionSummary = decisions.length > 0
      ? optionalCount > 0 && realCount === 0
        ? ` Encontrou ${optionalCount} sugestão opcional, sem salvar nem notificar automaticamente.`
        : ` Encontrou ${decisions.length} decisão(ões) possíveis, sem aplicar nada automaticamente.`
      : ' Não encontrou ajuste confiável; melhor não inventar compromisso.';
    const summary = `${initiativeSummary}${decisionSummary}`;

    return {
      date: input.dailyContext.date,
      trigger: input.trigger ?? 'manual',
      surface,
      summary,
      dayStructure,
      decisions,
      blocked,
      decisionBrain,
      applied: false,
    };
  }
}
