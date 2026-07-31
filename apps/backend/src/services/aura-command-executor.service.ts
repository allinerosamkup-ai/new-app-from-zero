import type { PrismaClient } from '@app/database';
import { z } from 'zod';

import { AuraCommandOperationSchema, type AuraCommandOperation } from '../contracts/aura-command-plan.contract';
import type { CheckinCreateInput } from '../contracts/checkin.contract';
import { deriveCheckinSlot } from '../contracts/checkin-slot';
import { normalizeTimelineCategory, PlannerService } from './planner.service';

export type CommandCalendarResult = {
  calendarId: string;
  eventId: string;
  htmlLink?: string | null;
};

export interface CommandCalendarGateway {
  createOrGetEvent(input: {
    prisma: PrismaClient;
    userId: string;
    operationId: string;
    calendarId: string;
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    location?: string | null;
    description?: string | null;
  }): Promise<CommandCalendarResult>;
  updateEvent?(
    prisma: PrismaClient,
    userId: string,
    calendarId: string,
    eventId: string,
    input: { date: string; title: string; startTime: string; endTime: string; note?: string },
  ): Promise<unknown>;
  deleteEvent?(
    prisma: PrismaClient,
    userId: string,
    calendarId: string,
    eventId: string,
  ): Promise<unknown>;
}

type ApplyInput = {
  prisma: PrismaClient;
  calendarGateway: CommandCalendarGateway;
  userId: string;
  planId: string;
  operationIds: string[];
  idempotencyKey: string;
  now?: Date;
  recordCheckin?: (
    input: CheckinCreateInput,
    context?: { now?: Date; requestContext?: Record<string, unknown> },
  ) => Promise<Record<string, unknown>>;
};

type AppliedOperation = {
  id: string;
  type: string;
  status: 'applied' | 'failed';
  result?: Record<string, unknown>;
  error?: { message: string };
};

export type AuraCommandExecutionResult = {
  planId: string;
  status: 'applied' | 'partial' | 'failed';
  operations: AppliedOperation[];
};

function localDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function checklistForTimeline(items: Array<{ id?: string; title: string; done: boolean }>) {
  return items.map((item, index) => ({
    id: item.id ?? `item-${index + 1}`,
    text: item.title,
    done: item.done,
  }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível aplicar esta ação.';
}

function jsonResult(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { value };
}

function normalizeOperation(row: any): AuraCommandOperation {
  return AuraCommandOperationSchema.parse({
    id: row.clientOperationId,
    type: row.type,
    status: row.status,
    selected: row.selected,
    payload: row.payload,
  });
}

const ExistingChecklistItemSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(500),
  done: z.boolean(),
}).strict();

const GoalChangesSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  category: z.string().trim().min(1).max(80).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  subgoals: z.array(ExistingChecklistItemSchema).max(30).optional(),
}).strict();

const HabitChangesSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  category: z.string().trim().min(1).max(80).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  targetDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  durationMinutes: z.number().int().min(1).max(720).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
}).strict();

const CaptureChangesSchema = z.object({
  kind: z.enum(['note', 'checklist']).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  content: z.string().trim().max(30_000).optional(),
  items: z.array(ExistingChecklistItemSchema).max(200).optional(),
  status: z.enum(['inbox', 'completed', 'archived']).optional(),
}).strict();

export function sanitizeExistingItemChanges(
  targetType: 'goal' | 'habit' | 'capture',
  changes: Record<string, unknown>,
) {
  if (targetType === 'goal') return GoalChangesSchema.parse(changes);
  if (targetType === 'habit') return HabitChangesSchema.parse(changes);
  return CaptureChangesSchema.parse(changes);
}

async function createTimelineTask(
  tx: any,
  userId: string,
  databaseOperationId: string,
  operation: Extract<AuraCommandOperation, { type: 'create_planner_task' }>,
) {
  if (!operation.payload.startTime) {
    throw new Error('A tarefa ainda precisa de um horário antes de ser aplicada.');
  }
  const date = localDate(operation.payload.date);
  const startAt = PlannerService.parseTimeToDate(date, operation.payload.startTime);
  const endAt = addMinutes(startAt, operation.payload.durationMinutes);
  const block = await tx.timelineBlock.create({
    data: {
      userId,
      localDate: date,
      startAt,
      endAt,
      title: operation.payload.title,
      category: operation.payload.category,
      intensity: 'M',
      isAiSuggested: true,
      note: operation.payload.note ?? null,
      checklist: checklistForTimeline(operation.payload.checklist),
      sourceCommandOperationId: databaseOperationId,
      gcalSyncStatus: 'not_applicable',
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
      adaptabilitySource: 'ai',
      adaptabilityConfidence: 0.9,
    },
  });
  return { timelineBlockId: block.id };
}

