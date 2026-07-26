import { z } from 'zod';

import { RoutineApplyRequestSchema, RoutineClassifiedItemSchema } from '../contracts/routine-builder.contract';

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
  appliedSourceItemIds: string[];
};

type PrismaLike = {
  $transaction<T>(
    callback: (tx: any) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' },
  ): Promise<T>;
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

function addUtcDays(date: string, amount: number): Date {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value;
}

function parseStoredResult(value: unknown): RoutineApplyResult | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as RoutineApplyResult;
  if (!candidate.sessionId || !candidate.counts || !candidate.ids) return null;
  return {
    ...candidate,
    appliedSourceItemIds: Array.isArray(candidate.appliedSourceItemIds)
      ? [...new Set(candidate.appliedSourceItemIds.filter((id) => typeof id === 'string' && id))]
      : [],
  };
}

function emptyResult(sessionId: string): RoutineApplyResult {
  return {
    sessionId,
    counts: { objectives: 0, habits: 0, timelineBlocks: 0 },
    ids: { objectives: [], habits: [], timelineBlocks: [] },
    appliedSourceItemIds: [],
  };
}

function mergeResults(
  previous: RoutineApplyResult,
  current: RoutineApplyResult,
): RoutineApplyResult {
  return {
    sessionId: current.sessionId,
    counts: {
      objectives: previous.counts.objectives + current.counts.objectives,
      habits: previous.counts.habits + current.counts.habits,
      timelineBlocks: previous.counts.timelineBlocks + current.counts.timelineBlocks,
    },
    ids: {
      objectives: [...new Set([...previous.ids.objectives, ...current.ids.objectives])],
      habits: [...new Set([...previous.ids.habits, ...current.ids.habits])],
      timelineBlocks: [...new Set([...previous.ids.timelineBlocks, ...current.ids.timelineBlocks])],
    },
    appliedSourceItemIds: [...new Set([
      ...previous.appliedSourceItemIds,
      ...current.appliedSourceItemIds,
    ])],
  };
}

function normalizeOperationalTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function objectiveIdentity(title: string): string {
  return normalizeOperationalTitle(title);
}

function habitIdentity(title: string): string {
  return normalizeOperationalTitle(title);
}

function mergeObjectiveActions(existing: unknown, incoming: Array<{ id: string; title: string; done: boolean }>) {
  const current = Array.isArray(existing)
    ? existing.filter((value): value is { id?: string; title: string; done?: boolean } => (
        Boolean(value)
        && typeof value === 'object'
        && typeof (value as any).title === 'string'
      ))
    : [];
  const byTitle = new Map(current.map((value) => [normalizeOperationalTitle(value.title), value]));
  for (const action of incoming) {
    const previous = byTitle.get(normalizeOperationalTitle(action.title));
    byTitle.set(normalizeOperationalTitle(action.title), {
      id: previous?.id ?? action.id,
      title: action.title,
      done: previous?.done ?? action.done,
    });
  }
  return [...byTitle.values()];
}

function timelineIdentity(title: string, date: Date | string, startTime: Date | string): string {
  const dateKey = date instanceof Date ? date.toISOString().slice(0, 10) : date.slice(0, 10);
  const timeKey = startTime instanceof Date ? startTime.toISOString().slice(11, 16) : startTime.slice(0, 5);
  return `${dateKey}:${timeKey}:${normalizeOperationalTitle(title)}`;
}

function timeOfDayFromWindow(
  window: z.infer<typeof RoutineClassifiedItemSchema>['timeWindow'],
): 'morning' | 'afternoon' | 'evening' | 'anytime' | null {
  if (!window) return null;
  if (window.startTime <= '07:00' && window.endTime >= '22:00') return 'anytime';
  if (window.endTime <= '12:00') return 'morning';
  if (window.startTime >= '18:00') return 'evening';
  if (window.startTime >= '12:00' && window.endTime <= '18:00') return 'afternoon';
  const startHour = Number(window.startTime.slice(0, 2));
  const endHour = Number(window.endTime.slice(0, 2));
  const midpoint = (startHour + endHour) / 2;
  if (midpoint < 12) return 'morning';
  if (midpoint < 18) return 'afternoon';
  return 'evening';
}

function timeOfDayFromStartTime(startTime: string): 'morning' | 'afternoon' | 'evening' {
  if (startTime < '12:00') return 'morning';
  if (startTime < '18:00') return 'afternoon';
  return 'evening';
}

export class RoutineApplyService {
  constructor(private readonly prisma: PrismaLike) {}

