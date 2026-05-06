import { PrismaClient } from '@app/database';
import type { SuggestionMemoryItem } from './suggestion-memory.service';
import { AiActionFeedbackService, type AiActionFeedbackItem } from './ai-action-feedback.service';
import { DecisionEngine, type DecisionSurface } from './decision-engine.service';

type GroundingInput = {
  userId: string;
  type: string;
  context: Record<string, unknown>;
  recentSuggestionItems?: SuggestionMemoryItem[];
  ragContext?: string;
};

export type GroundingLists = {
  pendingTaskTitles: string[];
  completedTaskTitles: string[];
  pendingHabitTitles: string[];
  completedHabitTitles: string[];
  activeGoalTitles: string[];
  completedGoalTitles: string[];
  completedSubgoalTitles: string[];
  recentSuggestionTitles: string[];
  blockedActionTitles: string[];
  todayAnchorTitles: string[];
};

export type DailyContext = GroundingLists & {
  date: string;
  source: 'ContextGroundingService';
  tasks: GroundedTask[];
  habits: GroundedHabit[];
  goals: GroundedGoal[];
  healthSignals?: GroundedHealthSignals | null;
  actionFeedback: AiActionFeedbackItem[];
  postponedActions?: GroundedPostponement[];
  patternMemoryContext: string;
  operationalRule: string;
};

export type GroundedTask = {
  id?: string;
  title: string;
  status: string;
  startAt?: Date;
  endAt?: Date;
  category?: string | null;
  intensity?: string | null;
  isAiSuggested?: boolean | null;
};

export type GroundedHabit = {
  id?: string;
  title: string;
  frequency?: string | null;
  targetDays?: number[] | null;
  targetCount?: number | null;
  completions: Array<{ completionCount?: number | null }>;
};

export type GroundedGoal = {
  id?: string;
  title: string;
  progress: number;
  subgoals: unknown;
};

export type GroundedHealthSignals = {
  source: 'health_connect';
  localDate?: string | null;
  sleepMinutes?: number | null;
  sleepScore?: number | null;
  steps?: number | null;
  avgHeartRate?: number | null;
  exerciseMinutes?: number | null;
  lastSyncedAt?: string | null;
};

export type GroundedPostponement = {
  title: string;
  originalDate?: string | null;
  targetDate?: string | null;
  reason?: string | null;
  postponeCount?: number | null;
  createdAt?: Date | string | null;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(cleanText).filter(Boolean)
    : [];
}

function normalizeDateKey(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return null;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    const key = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function dateRange(dateKey: string) {
  return {
    start: new Date(`${dateKey}T00:00:00.000Z`),
    end: new Date(`${dateKey}T23:59:59.999Z`),
  };
}

function completionCount(completion: { completionCount?: number | null } | null | undefined): number {
  if (!completion) return 0;
  const count = Number(completion.completionCount ?? 1);
  return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
}

function targetCount(value: unknown): number {
  const count = Number(value ?? 1);
  return Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
}

function isHabitDueToday(habit: { frequency?: string | null; targetDays?: number[] | null }, dateKey: string): boolean {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const frequency = habit.frequency ?? 'daily';
  if (frequency === 'daily') return true;
  if (frequency === 'weekly') {
    const days = Array.isArray(habit.targetDays) ? habit.targetDays : [];
    return days.length === 0 || days.includes(date.getUTCDay());
  }
  if (frequency === 'monthly') return date.getUTCDate() === 1;
  return true;
}

function isGoalSubgoalDone(value: unknown): boolean {
  return !!value && typeof value === 'object' && ((value as any).done === true || (value as any).completed === true);
}

function subgoalTitle(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const item = value as Record<string, unknown>;
  return cleanText(item.title) || cleanText(item.text);
}

function feedbackTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      return cleanText((item as Record<string, unknown>).title);
    })
    .filter(Boolean);
}