async function createCalendarMirror(
  tx: any,
  userId: string,
  databaseOperationId: string,
  operation: Extract<AuraCommandOperation, { type: 'create_calendar_event' }>,
  event: CommandCalendarResult,
) {
  const date = localDate(operation.payload.date);
  const startAt = PlannerService.parseTimeToDate(date, operation.payload.startTime);
  const endAt = addMinutes(startAt, operation.payload.durationMinutes);
  const block = await tx.timelineBlock.create({
    data: {
      userId,
      localDate: date,
      startAt,
      endAt,
      title: operation.payload.title,
      category: 'compromisso',
      intensity: 'M',
      isAiSuggested: true,
      note: operation.payload.description ?? null,
      checklist: [],
      gcalEventId: event.eventId,
      gcalCalendarId: event.calendarId,
      gcalSyncStatus: 'synced',
      sourceCommandOperationId: databaseOperationId,
      temporalPolicy: 'fixed',
      adaptationPermission: 'protected',
      adaptabilitySource: 'gcal',
      adaptabilityConfidence: 1,
    },
  });
  return {
    timelineBlockId: block.id,
    calendarId: event.calendarId,
    eventId: event.eventId,
    htmlLink: event.htmlLink ?? null,
  };
}

async function executeInternalOperation(
  tx: any,
  userId: string,
  databaseOperationId: string,
  operation: Exclude<AuraCommandOperation, { type: 'create_calendar_event' }>,
  now: Date,
): Promise<Record<string, unknown>> {
  switch (operation.type) {
    case 'record_checkin':
      throw new Error('O check-in precisa passar pelo gravador canônico da Airia.');
    case 'create_planner_task':
      return createTimelineTask(tx, userId, databaseOperationId, operation);
    case 'create_capture': {
      const capture = await tx.capture.create({
        data: {
          userId,
          kind: operation.payload.kind,
          title: operation.payload.title,
          content: operation.payload.content,
          items: operation.payload.items,
          sourceOperationId: databaseOperationId,
        },
      });
      return { captureId: capture.id };
    }
    case 'create_goal': {
      const objective = await tx.objective.create({
        data: {
          userId,
          title: operation.payload.title,
          description: operation.payload.description ?? null,
          category: operation.payload.category,
          subgoals: operation.payload.subgoals.map((item, index) => ({
            id: item.id ?? `subgoal-${index + 1}`,
            title: item.title,
            completed: item.done,
          })),
        },
      });
      let firstActionId: string | null = null;
      if (operation.payload.firstAction) {
        const firstAction = operation.payload.firstAction;
        const date = localDate(firstAction.date);
        const startAt = PlannerService.parseTimeToDate(date, firstAction.startTime);
        const task = await tx.timelineBlock.create({
          data: {
            userId,
            localDate: date,
            startAt,
            endAt: addMinutes(startAt, firstAction.durationMinutes),
            title: firstAction.title,
            category: normalizeTimelineCategory(operation.payload.category),
            intensity: 'M',
            isAiSuggested: true,
            sourceCommandOperationId: databaseOperationId,
            temporalPolicy: 'flexible',
            adaptationPermission: 'eligible',
            adaptabilitySource: 'ai',
            adaptabilityConfidence: 0.9,
          },
        });
        firstActionId = task.id;
      }
      return { objectiveId: objective.id, firstActionId };
    }
    case 'create_habit': {
      const habit = await tx.habit.create({
        data: {
          userId,
          title: operation.payload.title,
          description: operation.payload.description ?? null,
          category: operation.payload.category,
          frequency: operation.payload.frequency,
          targetDays: operation.payload.targetDays,
          durationMinutes: operation.payload.durationMinutes ?? null,
          reminderEnabled: Boolean(operation.payload.reminderTime),
          reminderTime: operation.payload.reminderTime ?? null,
        },
      });
      return { habitId: habit.id };
    }
    case 'create_checkin': {
      const scores = operation.payload;
      if (
        scores.moodScore === null
        || scores.energyScore === null
        || scores.clarityScore === null
      ) {
        throw new Error('O check-in precisa de humor, energia e clareza antes de ser salvo.');
      }
      const checkin = await tx.dailyCheckin.upsert({
        where: {
          userId_localDate_checkinSlot: {
            userId,
            localDate: localDate(scores.localDate),
            checkinSlot: deriveCheckinSlot(now),
          },
        },
        update: {
          recordedAt: now,
          moodScore: scores.moodScore,
          energyScore: scores.energyScore,
          clarityScore: scores.clarityScore,
          ...(scores.irritabilityScore === null
            ? {}
            : { irritabilityScore: scores.irritabilityScore }),
          note: scores.note ?? null,
          emotions: scores.emotions,
        },
        create: {
          userId,
          localDate: localDate(scores.localDate),
          recordedAt: now,
          checkinSlot: deriveCheckinSlot(now),
          moodScore: scores.moodScore,
          energyScore: scores.energyScore,
          clarityScore: scores.clarityScore,
          irritabilityScore: scores.irritabilityScore ?? null,
          physicalScore: 3,
          socialScore: 3,
          note: scores.note ?? null,
          emotions: scores.emotions,
        },
      });
      return { checkinId: checkin.id };
    }
    case 'handoff_to_journal': {
      const date = localDate(now.toISOString().slice(0, 10));
      let session = await tx.journalSession.findFirst({
        where: { userId, localDate: date, status: 'active' },
        orderBy: { updatedAt: 'desc' },
      });
      if (!session) {
        session = await tx.journalSession.create({
          data: { userId, localDate: date, status: 'active' },
        });
      }
      const lastMessage = await tx.journalMessage.findFirst({
        where: { sessionId: session.id },
        orderBy: { orderIndex: 'desc' },
      });
      const message = await tx.journalMessage.create({
        data: {
          sessionId: session.id,
          userId,
          role: 'user',
          content: operation.payload.content,
          orderIndex: (lastMessage?.orderIndex ?? -1) + 1,
        },
      });
      return { journalSessionId: session.id, journalMessageId: message.id };
    }
    case 'update_item':
      if (operation.payload.targetType === 'goal') {
        const changes = sanitizeExistingItemChanges('goal', operation.payload.changes);
        const updated = await tx.objective.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: changes,
        });
        if (updated.count === 0) throw new Error('Meta não encontrada.');
        return { objectiveId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'habit') {
        const changes = sanitizeExistingItemChanges('habit', operation.payload.changes);
        const updated = await tx.habit.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: changes,
        });
        if (updated.count === 0) throw new Error('Hábito não encontrado.');
        return { habitId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'capture') {
        const changes = sanitizeExistingItemChanges('capture', operation.payload.changes);
        const updated = await tx.capture.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: changes,
        });
        if (updated.count === 0) throw new Error('Nota ou checklist não encontrado.');
        return { captureId: operation.payload.targetId };
      }
      throw new Error('Esta alteração precisa de um executor específico.');
    case 'complete_item':
      if (operation.payload.targetType === 'timeline') {
        const updated = await tx.timelineBlock.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: { status: 'completed' },
        });
        if (updated.count === 0) throw new Error('Tarefa não encontrada.');
        return { timelineBlockId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'goal') {
        const updated = await tx.objective.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: { progress: 100 },
        });
        if (updated.count === 0) throw new Error('Meta não encontrada.');
        return { objectiveId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'capture') {
        const updated = await tx.capture.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: { status: 'completed' },
        });
        if (updated.count === 0) throw new Error('Nota ou checklist não encontrado.');
        return { captureId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'habit') {
        const date = localDate(now.toISOString().slice(0, 10));
        const habit = await tx.habit.findFirst({
          where: { id: operation.payload.targetId, userId, archived: false },
          select: { id: true },
        });
        if (!habit) throw new Error('Hábito não encontrado.');
        await tx.habitCompletion.upsert({
          where: { habitId_date: { habitId: habit.id, date } },
          update: { completedAt: now, completionCount: { increment: 1 } },
          create: { habitId: habit.id, date, completedAt: now },
        });
        return { habitId: habit.id };
      }
      throw new Error('Item não encontrado.');
    case 'delete_item':
      if (operation.payload.targetType === 'goal') {
        const deleted = await tx.objective.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: { archived: true },
        });
        if (deleted.count === 0) throw new Error('Meta não encontrada.');
        return { objectiveId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'habit') {
        const deleted = await tx.habit.updateMany({
          where: { id: operation.payload.targetId, userId },
          data: { archived: true, archivedAt: now },
        });
        if (deleted.count === 0) throw new Error('Hábito não encontrado.');
        return { habitId: operation.payload.targetId };
      }
      if (operation.payload.targetType === 'capture') {
        const deleted = await tx.capture.deleteMany({
          where: { id: operation.payload.targetId, userId },
        });
        if (deleted.count === 0) throw new Error('Nota ou checklist não encontrado.');
        return { captureId: operation.payload.targetId };
      }
      throw new Error('Esta exclusão precisa de um executor específico.');
  }
}

