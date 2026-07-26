import { z } from 'zod';

import { deriveRoutineCapacity } from '../lib/phase-capacity';
import {
  RoutineClassifiedItemSchema,
  RoutineCreateSessionSchema,
  RoutineGuidedAnswersSchema,
  RoutineUpdateItemsSchema,
  type RoutineClassifiedItem,
  type RoutineCreateSessionInput,
  type RoutineGuidedAnswers,
  type RoutineTimeWindow,
} from '../contracts/routine-builder.contract';
import { transformGuidedAnswers } from './routine-guided-transform.service';
import { AiActionFeedbackService } from './ai-action-feedback.service';
import { RoutineApplyService } from './routine-apply.service';
import { RoutineClarificationService, type RoutineClarificationQuestion } from './routine-clarification.service';
import { RoutineClassifierService } from './routine-classifier.service';
import { RoutineComposerService } from './routine-composer.service';
import { RoutineSourceExtractorService } from './routine-source-extractor.service';

type BuilderDependencies = {
  extractor?: RoutineSourceExtractorService;
  classifier?: Pick<RoutineClassifierService, 'classify'>;
  applyService?: Pick<RoutineApplyService, 'apply'>;
};

function dateOnly(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function timeOnly(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : value).slice(11, 16);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function utcDay(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function minutesBetweenTimes(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  return Math.max(5, ((endHours * 60) + endMinutes) - ((startHours * 60) + startMinutes));
}

function guidedHabitWindow(
  timeOfDay: RoutineGuidedAnswers['selectedHabits'][number]['timeOfDay'],
  durationMinutes: number,
): RoutineTimeWindow {
  const windows = {
    morning: { startTime: '06:00', endTime: '12:00' },
    afternoon: { startTime: '12:00', endTime: '18:00' },
    evening: { startTime: '18:00', endTime: '22:00' },
    anytime: { startTime: '07:00', endTime: '23:00' },
  } as const;
  const minimum = Math.max(5, Math.floor((durationMinutes / 2) / 5) * 5);
  const maximum = Math.min(180, Math.max(
    durationMinutes,
    Math.ceil((durationMinutes * 1.5) / 5) * 5,
  ));
  return {
    ...windows[timeOfDay],
    minDurationMinutes: minimum,
    maxDurationMinutes: maximum,
  };
}

function enrichGuidedItems(
  rawItems: RoutineClassifiedItem[],
  answers: RoutineGuidedAnswers,
  today: string,
): RoutineClassifiedItem[] {
  let commitmentIndex = 0;
  let selectedHabitIndex = 0;
  return rawItems.map((item) => {
    if (item.kind === 'calendar' && commitmentIndex < answers.fixedCommitments.length) {
      const commitment = answers.fixedCommitments[commitmentIndex++];
      return RoutineClassifiedItemSchema.parse({
        ...item,
        durationMinutes: minutesBetweenTimes(commitment.startTime, commitment.endTime),
        priority: 'urgent',
      });
    }
    if (item.kind === 'habit' && selectedHabitIndex < answers.selectedHabits.length) {
      const habit = answers.selectedHabits[selectedHabitIndex++];
      return RoutineClassifiedItemSchema.parse({
        ...item,
        priority: 'medium',
        timeWindow: guidedHabitWindow(habit.timeOfDay, habit.durationMinutes),
      });
    }
    return RoutineClassifiedItemSchema.parse({
      ...item,
      priority: item.kind === 'task' && item.date === today ? 'high' : item.priority,
    });
  });
}

/**
 * Lê o estado declarado no onboarding guiado de dentro do JSONB da sessão.
 * Sessão antiga ou importada não tem esse campo — nesse caso não há estado.
 */
function readDeclaredState(value: unknown): { mood: number; energy: number; focus: number } | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string, unknown>;
  const mood = Number(state.mood);
  const energy = Number(state.energy);
  const focus = Number(state.focus);
  if (![mood, energy, focus].every((score) => Number.isFinite(score) && score >= 1 && score <= 10)) return null;
  return { mood, energy, focus };
}

function publicSession<T extends Record<string, any>>(session: T): Omit<T, 'sourceText'> {
  const { sourceText: _sourceText, ...safe } = session;
  return safe;
}

function applyAnswer(
  item: RoutineClassifiedItem,
  question: RoutineClarificationQuestion,
  answer: string,
): RoutineClassifiedItem {
  if (question.field === 'title') return RoutineClassifiedItemSchema.parse({ ...item, title: answer.trim() });
  if (question.field === 'recurrence') {
    const recurrenceByAnswer: Record<string, { frequency: 'daily' | 'weekly'; daysOfWeek: number[]; timesPerWeek?: number; interval: number }> = {
      daily: { frequency: 'daily', daysOfWeek: [], interval: 1 },
      weekdays: { frequency: 'weekly', daysOfWeek: [1, 2, 3, 4, 5], timesPerWeek: 5, interval: 1 },
      three_per_week: { frequency: 'weekly', daysOfWeek: [1, 3, 5], timesPerWeek: 3, interval: 1 },
      weekly: { frequency: 'weekly', daysOfWeek: [], timesPerWeek: 1, interval: 1 },
    };
    const recurrence = recurrenceByAnswer[answer];
    if (!recurrence) throw new Error(`routine_invalid_clarification_answer:${question.id}`);
    return RoutineClassifiedItemSchema.parse({ ...item, recurrence });
  }

  const match = answer.trim().match(/^(\d{4}-\d{2}-\d{2})[T ]([0-2]\d:[0-5]\d)$/);
  if (!match) throw new Error(`routine_invalid_clarification_answer:${question.id}`);
  return RoutineClassifiedItemSchema.parse({ ...item, date: match[1], startTime: match[2], isFixed: true });
}

export class RoutineBuilderService {
  private readonly extractor: RoutineSourceExtractorService;
  private readonly classifier: Pick<RoutineClassifierService, 'classify'>;
  private readonly applyService: Pick<RoutineApplyService, 'apply'>;

  constructor(private readonly prisma: any, dependencies: BuilderDependencies = {}) {
    this.extractor = dependencies.extractor ?? new RoutineSourceExtractorService();
    this.classifier = dependencies.classifier ?? {
      classify: (input) => new RoutineClassifierService().classify(input),
    };
    this.applyService = dependencies.applyService ?? new RoutineApplyService(prisma);
  }

  private async event(userId: string, eventName: string, properties: Record<string, unknown>): Promise<void> {
    await this.prisma.eventLog?.create?.({ data: { userId, eventName, properties } }).catch(() => undefined);
  }

  async createSession(userId: string, rawInput: RoutineCreateSessionInput): Promise<any> {
    const input = RoutineCreateSessionSchema.parse(rawInput);
    const focus = input.mode === 'guided' ? input.focus ?? 'Rotina guiada' : input.focus!;
    const session = await this.prisma.routineBuildSession.create({
      data: {
        userId,
        status: 'draft',
        stage: 'source',
        focus,
        weekStart: new Date(`${input.weekStart}T00:00:00.000Z`),
        timezone: input.timezone,
        locale: input.locale,
        constraints: { mode: input.mode, limits: input.limits },
        items: [],
        questions: [],
        answers: [],
      },
    });
    await this.event(userId, 'routine_builder_started', {
      sessionId: session.id,
      weekStart: input.weekStart,
      mode: input.mode,
    });
    return publicSession(session);
  }

  async getSession(userId: string, sessionId: string): Promise<any> {
    const session = await this.prisma.routineBuildSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new Error('routine_session_not_found');
    return publicSession(session);
  }

  async ingestSource(input: {
    userId: string;
    sessionId: string;
    buffer: Buffer;
    mimeType: string;
    fileName?: string | null;
    sourceType: 'text' | 'transcript' | 'file';
  }): Promise<any> {
    const session = await this.prisma.routineBuildSession.findFirst({ where: { id: input.sessionId, userId: input.userId } });
    if (!session) throw new Error('routine_session_not_found');
    const constraints = session.constraints && typeof session.constraints === 'object'
      ? session.constraints as Record<string, unknown>
      : {};
    const mode = constraints.mode === 'guided' ? 'guided' : 'import';
    if (mode === 'guided') throw new Error('routine_session_mode_conflict');
    if (!['draft', 'classified', 'needs_clarification', 'failed'].includes(session.status)) {
      throw new Error('routine_session_source_locked');
    }

    const source = await this.extractor.extract({ buffer: input.buffer, mimeType: input.mimeType, fileName: input.fileName });
    const [objectives, habits, timeline, feedback] = await Promise.all([
      this.prisma.objective.findMany({ where: { userId: input.userId, archived: false }, select: { title: true } }),
      this.prisma.habit.findMany({ where: { userId: input.userId, archived: false }, select: { title: true } }),
      this.prisma.timelineBlock.findMany({ where: { userId: input.userId, status: { notIn: ['done', 'deleted'] } }, select: { title: true, status: true } }),
      AiActionFeedbackService.getRecent(this.prisma, input.userId, 80),
    ]);
    const existingTitles = [...objectives, ...habits, ...timeline].map((item: { title: string }) => item.title);
    const negativeItems = feedback
      .filter((item) => AiActionFeedbackService.blocksFutureSuggestion(item.status))
      .map((item) => ({
        title: item.title,
        state: item.status === 'done' ? 'completed' as const
          : item.status === 'scheduled' ? 'scheduled' as const
            : item.status === 'deleted' ? 'deleted' as const
              : 'rejected' as const,
      }));
    const classified = await this.classifier.classify({
      text: source.text,
      locale: session.locale,
      existingTitles,
      negativeItems,
    });
    const clarification = RoutineClarificationService.build(classified.items);
    const updated = await this.prisma.routineBuildSession.update({
      where: { id: session.id },
      data: {
        status: clarification.needsClarification ? 'needs_clarification' : 'classified',
        stage: 'review',
        sourceType: input.sourceType,
        sourceName: source.fileName,
        sourceMime: source.mimeType,
        sourceHash: source.sha256,
        sourceText: source.text,
        sourceExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        items: classified.items,
        questions: clarification.questions,
        answers: [],
        draftPlan: null,
      },
    });
    await this.event(input.userId, 'routine_builder_source_classified', {
      sessionId: session.id,
      sourceType: input.sourceType,
      itemCount: classified.items.length,
      questionCount: clarification.questions.length,
      truncated: source.truncated,
    });
    return publicSession(updated);
  }

  /**
   * Entrada principal do onboarding guiado: respostas de botão viram itens
   * classificados sem passar por IA nem exigir documento.
   */
  async submitGuidedAnswers(input: {
    userId: string;
    sessionId: string;
    answers: unknown;
    today: string;
  }): Promise<any> {
    const session = await this.prisma.routineBuildSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
    });
    if (!session) throw new Error('routine_session_not_found');

    const constraints = session.constraints && typeof session.constraints === 'object'
      ? session.constraints as Record<string, unknown>
      : {};
    if (constraints.mode !== 'guided') throw new Error('routine_session_mode_conflict');
    if (!['draft', 'classified', 'needs_clarification', 'failed'].includes(session.status)) {
      throw new Error('routine_session_source_locked');
    }

    const answers = RoutineGuidedAnswersSchema.parse(input.answers);
    const items = enrichGuidedItems(
      transformGuidedAnswers({ answers, today: input.today }),
      answers,
      input.today,
    );
    if (items.length === 0) throw new Error('routine_guided_answers_empty');

    const updated = await this.prisma.routineBuildSession.update({
      where: { id: session.id },
      data: {
        status: 'ready',
        // 'review' e não 'compose': ela confere o que a Airia entendeu e tira o
        // que não serve antes da semana ser montada.
        stage: 'review',
        items,
        questions: [],
        answers: [],
        draftPlan: null,
        // Estado e energia ficam na sessão: a composição usa isso para dimensionar
        // a semana de quem ainda não tem check-in salvo.
        constraints: {
          ...constraints,
          declaredState: answers.currentState,
          availability: answers.availability,
          energyDrains: answers.energyDrains,
          energyRestorers: answers.energyRestorers,
        },
      },
    });

    await this.event(input.userId, 'routine_builder_guided_submitted', {
      sessionId: session.id,
      itemCount: items.length,
      habitCount: answers.selectedHabits.length,
      commitmentCount: answers.fixedCommitments.length,
      intentionCount: answers.intentions.length,
    });

    return publicSession(updated);
  }

  async updateItems(input: { userId: string; sessionId: string; items: unknown[] }): Promise<any> {
    const session = await this.prisma.routineBuildSession.findFirst({ where: { id: input.sessionId, userId: input.userId } });
    if (!session) throw new Error('routine_session_not_found');
    if (!['classified', 'needs_clarification', 'ready'].includes(session.status)) throw new Error('routine_session_items_locked');
    const { items } = RoutineUpdateItemsSchema.parse({ items: input.items });
    const clarification = RoutineClarificationService.build(items);
    const hasPending = items.some((item) => item.reviewState === 'pending');
    const status = clarification.needsClarification ? 'needs_clarification' : hasPending ? 'classified' : 'ready';
    const stage = status === 'ready' ? 'compose' : status === 'needs_clarification' ? 'clarify' : 'review';
    const updated = await this.prisma.routineBuildSession.update({
      where: { id: session.id },
      data: { items, questions: clarification.questions, status, stage, draftPlan: null },
    });
    return publicSession(updated);
  }

  async answerClarifications(input: {
    userId: string;
    sessionId: string;
    answers: Array<{ questionId: string; answer: string }>;
  }): Promise<any> {
    const session = await this.prisma.routineBuildSession.findFirst({ where: { id: input.sessionId, userId: input.userId } });
    if (!session) throw new Error('routine_session_not_found');
    if (session.status !== 'needs_clarification') throw new Error('routine_session_not_waiting_for_answers');
    let items = z.array(RoutineClassifiedItemSchema).parse(session.items);
    const questions = z.array(z.object({
      id: z.string(), itemId: z.string(), field: z.enum(['date_and_time', 'recurrence', 'title']),
      answerType: z.enum(['datetime', 'frequency', 'text']), prompt: z.string(), reason: z.string(), priority: z.number(),
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    })).parse(session.questions) as RoutineClarificationQuestion[];

    for (const answer of input.answers) {
      const question = questions.find((candidate) => candidate.id === answer.questionId);
      if (!question) throw new Error(`routine_question_not_found:${answer.questionId}`);
      items = items.map((item) => item.id === question.itemId ? applyAnswer(item, question, answer.answer) : item);
    }
    const remaining = RoutineClarificationService.build(items);
    const hasPending = items.some((item) => item.reviewState === 'pending');
    const status = remaining.needsClarification ? 'needs_clarification' : hasPending ? 'classified' : 'ready';
    const stage = status === 'ready' ? 'compose' : status === 'needs_clarification' ? 'clarify' : 'review';
    const updated = await this.prisma.routineBuildSession.update({
      where: { id: session.id },
      data: {
        items,
        questions: remaining.questions,
        answers: [...(Array.isArray(session.answers) ? session.answers : []), ...input.answers],
        status,
        stage,
      },
    });
    return publicSession(updated);
  }

  async compose(userId: string, sessionId: string): Promise<any> {
    const session = await this.prisma.routineBuildSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new Error('routine_session_not_found');
    if (session.status !== 'ready') throw new Error('routine_session_not_ready');
    const items = z.array(RoutineClassifiedItemSchema).parse(session.items);
    const weekStart = dateOnly(session.weekStart);
    const weekEnd = addDays(weekStart, 6);
    const [blocks, habits, latestCheckin] = await Promise.all([
      this.prisma.timelineBlock.findMany({
        where: { userId, localDate: { gte: new Date(`${weekStart}T00:00:00.000Z`), lte: new Date(`${weekEnd}T00:00:00.000Z`) }, status: { notIn: ['deleted'] } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.habit.findMany({
        where: { userId, archived: false },
        select: {
          id: true,
          title: true,
          frequency: true,
          targetDays: true,
          durationMinutes: true,
          timeOfDay: true,
          reminderTime: true,
        },
      }),
      this.prisma.dailyCheckin.findFirst({
        where: { userId },
        orderBy: [{ localDate: 'desc' }, { recordedAt: 'desc' }],
        select: { energyScore: true, moodScore: true, stateLabel: true, recordedAt: true },
      }),
    ]);
    const sessionConstraints = (session.constraints ?? {}) as any;
    const capacity = deriveRoutineCapacity({
      phaseLabel: latestCheckin?.stateLabel,
      energyScore: latestCheckin?.energyScore,
      recordedAt: latestCheckin?.recordedAt,
      declaredState: readDeclaredState(sessionConstraints.declaredState),
    });
    const limits = sessionConstraints.limits ?? {};
    const guidedAvailability = Array.isArray(sessionConstraints.availability)
      ? sessionConstraints.availability
          .filter((window: any) => (
            Number.isInteger(window?.dayOfWeek)
            && window.dayOfWeek >= 0
            && window.dayOfWeek <= 6
            && /^([01]\d|2[0-3]):[0-5]\d$/.test(window.startTime)
            && /^([01]\d|2[0-3]):[0-5]\d$/.test(window.endTime)
            && window.endTime > window.startTime
          ))
          .flatMap((window: any) => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
            .filter((date) => utcDay(date) === window.dayOfWeek)
            .map((date) => ({
              date,
              startTime: window.startTime,
              endTime: window.endTime,
            })))
      : [];
    const plan = RoutineComposerService.compose({
      weekStart,
      items,
      limits: {
        wakeTime: limits.wakeTime ?? '07:00',
        sleepTime: limits.sleepTime ?? '23:00',
        maxDailyLoadMinutes: limits.maxDailyLoadMinutes ?? 360,
        unavailable: Array.isArray(limits.unavailable) ? limits.unavailable : [],
        available: guidedAvailability,
      },
      existingBlocks: blocks.map((block: any) => ({
        id: block.id,
        date: dateOnly(block.localDate),
        startTime: timeOnly(block.startAt),
        endTime: timeOnly(block.endAt),
        title: block.title,
        isFixed: block.temporalPolicy === 'fixed' || block.adaptationPermission === 'protected',
      })),
      existingHabits: habits.map((habit: any) => ({
        id: habit.id,
        title: habit.title,
        frequency: ['daily', 'weekly', 'monthly'].includes(habit.frequency) ? habit.frequency : 'daily',
        targetDays: Array.isArray(habit.targetDays) ? habit.targetDays : [],
        durationMinutes: habit.durationMinutes,
        timeOfDay: ['morning', 'afternoon', 'evening', 'anytime'].includes(habit.timeOfDay)
          ? habit.timeOfDay
          : null,
        reminderTime: habit.reminderTime,
      })),
      capacity,
    });
    const updated = await this.prisma.routineBuildSession.update({
      where: { id: session.id },
      data: { draftPlan: plan, stage: 'preview' },
    });
    await this.event(userId, 'routine_builder_plan_composed', {
      sessionId,
      scheduledCount: plan.entries.filter((entry) => entry.persist).length,
      unscheduledCount: plan.unscheduled.length,
      capacity: plan.capacity.level,
    });
    return publicSession(updated);
  }

  async apply(userId: string, sessionId: string, sourceItemIds?: string[]): Promise<any> {
    const result = await this.applyService.apply({ userId, sessionId, sourceItemIds });
    await this.event(userId, sourceItemIds?.length ? 'routine_builder_item_applied' : 'routine_builder_applied', {
      sessionId,
      sourceItemIds: sourceItemIds ?? null,
      counts: result.counts,
    });
    return result;
  }

  async purgeExpiredSources(now = new Date()): Promise<number> {
    const result = await this.prisma.routineBuildSession.updateMany({
      where: { sourceText: { not: null }, sourceExpiresAt: { lte: now } },
      data: { sourceText: null, sourceExpiresAt: null },
    });
    return result.count;
  }
}
