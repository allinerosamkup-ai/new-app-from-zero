import { z } from 'zod';

import { RoutineClassifiedItemSchema } from '../contracts/routine-builder.contract';

const PlanEntrySchema = z.object({
  sourceItemId: z.string().optional(),
  kind: z.enum(['task', 'habit', 'calendar', 'existing']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().min(1).max(160),
  isFixed: z.boolean(),
  persist: z.boolean(),
  reason: z.string().min(1).max(1200),
});

const DraftPlanSchema = z.object({
  entries: z.array(PlanEntrySchema).max(500),
}).passthrough();

export type RoutineApplyResult = {
  sessionId: string;
  counts: { objectives: number; habits: number; timelineBlocks: number };
  ids: { objectives: string[]; habits: string[]; timelineBlocks: string[] };
};

type PrismaLike = {
  $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
  routineBuildSession: {
    findFirst(args: unknown): Promise<any>;
  };
};

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function utcDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

function parseStoredResult(value: unknown): RoutineApplyResult | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as RoutineApplyResult;
  if (!candidate.sessionId || !candidate.counts || !candidate.ids) return null;
  return candidate;
}

export class RoutineApplyService {
  constructor(private readonly prisma: PrismaLike) {}

  async apply(input: { sessionId: string; userId: string }): Promise<RoutineApplyResult> {
    const previous = await this.prisma.routineBuildSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
    });
    if (!previous) throw new Error('routine_session_not_found');
    if (previous.status === 'applied') {
      const stored = parseStoredResult(previous.applyResult);
      if (!stored) throw new Error('routine_apply_result_missing');
      return stored;
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.routineBuildSession.findFirst({
        where: { id: input.sessionId, userId: input.userId },
      });
      if (!session) throw new Error('routine_session_not_found');
      if (session.status === 'applied') {
        const stored = parseStoredResult(session.applyResult);
        if (!stored) throw new Error('routine_apply_result_missing');
        return stored;
      }
      if (session.status !== 'ready') throw new Error('routine_session_not_ready');

      const claimed = await tx.routineBuildSession.updateMany({
        where: { id: input.sessionId, userId: input.userId, status: 'ready' },
        data: { status: 'applying', stage: 'apply' },
      });
      if (claimed.count !== 1) throw new Error('routine_session_apply_conflict');

      const items = z.array(RoutineClassifiedItemSchema).max(200).parse(session.items);
      const plan = DraftPlanSchema.parse(session.draftPlan);
      const objectiveIds: string[] = [];
      const habitIds: string[] = [];
      const timelineBlockIds: string[] = [];

      for (const item of items) {
        if (item.reviewState === 'excluded' || item.duplicateOf) continue;
        if (item.kind === 'goal' || item.kind === 'project') {
          const objective = await tx.objective.create({
            data: {
              userId: input.userId,
              title: item.title,
              description: item.description ?? null,
              category: item.kind === 'project' ? 'projeto' : 'geral',
              aiInsight: `Criado pelo Montador de Rotina a partir de uma fonte revisada pela usuária. Origem: ${item.sourceExcerpt}`,
            },
          });
          objectiveIds.push(objective.id);
        }

        if (item.kind === 'habit') {
          if (!item.recurrence) throw new Error(`routine_habit_recurrence_missing:${item.id}`);
          const habit = await tx.habit.create({
            data: {
              userId: input.userId,
              title: item.title,
              description: item.description ?? null,
              category: 'geral',
              frequency: item.recurrence.frequency,
              targetDays: item.recurrence.daysOfWeek ?? [],
              targetCount: item.recurrence.timesPerWeek ?? 1,
              durationMinutes: item.durationMinutes ?? null,
              reminderEnabled: false,
            },
          });
          habitIds.push(habit.id);
        }
      }

      for (const entry of plan.entries) {
        if (!entry.persist || !['task', 'calendar'].includes(entry.kind)) continue;
        const fixed = entry.kind === 'calendar' || entry.isFixed;
        const block = await tx.timelineBlock.create({
          data: {
            userId: input.userId,
            localDate: utcDate(entry.date),
            startAt: utcDateTime(entry.date, entry.startTime),
            endAt: utcDateTime(entry.date, entry.endTime),
            title: entry.title,
            category: entry.kind === 'calendar' ? 'compromisso' : 'tarefa',
            intensity: 'media',
            status: 'planned',
            isAiSuggested: true,
            temporalPolicy: fixed ? 'fixed' : 'flexible',
            adaptationPermission: fixed ? 'protected' : 'eligible',
            adaptabilitySource: 'ai',
            adaptabilityConfidence: 0.9,
            aiReasoning: entry.reason,
          },
        });
        timelineBlockIds.push(block.id);
      }

      const result: RoutineApplyResult = {
        sessionId: input.sessionId,
        counts: {
          objectives: objectiveIds.length,
          habits: habitIds.length,
          timelineBlocks: timelineBlockIds.length,
        },
        ids: {
          objectives: objectiveIds,
          habits: habitIds,
          timelineBlocks: timelineBlockIds,
        },
      };

      await tx.routineBuildSession.update({
        where: { id: input.sessionId },
        data: {
          status: 'applied',
          stage: 'applied',
          applyResult: result,
          appliedAt: new Date(),
          sourceText: null,
          sourceExpiresAt: null,
        },
      });

      return result;
    });
  }
}