async function executeTimelineMutation(
  input: ApplyInput,
  operation: {
    type: 'update_item' | 'delete_item';
    payload: {
      targetType: 'timeline';
      targetId: string;
      calendarId?: string | null;
      changes: Record<string, unknown>;
    };
  },
): Promise<Record<string, unknown>> {
  const block = await input.prisma.timelineBlock.findFirst({
    where: { id: operation.payload.targetId, userId: input.userId },
  });
  if (!block) throw new Error('Tarefa não encontrada.');
  const calendarId = block.gcalCalendarId ?? 'primary';

  if (operation.type === 'delete_item') {
    if (block.gcalEventId) {
      if (!input.calendarGateway.deleteEvent) {
        throw new Error('Google Agenda indisponível para excluir este compromisso.');
      }
      const deleted = await input.calendarGateway.deleteEvent(
        input.prisma,
        input.userId,
        calendarId,
        block.gcalEventId,
      );
      if (!deleted) throw new Error('Não consegui excluir o compromisso do Google Agenda.');
    }
    await input.prisma.timelineBlock.delete({ where: { id: block.id } });
    return { timelineBlockId: block.id };
  }

  const changes = operation.payload.changes;
  const date = typeof changes.date === 'string'
    ? changes.date
    : block.localDate.toISOString().slice(0, 10);
  const startTime = typeof changes.startTime === 'string'
    ? changes.startTime
    : `${String(block.startAt.getUTCHours()).padStart(2, '0')}:${String(block.startAt.getUTCMinutes()).padStart(2, '0')}`;
  const durationMs = block.endAt.getTime() - block.startAt.getTime();
  const startAt = PlannerService.parseTimeToDate(localDate(date), startTime);
  const endAt = new Date(startAt.getTime() + durationMs);
  const endTime = `${String(endAt.getUTCHours()).padStart(2, '0')}:${String(endAt.getUTCMinutes()).padStart(2, '0')}`;
  const title = typeof changes.title === 'string' ? changes.title : block.title;
  const note = typeof changes.note === 'string' ? changes.note : block.note ?? undefined;

  if (block.gcalEventId) {
    if (!input.calendarGateway.updateEvent) {
      throw new Error('Google Agenda indisponível para atualizar este compromisso.');
    }
    const updated = await input.calendarGateway.updateEvent(
      input.prisma,
      input.userId,
      calendarId,
      block.gcalEventId,
      { date, title, startTime, endTime, note },
    );
    if (!updated) throw new Error('Não consegui atualizar o compromisso no Google Agenda.');
  }
  await input.prisma.timelineBlock.update({
    where: { id: block.id },
    data: {
      localDate: localDate(date),
      startAt,
      endAt,
      title,
      note: note ?? null,
    },
  });
  return { timelineBlockId: block.id };
}