function actionableFeedbackTitles(items: AiActionFeedbackItem[]): string[] {
  return items
    .filter((item) => AiActionFeedbackService.blocksFutureSuggestion(item.status))
    .map((item) => item.title);
}

function isPostponementLog(value: unknown): value is GroundedPostponement {
  return !!value && typeof value === 'object' && typeof (value as GroundedPostponement).title === 'string';
}

function mergeContextList(existing: unknown, discovered: string[]): string[] {
  return unique([...stringList(existing), ...discovered]);
}

function formatGroundingBlock(lists: GroundingLists & { postponedActions?: GroundedPostponement[] }, dateKey: string, ragContext: string): string {
  const postponementLines = (lists.postponedActions ?? [])
    .slice(0, 5)
    .map((item) => {
      const count = item.postponeCount ? ` (${item.postponeCount}x)` : '';
      const dates = item.originalDate && item.targetDate ? ` ${item.originalDate}->${item.targetDate}` : '';
      return `${item.title}${count}${dates}`;
    });
  const lines = [
    `Data operacional: ${dateKey}.`,
    lists.pendingTaskTitles.length ? `Agenda pendente hoje: ${lists.pendingTaskTitles.join(' | ')}` : 'Agenda pendente hoje: nenhuma.',
    lists.completedTaskTitles.length ? `Agenda concluída hoje: ${lists.completedTaskTitles.join(' | ')}` : '',
    lists.pendingHabitTitles.length ? `Hábitos devidos e pendentes hoje: ${lists.pendingHabitTitles.join(' | ')}` : '',
    lists.completedHabitTitles.length ? `Hábitos feitos hoje: ${lists.completedHabitTitles.join(' | ')}` : '',
    lists.activeGoalTitles.length ? `Metas ativas: ${lists.activeGoalTitles.join(' | ')}` : '',
    lists.completedSubgoalTitles.length ? `Subtarefas já feitas: ${lists.completedSubgoalTitles.join(' | ')}` : '',
    lists.recentSuggestionTitles.length ? `Sugestões recentes para não reciclar: ${lists.recentSuggestionTitles.join(' | ')}` : '',
    lists.blockedActionTitles.length ? `Ações rejeitadas/concluídas pelo card: ${lists.blockedActionTitles.join(' | ')}` : '',
    postponementLines.length ? `Adiamentos recentes para análise de padrão: ${postponementLines.join(' | ')}` : '',
    'Regra de grounding: memórias e histórico explicam padrão; ação nova só pode nascer de agenda pendente, hábito pendente ou meta ativa de hoje.',
    'Regra de compromisso: sugestão opcional pode ser proposta, mas só compromisso real salvo/confirmado pode virar pendência ou notificação.',
    ragContext ? 'Memórias RAG entram como padrão/contexto, não como autorização para inventar tarefa operacional.' : '',
  ].filter(Boolean);

  return `\nGROUNDING OPERACIONAL DA AIRIA:\n${lines.join('\n')}`;
}

function normalizeHealthSignals(value: unknown): GroundedHealthSignals | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const numberOrNull = (raw: unknown) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    source: 'health_connect',
    localDate: cleanText(data.localDate) || null,
    sleepMinutes: numberOrNull(data.sleepMinutes),
    sleepScore: numberOrNull(data.sleepScore),
    steps: numberOrNull(data.steps),
    avgHeartRate: numberOrNull(data.avgHeartRate),
    exerciseMinutes: numberOrNull(data.exerciseMinutes),
    lastSyncedAt: cleanText(data.syncedAt) || cleanText(data.lastSyncedAt) || null,
  };
}

function surfaceFromType(type: string): DecisionSurface {
  if (type === 'stability-analysis' || type === 'home-messages') return 'home';
  if (type === 'checkin-response' || type === 'day-tasks') return 'checkin';
  if (type === 'agenda-blocks' || type === 'agenda-adapt') return 'planner';
  if (type === 'journal' || type === 'journal-tasks') return 'journal';
  if (type === 'weekly-insight' || type === 'monthly-report') return 'insights';
  if (type === 'aura-command') return 'aura-chat';
  return 'agenda';
}