  async apply(input: {
    sessionId: string;
    userId: string;
    sourceItemIds?: string[];
  }): Promise<RoutineApplyResult> {
    const selection = RoutineApplyRequestSchema.parse({ sourceItemIds: input.sourceItemIds });
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

      const items = z.array(RoutineClassifiedItemSchema).max(200).parse(session.items);
      const plan = DraftPlanSchema.parse(session.draftPlan);
      const applicableSourceItemIds = new Set<string>();
      const eligibleItemIds = new Set<string>();
      for (const item of items) {
        if (item.reviewState === 'excluded' || item.duplicateOf) continue;
        eligibleItemIds.add(item.id);
        if (['goal', 'project', 'habit'].includes(item.kind)) {
          applicableSourceItemIds.add(item.id);
        }
      }
      for (const entry of plan.entries) {
        if (
          entry.persist
          && entry.sourceItemId
          && eligibleItemIds.has(entry.sourceItemId)
          && ['task', 'calendar', 'habit'].includes(entry.kind)
        ) {
          applicableSourceItemIds.add(entry.sourceItemId);
        }
      }

      const storedResult = parseStoredResult(session.applyResult) ?? emptyResult(input.sessionId);
      const alreadyApplied = new Set(storedResult.appliedSourceItemIds);
      const requestedIds = selection.sourceItemIds ?? [...applicableSourceItemIds];
      const unknownId = requestedIds.find((id) => !applicableSourceItemIds.has(id) && !alreadyApplied.has(id));
      if (unknownId) throw new Error(`routine_apply_item_not_found:${unknownId}`);
      const targetSourceItemIds = new Set(requestedIds.filter((id) => !alreadyApplied.has(id)));

      if (targetSourceItemIds.size === 0) {
        const allApplicableAlreadyApplied = [...applicableSourceItemIds]
          .every((id) => alreadyApplied.has(id));
        if (allApplicableAlreadyApplied) {
          const finalized = await tx.routineBuildSession.updateMany({
            where: { id: input.sessionId, userId: input.userId, status: 'ready' },
            data: { status: 'applied', stage: 'applied' },
          });
          if (finalized.count !== 1) throw new Error('routine_session_apply_conflict');
          await tx.routineBuildSession.update({
            where: { id: input.sessionId },
            data: {
              applyResult: storedResult,
              appliedAt: new Date(),
              sourceText: null,
              sourceExpiresAt: null,
            },
          });
        }
        return storedResult;
      }

      const claimed = await tx.routineBuildSession.updateMany({
        where: { id: input.sessionId, userId: input.userId, status: 'ready' },
        data: { status: 'applying', stage: 'apply' },
      });
      if (claimed.count !== 1) throw new Error('routine_session_apply_conflict');

      const objectiveIds: string[] = [];
      const habitIds: string[] = [];
      const timelineBlockIds: string[] = [];
      const planDates = [...new Set(plan.entries
        .filter((entry) => (
          entry.persist
          && !!entry.sourceItemId
          && targetSourceItemIds.has(entry.sourceItemId)
          && ['task', 'calendar'].includes(entry.kind)
        ))
        .map((entry) => entry.date))];
      const weekStart = typeof (plan as any).weekStart === 'string'
        ? (plan as any).weekStart
        : [...plan.entries.map((entry) => entry.date)].sort()[0];
      const [existingObjectives, existingHabits, existingBlocks] = await Promise.all([
        tx.objective.findMany({
          where: { userId: input.userId, archived: false },
          select: { id: true, title: true, subgoals: true },
        }),
        tx.habit.findMany({
          where: { userId: input.userId, archived: false },
          select: { id: true, title: true },
        }),
        planDates.length > 0 && weekStart
          ? tx.timelineBlock.findMany({
              where: {
                userId: input.userId,
                localDate: { gte: utcDate(weekStart), lte: addUtcDays(weekStart, 6) },
              },
              select: {
                id: true,
                title: true,
                localDate: true,
                startAt: true,
                status: true,
                isAiSuggested: true,
              },
            })
          : Promise.resolve([]),
      ]);
      const objectivesByKey = new Map(
        existingObjectives.map((value: any) => [objectiveIdentity(value.title), value]),
      );
      const habitsByKey = new Map(
        existingHabits.map((value: any) => [habitIdentity(value.title), value]),
      );
      const timelineKeys = new Set(existingBlocks.map((value: any) => timelineIdentity(value.title, value.localDate, value.startAt)));
      const claimedTimelineIds = new Set<string>();

      for (const item of items) {
        if (item.reviewState === 'excluded' || item.duplicateOf) continue;
        if (!targetSourceItemIds.has(item.id)) continue;
        if (item.kind === 'goal' || item.kind === 'project') {
          const key = objectiveIdentity(item.title);
          const subgoals = items
            .filter((candidate) => candidate.kind === 'task'
              && candidate.parentItemId === item.id
              && candidate.reviewState !== 'excluded'
              && !candidate.duplicateOf)
            .map((candidate) => ({ id: candidate.id, title: candidate.title, done: false }));
          const existingObjective = objectivesByKey.get(key) as any;
          if (existingObjective) {
            await tx.objective.update({
              where: { id: existingObjective.id },
              data: { subgoals: mergeObjectiveActions(existingObjective.subgoals, subgoals) },
            });
            continue;
          }
          const objective = await tx.objective.create({
            data: {
              userId: input.userId,
              title: item.title,
              description: item.description ?? null,
              category: item.kind === 'project' ? 'projeto' : 'geral',
              subgoals,
              aiInsight: `Criado pelo Montador de Rotina a partir de uma fonte revisada pela usuária. Origem: ${item.sourceExcerpt}`,
            },
          });
          objectiveIds.push(objective.id);
          objectivesByKey.set(key, objective);
        }

        if (item.kind === 'habit') {
          const key = habitIdentity(item.title);
          if (!item.recurrence) throw new Error(`routine_habit_recurrence_missing:${item.id}`);
          const scheduledEntries = plan.entries.filter((entry) => (
            entry.persist
            && entry.kind === 'habit'
            && entry.sourceItemId === item.id
          ));
          const scheduledEntry = scheduledEntries[0];
          const explicitTargetDays = item.recurrence.daysOfWeek ?? [];
          const scheduledTargetDays = [...new Set(scheduledEntries.map((entry) => (
            new Date(`${entry.date}T12:00:00.000Z`).getUTCDay()
          )))].sort();
          const schedule = {
            frequency: item.recurrence.frequency,
            targetDays: item.recurrence.frequency === 'weekly'
              ? (explicitTargetDays.length > 0 ? explicitTargetDays : scheduledTargetDays)
              : [],
            targetCount: 1,
            timeOfDay: scheduledEntry
              ? timeOfDayFromStartTime(scheduledEntry.startTime)
              : timeOfDayFromWindow(item.timeWindow),
            durationMinutes: item.durationMinutes ?? null,
            reminderTime: scheduledEntry?.startTime ?? null,
          };
          const existingHabit = habitsByKey.get(key) as any;
          if (existingHabit) {
            await tx.habit.update({
              where: { id: existingHabit.id },
              data: schedule,
            });
            continue;
          }
          const habit = await tx.habit.create({
            data: {
              userId: input.userId,
              title: item.title,
              description: item.description ?? null,
              category: 'geral',
              ...schedule,
              reminderEnabled: false,
            },
          });
          habitIds.push(habit.id);
          habitsByKey.set(key, habit);
        }
      }

      for (const entry of plan.entries) {
        if (!entry.persist || !['task', 'calendar'].includes(entry.kind)) continue;
        if (!entry.sourceItemId || !targetSourceItemIds.has(entry.sourceItemId)) continue;
        const key = timelineIdentity(entry.title, entry.date, entry.startTime);
        if (timelineKeys.has(key)) continue;
        const fixed = entry.kind === 'calendar' || entry.isFixed;
        const blockData = {
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
        };
        const reusableBlock = existingBlocks.find((value: any) => (
          !claimedTimelineIds.has(value.id)
          && value.isAiSuggested === true
          && value.status === 'planned'
          && normalizeOperationalTitle(value.title) === normalizeOperationalTitle(entry.title)
        ));
        if (reusableBlock) {
          await tx.timelineBlock.update({
            where: { id: reusableBlock.id },
            data: blockData,
          });
          claimedTimelineIds.add(reusableBlock.id);
          timelineKeys.add(key);
          continue;
        }
        const block = await tx.timelineBlock.create({
          data: {
            userId: input.userId,
            ...blockData,
          },
        });
        timelineBlockIds.push(block.id);
        timelineKeys.add(key);
      }

      const operationResult: RoutineApplyResult = {
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
        appliedSourceItemIds: [...targetSourceItemIds],
      };
      const result = mergeResults(storedResult, operationResult);
      const allApplied = [...applicableSourceItemIds]
        .every((id) => result.appliedSourceItemIds.includes(id));

      await tx.routineBuildSession.update({
        where: { id: input.sessionId },
        data: {
          status: allApplied ? 'applied' : 'ready',
          stage: allApplied ? 'applied' : 'preview',
          applyResult: result,
          ...(allApplied
            ? {
                appliedAt: new Date(),
                sourceText: null,
                sourceExpiresAt: null,
              }
            : {}),
        },
      });

      return result;
    }, { isolationLevel: 'Serializable' });
  }
}