export class AuraCommandExecutorService {
  static async apply(input: ApplyInput): Promise<AuraCommandExecutionResult> {
    const now = input.now ?? new Date();
    const plan = await input.prisma.auraCommandPlan.findFirst({
      where: { id: input.planId, userId: input.userId },
      include: { operations: { orderBy: { createdAt: 'asc' } } },
    });
    if (!plan) throw new Error('Plano de comando não encontrado.');
    if (plan.executionPolicy === 'clarification') {
      throw new Error('O comando precisa de clarification antes de ser aplicado.');
    }

    const requested = new Set(input.operationIds);
    const rows = plan.operations.filter((row: any) =>
      row.selected && (requested.has(row.clientOperationId) || requested.has(row.id)));
    if (rows.length === 0) throw new Error('Nenhuma ação selecionada para aplicar.');

    await input.prisma.auraCommandPlan.update({
      where: { id: plan.id },
      data: { status: 'applying' },
    });

    const results: AppliedOperation[] = [];
    for (const row of rows) {
      if (row.status === 'applied' && row.result) {
        results.push({
          id: row.clientOperationId,
          type: row.type,
          status: 'applied',
          result: jsonResult(row.result),
        });
        continue;
      }

      const operationKey = `${input.idempotencyKey}:${row.id}`;
      try {
        await input.prisma.auraCommandOperation.update({
          where: { id: row.id },
          data: {
            status: 'pending',
            idempotencyKey: operationKey,
            error: undefined,
          },
        });
        const operation = normalizeOperation({ ...row, status: 'pending' });
        let result: Record<string, unknown>;
        let statusStoredAtomically = false;

        if (operation.type === 'record_checkin') {
          if (!input.recordCheckin) {
            throw new Error('O gravador canônico de check-in não está disponível.');
          }
          result = await input.recordCheckin({
            ...operation.payload,
            userId: input.userId,
            idempotencyKey: operation.payload.idempotencyKey ?? operationKey,
            note: operation.payload.note ?? undefined,
          }, {
            now,
            requestContext: {
              sourceMessageId: operation.payload.sourceMessageId,
              rawText: operation.payload.rawText,
            },
          });
        } else if (operation.type === 'create_calendar_event') {
          const event = await input.calendarGateway.createOrGetEvent({
            prisma: input.prisma,
            userId: input.userId,
            operationId: row.id,
            calendarId: operation.payload.calendarId,
            title: operation.payload.title,
            date: operation.payload.date,
            startTime: operation.payload.startTime,
            durationMinutes: operation.payload.durationMinutes,
            location: operation.payload.location,
            description: operation.payload.description,
          });
          result = await input.prisma.$transaction(async (tx: any) => {
            const existingMirror = await tx.timelineBlock.findFirst?.({
              where: { sourceCommandOperationId: row.id, userId: input.userId },
            });
            const nextResult = existingMirror
              ? {
                timelineBlockId: existingMirror.id,
                calendarId: event.calendarId,
                eventId: event.eventId,
                htmlLink: event.htmlLink ?? null,
              }
              : await createCalendarMirror(tx, input.userId, row.id, operation, event);
            await tx.auraCommandOperation.update({
              where: { id: row.id },
              data: { status: 'applied', result: nextResult as any, error: undefined, appliedAt: now },
            });
            return nextResult;
          });
          statusStoredAtomically = true;
        } else if (
          (operation.type === 'update_item' || operation.type === 'delete_item')
          && operation.payload.targetType === 'timeline'
        ) {
          result = await executeTimelineMutation(input, operation as Parameters<typeof executeTimelineMutation>[1]);
        } else {
          result = await input.prisma.$transaction(async (tx: any) => {
            const nextResult = await executeInternalOperation(tx, input.userId, row.id, operation, now);
            await tx.auraCommandOperation.update({
              where: { id: row.id },
              data: { status: 'applied', result: nextResult as any, error: undefined, appliedAt: now },
            });
            return nextResult;
          });
          statusStoredAtomically = true;
        }

        if (!statusStoredAtomically) {
          await input.prisma.auraCommandOperation.update({
            where: { id: row.id },
            data: {
              status: 'applied',
              result: result as any,
              error: undefined,
              appliedAt: now,
            },
          });
        }
        results.push({
          id: row.clientOperationId,
          type: row.type,
          status: 'applied',
          result,
        });
      } catch (error) {
        const message = errorMessage(error);
        await input.prisma.auraCommandOperation.update({
          where: { id: row.id },
          data: {
            status: 'failed',
            error: { message },
          },
        }).catch(() => undefined);
        results.push({
          id: row.clientOperationId,
          type: row.type,
          status: 'failed',
          error: { message },
        });
      }
    }

    const appliedCount = results.filter((item) => item.status === 'applied').length;
    const status = appliedCount === results.length
      ? 'applied'
      : appliedCount > 0 ? 'partial' : 'failed';
    await input.prisma.auraCommandPlan.update({
      where: { id: plan.id },
      data: {
        status,
        appliedAt: status === 'applied' ? now : undefined,
      },
    });
    return { planId: plan.id, status, operations: results };
  }
}
