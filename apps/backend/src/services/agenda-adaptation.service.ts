import { AdaptiveAgendaEngine, type AdaptiveAgendaPlan } from './adaptive-agenda-engine.service';
import { PrismaClient } from '@app/database';
import { PlannerService } from './planner.service';
import { AiActionFeedbackService } from './ai-action-feedback.service';
import type { DailyContext } from './context-grounding.service';

export type AgendaAdaptationTrigger = 'manual' | 'checkin' | 'cron' | 'home' | 'planner' | `recalibrate:${string}`;
export type AgendaAdaptationMode = 'preview' | 'apply';

export type AgendaAdaptationChange = {
  id: string;
  type: 'keep' | 'move' | 'shrink' | 'pause' | 'suggest' | 'convert' | 'notify' | 'block' | 'skip';
  title: string;
  targetId?: string | null;
  targetType: 'timeline' | 'habit' | 'goal' | 'system';
  from?: string | null;
  to?: string | null;
  suggestedStartTime?: string | null;
  suggestedEndTime?: string | null;
  suggestedDate?: string | null;
  reason: string;
  bioReason: string;
  impactLabel: 'reduz carga' | 'protege energia' | 'aproveita janela' | 'mantém ritmo';
  confidence: number;
  score?: number;
  kind?: string;
  source?: string;
  requiresConfirmation?: boolean;
  notificationAllowed?: boolean;
  applied?: boolean;
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
  appliedChanges: AgendaAdaptationChange[];
  skippedChanges: AgendaAdaptationChange[];
  timelineRefreshNeeded: boolean;
};

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapCategory(change: AgendaAdaptationChange): string {
  if (change.targetType === 'habit') return 'autocuidado';
  if (change.impactLabel === 'protege energia') return 'autocuidado';
  return 'pessoal';
}

