import { PrismaClient } from '@app/database';
import type { SuggestionMemoryItem } from './suggestion-memory.service';

type GroundingInput = {
  userId: string;
  type: string;
  context: Record<string, unknown>;
  recentSuggestionItems?: SuggestionMemoryItem[];
  ragContext?: string;
};

type GroundingLists = {
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

type GroundedTask = {
  title: string;
  status: string;
};

type GroundedHabit = {
  title: string;
  frequency?: string | null;
  targetDays?: number[] | null;
  targetCount?: number | null;
  completions: Array<{ completionCount?: number | null }>;
};

type GroundedGoal = {
  title: string;
  progress: number;
  subgoals: unknown;
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

function mergeContextList(existing: unknown, discovered: string[]): string[] {
  return unique([...stringList(existing), ...discovered]);
}

function formatGroundingBlock(lists: GroundingLists, dateKey: string, ragContext: string): string {
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
    'Regra de grounding: memórias e histórico explicam padrão; ação nova só pode nascer de agenda pendente, hábito pendente ou meta ativa de hoje.',
    ragContext ? 'Memórias RAG entram como padrão/contexto, não como autorização para inventar tarefa operacional.' : '',
  ].filter(Boolean);

  return `\nGROUNDING OPERACIONAL DA AIRIA:\n${lines.join('\n')}`;
}

export class ContextGroundingService {
  constructor(private readonly prisma: PrismaClient) {}

  async buildForSuggest(input: GroundingInput): Promise<Record<string, unknown>> {
    const dateKey = normalizeDateKey(input.context.localDate) ?? new Date().toISOString().slice(0, 10);
    const { start, end } = dateRange(dateKey);

    const prismaAny = this.prisma as any;

    const [rawTasks, rawHabits, rawGoals] = await Promise.all([
      prismaAny.timelineBlock?.findMany ? prismaAny.timelineBlock.findMany({
        where: { userId: input.userId, localDate: { gte: start, lte: end } },
        orderBy: { startAt: 'asc' },
        select: { title: true, status: true },
      }).catch(() => []) : Promise.resolve([]),
      prismaAny.habit?.findMany ? prismaAny.habit.findMany({
        where: { userId: input.userId, archived: false },
        orderBy: { createdAt: 'asc' },
        select: {
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
        select: { title: true, progress: true, subgoals: true },
      }).catch(() => []) : Promise.resolve([]),
    ]);

    const tasks = rawTasks as GroundedTask[];
    const habits = rawHabits as GroundedHabit[];
    const goals = rawGoals as GroundedGoal[];

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
    ]);

    const lists: GroundingLists = {
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
    };

    const groundingContext = formatGroundingBlock(lists, dateKey, cleanText(input.ragContext));
    const mergedGoals = mergeContextList(input.context.goals, activeGoalTitles);

    return {
      ...input.context,
      localDate: dateKey,
      goals: mergedGoals,
      pendingTasks: mergeContextList(input.context.pendingTasks, pendingTaskTitles),
      pendingTaskTitles: mergeContextList(input.context.pendingTaskTitles, pendingTaskTitles),
      completedTaskTitles: mergeContextList(input.context.completedTaskTitles, completedTaskTitles),
      pendingHabitTitles: mergeContextList(input.context.pendingHabitTitles, pendingHabitTitles),
      completedHabitTitles: mergeContextList(input.context.completedHabitTitles, completedHabitTitles),
      completedGoalTitles: mergeContextList(input.context.completedGoalTitles, completedGoalTitles),
      completedSubgoalTitles: mergeContextList(input.context.completedSubgoalTitles, completedSubgoalTitles),
      blockedActionTitles: mergeContextList(input.context.blockedActionTitles, [...blockedActionTitles, ...recentSuggestionTitles]),
      todayAnchorTitles: mergeContextList(input.context.todayAnchorTitles, lists.todayAnchorTitles),
      groundingContext,
      grounding: {
        source: 'ContextGroundingService',
        type: input.type,
        date: dateKey,
        ...lists,
        patternMemoryContext: cleanText(input.ragContext),
        operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
      },
    };
  }
}