export class ContextGroundingService {
  constructor(private readonly prisma: PrismaClient) {}

  async buildDailyContext(input: GroundingInput): Promise<DailyContext> {
    const dateKey = normalizeDateKey(input.context.localDate) ?? new Date().toISOString().slice(0, 10);
    const { start, end } = dateRange(dateKey);

    const prismaAny = this.prisma as any;

    const [rawTasks, rawHabits, rawGoals, actionFeedback, rawPostponements, rawHealthSignals] = await Promise.all([
      prismaAny.timelineBlock?.findMany ? prismaAny.timelineBlock.findMany({
        where: { userId: input.userId, localDate: { gte: start, lte: end } },
        orderBy: { startAt: 'asc' },
        select: { id: true, title: true, status: true, startAt: true, endAt: true, category: true, intensity: true, isAiSuggested: true },
      }).catch(() => []) : Promise.resolve([]),
      prismaAny.habit?.findMany ? prismaAny.habit.findMany({
        where: { userId: input.userId, archived: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          frequency: true,
          targetDays: true,
          targetCount: true,
          completions: {
            where: { date: { gte: start, lte: end } },
            select: { completionCount: true },
          },
        },
      }).catch(() => []) : Promise.resolve([]),
      prismaAny.objective?.findMany ? prismaAny.objective.findMany({
        where: { userId: input.userId, archived: false },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: { id: true, title: true, progress: true, subgoals: true },
      }).catch(() => []) : Promise.resolve([]),
      AiActionFeedbackService.getRecent(prismaAny, input.userId).catch(() => []),
      prismaAny.eventLog?.findMany ? prismaAny.eventLog.findMany({
        where: { userId: input.userId, eventName: 'timeline.block_postponed' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { properties: true, createdAt: true },
      }).then((rows: Array<{ properties: unknown; createdAt: Date }>) => rows
        .map((row) => {
          const properties = row.properties as Record<string, unknown>;
          return {
            title: cleanText(properties?.title),
            originalDate: cleanText(properties?.originalDate) || null,
            targetDate: cleanText(properties?.targetDate) || null,
            reason: cleanText(properties?.reason) || null,
            postponeCount: Number.isFinite(Number(properties?.postponeCount)) ? Number(properties?.postponeCount) : null,
            createdAt: row.createdAt,
          };
        })
        .filter(isPostponementLog)).catch(() => []) : Promise.resolve([]),
      prismaAny.eventLog?.findFirst ? prismaAny.eventLog.findFirst({
        where: {
          userId: input.userId,
          eventName: 'health_connect.synced',
          OR: [
            { createdAt: { gte: start, lte: end } },
            { createdAt: { gte: new Date(start.getTime() - 36 * 60 * 60 * 1000) } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { properties: true, createdAt: true },
      }).then((row: { properties: unknown; createdAt: Date } | null) => {
        const signals = normalizeHealthSignals(row?.properties);
        return signals ? { ...signals, lastSyncedAt: signals.lastSyncedAt ?? row?.createdAt?.toISOString?.() ?? null } : null;
      }).catch(() => null) : Promise.resolve(null),
    ]);

    const tasks = rawTasks as GroundedTask[];
    const habits = rawHabits as GroundedHabit[];
    const goals = rawGoals as GroundedGoal[];
    const postponedActions = rawPostponements as GroundedPostponement[];

    const pendingTaskTitles = unique(tasks.filter((task) => task.status !== 'completed').map((task) => task.title));
    const completedTaskTitles = unique(tasks.filter((task) => task.status === 'completed').map((task) => task.title));

    const dueHabits = habits.filter((habit) => isHabitDueToday(habit, dateKey));
    const completedHabitTitles = unique(dueHabits
      .filter((habit) => habit.completions.reduce((sum, completion) => sum + completionCount(completion), 0) >= targetCount(habit.targetCount))
      .map((habit) => habit.title));
    const pendingHabitTitles = unique(dueHabits
      .filter((habit) => habit.completions.reduce((sum, completion) => sum + completionCount(completion), 0) < targetCount(habit.targetCount))
      .map((habit) => habit.title));

    const activeGoalTitles = unique(goals.filter((goal) => goal.progress < 100).map((goal) => goal.title));
    const completedGoalTitles = unique(goals.filter((goal) => goal.progress >= 100).map((goal) => goal.title));
    const completedSubgoalTitles = unique(goals.flatMap((goal) => {
      const subgoals = Array.isArray(goal.subgoals) ? goal.subgoals : [];
      return subgoals.filter(isGoalSubgoalDone).map(subgoalTitle);
    }));

    const recentSuggestionTitles = unique((input.recentSuggestionItems ?? []).map((item) => item.text));
    const blockedActionTitles = unique([
      ...stringList(input.context.blockedActionTitles),
      ...feedbackTitles(input.context.homeAutonomyFeedback),
      ...actionableFeedbackTitles(actionFeedback),
    ]);

    return {
      source: 'ContextGroundingService',
      date: dateKey,
      pendingTaskTitles,
      completedTaskTitles,
      pendingHabitTitles,
      completedHabitTitles,
      activeGoalTitles,
      completedGoalTitles,
      completedSubgoalTitles,
      recentSuggestionTitles,
      blockedActionTitles,
      todayAnchorTitles: unique([
        ...stringList(input.context.pendingTasks),
        ...stringList(input.context.pendingTaskTitles),
        ...stringList(input.context.pendingHabitTitles),
        ...stringList(input.context.goals),
        ...pendingTaskTitles,
        ...pendingHabitTitles,
        ...activeGoalTitles,
      ]),
      tasks,
      habits,
      goals,
      healthSignals: rawHealthSignals as GroundedHealthSignals | null,
      actionFeedback,
      postponedActions,
      patternMemoryContext: cleanText(input.ragContext),
      operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
    };
  }

  async buildForSuggest(input: GroundingInput): Promise<Record<string, unknown>> {
    const lists = await this.buildDailyContext(input);
    const dateKey = lists.date;
    const decisionBrain = DecisionEngine.evaluate({
      dailyContext: lists,
      surface: surfaceFromType(input.type),
      requestContext: input.context,
    });

    const groundingContext = formatGroundingBlock(lists, dateKey, cleanText(input.ragContext));
    const mergedGoals = mergeContextList(input.context.goals, lists.activeGoalTitles);

    return {
      ...input.context,
      localDate: dateKey,
      goals: mergedGoals,
      pendingTasks: mergeContextList(input.context.pendingTasks, lists.pendingTaskTitles),
      pendingTaskTitles: mergeContextList(input.context.pendingTaskTitles, lists.pendingTaskTitles),
      completedTaskTitles: mergeContextList(input.context.completedTaskTitles, lists.completedTaskTitles),
      pendingHabitTitles: mergeContextList(input.context.pendingHabitTitles, lists.pendingHabitTitles),
      completedHabitTitles: mergeContextList(input.context.completedHabitTitles, lists.completedHabitTitles),
      completedGoalTitles: mergeContextList(input.context.completedGoalTitles, lists.completedGoalTitles),
      completedSubgoalTitles: mergeContextList(input.context.completedSubgoalTitles, lists.completedSubgoalTitles),
      blockedActionTitles: mergeContextList(input.context.blockedActionTitles, [...lists.blockedActionTitles, ...lists.recentSuggestionTitles]),
      todayAnchorTitles: mergeContextList(input.context.todayAnchorTitles, lists.todayAnchorTitles),
      groundingContext,
      decisionBrain,
      allowedActionTitles: decisionBrain.allowedActions.map((action) => action.title),
      blockedDecisionTitles: decisionBrain.blockedActions.map((action) => action.title),
      grounding: {
        type: input.type,
        ...lists,
        decisionBrain,
      },
    };
  }
}