function mapIntensity(change: AgendaAdaptationChange): 'L' | 'M' | 'P' {
  if (change.impactLabel === 'protege energia' || change.impactLabel === 'reduz carga') return 'L';
  if (change.impactLabel === 'aproveita janela') return 'M';
  return 'L';
}

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
      id: decision.id,
      type: decision.type,
      title: decision.title,
      targetId: decision.targetId,
      targetType: decision.targetType,
      from: decision.from,
      to: decision.to,
      suggestedStartTime: decision.suggestedStartTime,
      suggestedEndTime: decision.suggestedEndTime,
      suggestedDate: decision.suggestedDate,
      reason: decision.reason,
      bioReason: decision.bioReason,
      impactLabel: decision.impactLabel,
      confidence: decision.confidence,
      score: decision.score,
      kind: decision.kind,
      source: decision.source,
      requiresConfirmation: decision.requiresConfirmation,
      notificationAllowed: decision.notificationAllowed,
    }));
    const blockedDecisions: AgendaAdaptationChange[] = adaptiveAgenda.blocked.map((decision) => ({
      id: decision.id,
      type: decision.type,
      title: decision.title,
      targetId: decision.targetId,
      targetType: decision.targetType,
      from: decision.from,
      to: decision.to,
      suggestedStartTime: decision.suggestedStartTime,
      suggestedEndTime: decision.suggestedEndTime,
      suggestedDate: decision.suggestedDate,
      reason: decision.reason,
      bioReason: decision.bioReason,
      impactLabel: decision.impactLabel,
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
      appliedChanges: [],
      skippedChanges: [],
      timelineRefreshNeeded: false,
    };
  }

  static async apply(input: {
    prisma: PrismaClient;
    userId: string;
    dailyContext: DailyContext;
    requestContext?: Record<string, unknown>;
    trigger?: AgendaAdaptationTrigger;
    selectedDecisionIds?: string[];
  }): Promise<AgendaAdaptationResult> {
    const preview = this.buildPreview({
      dailyContext: input.dailyContext,
      requestContext: input.requestContext,
      mode: 'apply',
      trigger: input.trigger,
    });
    const selected = new Set(input.selectedDecisionIds ?? []);
    const appliedChanges: AgendaAdaptationChange[] = [];
    const skippedChanges: AgendaAdaptationChange[] = [];

    for (const change of preview.changes) {
      if (!selected.has(change.id) || change.type === 'keep' || change.type === 'block' || change.type === 'notify') {
        skippedChanges.push({ ...change, applied: false });
        continue;
      }

      try {
        if ((change.type === 'move' || change.type === 'shrink') && change.targetType === 'timeline' && change.targetId) {
          const block = await input.prisma.timelineBlock.findFirst({
            where: { id: change.targetId, userId: input.userId },
          });
          if (!block) {
            skippedChanges.push({ ...change, applied: false, reason: 'Bloco não encontrado para aplicar ajuste.' });
            continue;
          }
          const dateKey = change.suggestedDate ?? formatDateKey(block.localDate);
          const baseDate = parseDateKey(dateKey);
          const startTime = change.type === 'move' ? change.suggestedStartTime : change.from;
          const endTime = change.suggestedEndTime;
          if (!startTime || !endTime) {
            skippedChanges.push({ ...change, applied: false, reason: 'Ajuste sem horário seguro.' });
            continue;
          }
          await input.prisma.timelineBlock.update({
            where: { id: block.id },
            data: {
              localDate: baseDate,
              startAt: PlannerService.parseTimeToDate(baseDate, startTime),
              endAt: PlannerService.parseTimeToDate(baseDate, endTime),
            },
          });
          appliedChanges.push({ ...change, applied: true });
        } else if (change.type === 'pause' && change.targetType === 'timeline' && change.targetId) {
          const block = await input.prisma.timelineBlock.findFirst({
            where: { id: change.targetId, userId: input.userId },
          });
          if (!block) {
            skippedChanges.push({ ...change, applied: false, reason: 'Bloco não encontrado para pausar.' });
            continue;
          }
          const originalDate = formatDateKey(block.localDate);
          const targetDate = addDaysToDateKey(originalDate, 1);
          const baseDate = parseDateKey(targetDate);
          const startTime = change.from ?? '10:00';
          const durationMs = Math.max(30 * 60_000, block.endAt.getTime() - block.startAt.getTime());
          const startAt = PlannerService.parseTimeToDate(baseDate, startTime);
          await input.prisma.timelineBlock.update({
            where: { id: block.id },
            data: {
              localDate: baseDate,
              startAt,
              endAt: new Date(startAt.getTime() + durationMs),
              status: 'planned',
            },
          });
          appliedChanges.push({ ...change, suggestedDate: targetDate, applied: true });
        } else if (change.type === 'convert' || change.type === 'suggest') {
          const dateKey = change.suggestedDate ?? input.dailyContext.date;
          const startTime = change.suggestedStartTime ?? '10:00';
          const endTime = change.suggestedEndTime ?? '10:30';
          const baseDate = parseDateKey(dateKey);
          await input.prisma.timelineBlock.create({
            data: {
              userId: input.userId,
              localDate: baseDate,
              startAt: PlannerService.parseTimeToDate(baseDate, startTime),
              endAt: PlannerService.parseTimeToDate(baseDate, endTime),
              title: change.type === 'suggest' ? `Avanço em: ${change.title}` : change.title,
              category: mapCategory(change),
              intensity: mapIntensity(change),
              status: 'planned',
              isAiSuggested: true,
              aiReasoning: `${change.reason} ${change.bioReason}`,
              energyLevel: mapIntensity(change) === 'L' ? 'leve' : 'media',
            },
          });
          appliedChanges.push({ ...change, applied: true });
        } else {
          skippedChanges.push({ ...change, applied: false });
          continue;
        }

        await AiActionFeedbackService.append(input.prisma, input.userId, {
          title: change.title,
          status: 'scheduled',
          surface: 'planner',
          sourceType: `agenda-adapt-${change.type}`,
          localDate: input.dailyContext.date,
        });
        await input.prisma.eventLog?.create?.({
          data: {
            userId: input.userId,
            eventName: 'agenda_adaptation.applied',
            properties: {
              decisionId: change.id,
              type: change.type,
              title: change.title,
              targetId: change.targetId,
              targetType: change.targetType,
              suggestedDate: change.suggestedDate,
              suggestedStartTime: change.suggestedStartTime,
              suggestedEndTime: change.suggestedEndTime,
              trigger: input.trigger ?? 'manual',
            },
            path: '/api/agenda/adapt',
            userAgent: null,
          },
        }).catch(() => null);
      } catch (error) {
        skippedChanges.push({
          ...change,
          applied: false,
          reason: error instanceof Error ? error.message : 'Falha ao aplicar ajuste.',
        });
      }
    }

    return {
      ...preview,
      applied: appliedChanges.length > 0,
      appliedChanges,
      skippedChanges,
      timelineRefreshNeeded: appliedChanges.length > 0,
    };
  }
}
