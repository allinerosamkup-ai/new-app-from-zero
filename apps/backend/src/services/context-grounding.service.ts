import { PrismaClient } from '@app/database';
import type { SuggestionMemoryItem } from './suggestion-memory.service';
import { AiActionFeedbackService, type AiActionFeedbackItem } from './ai-action-feedback.service';
import { DecisionEngine, type DecisionSurface } from './decision-engine.service';
import type { AdaptiveAgendaPlan } from './adaptive-agenda-engine.service';
import { PRODUCT_CAPABILITIES } from '../contracts/product-capabilities';
import {
  resolveTimelineAdaptability,
  type AdaptationPermission,
  type TemporalPolicy,
} from './planner.service';
import {
  inferTimelineAdaptability,
  type AdaptabilityInferenceSource,
} from './timeline-adaptability-inference.service';

type GroundingInput = {
  userId: string;
  type: string;
  context: Record<string, unknown>;
  recentSuggestionItems?: SuggestionMemoryItem[];
  ragContext?: string;
  adaptivePlan?: AdaptiveAgendaPlan | null;
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
  blockedActionTargetIds?: string[];
  blockedActionCanonicalKeys?: string[];
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
  repeatedSnoozes?: GroundedRepeatedSnooze[];
  // null = nunca fez check-in; 0 = hoje; N = dias desde o último (sempre preenchido pelo serviço)
  daysSinceLastCheckin?: number | null;
  // Fase do ciclo menstrual estimada a partir do histórico de checkins
  menstrualPhaseLabel?: string | null;
  menstrualCycleDay?: number | null;
  patternMemoryContext: string;
  operationalRule: string;
};

export type GroundedRepeatedSnooze = {
  blockId: string;
  title: string;
  snoozeCount: number;
  lastSnoozedAt: string;
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
  gcalEventId?: string | null;
  temporalPolicy?: TemporalPolicy | null;
  adaptationPermission?: AdaptationPermission | null;
  adaptabilitySource?: string | null;
  adaptabilityConfidence?: number | null;
  recurring?: unknown;
  adaptabilityInferenceSource?: AdaptabilityInferenceSource;
  adaptabilityInferenceConfidence?: number;
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
  blockId?: string | null;
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

function formatCheckinAbsenceLine(daysSinceLastCheckin: number | null | undefined): string {
  if (typeof daysSinceLastCheckin !== 'number' || daysSinceLastCheckin < 2) return '';
  return `Sinal de ausência: ${daysSinceLastCheckin} dias sem check-in. Para este público, ausência é dado provável de fase baixa ou sobrecarga — nunca falha. Proibido cobrar, mencionar sequência perdida ou pedir registro retroativo. Acolher a volta em no máximo 1 frase curta e reduzir a carga sugerida para hoje.`;
}

function formatGroundingBlock(lists: GroundingLists & { postponedActions?: GroundedPostponement[]; repeatedSnoozes?: GroundedRepeatedSnooze[]; daysSinceLastCheckin?: number | null; menstrualPhaseLabel?: string | null; menstrualCycleDay?: number | null }, dateKey: string, ragContext: string): string {
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
    (lists.repeatedSnoozes ?? []).length > 0
      ? `Padrão de Deriva detectado (mesma tarefa pausada 3+ vezes): ${(lists.repeatedSnoozes ?? []).map(s => `${s.title} (${s.snoozeCount}x)`).join(' | ')} — Airia pode propor renegociar o horário desta tarefa de forma definitiva.`
      : '',
    formatCheckinAbsenceLine(lists.daysSinceLastCheckin),
    lists.menstrualPhaseLabel
      ? `Ciclo menstrual: ${lists.menstrualPhaseLabel}${lists.menstrualCycleDay !== null ? ` (D${lists.menstrualCycleDay})` : ''} — usar como modulador biológico ao interpretar energia e humor, não como tema central.`
      : '',
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

function serializeAdaptivePlan(plan: AdaptiveAgendaPlan | null | undefined): string | null {
  if (!plan || plan.decisions.length === 0) return null;
  const lines: string[] = [`Plano adaptativo — ${plan.date} (fase: ${plan.trigger})`];
  for (const d of plan.decisions) {
    const time = d.suggestedStartTime ? ` → ${d.suggestedStartTime}` : '';
    lines.push(`[${d.type.toUpperCase()}] ${d.title}${time} — ${d.reason}`);
  }
  if (plan.blocked.length > 0) {
    lines.push(`Bloqueados: ${plan.blocked.map((b) => b.title).join(', ')}`);
  }
  return lines.join('\n');
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
  private readonly capabilities: { planner: boolean; habits: boolean };

  constructor(
    private readonly prisma: PrismaClient,
    capabilities: { planner?: boolean; habits?: boolean } = PRODUCT_CAPABILITIES,
  ) {
    this.capabilities = {
      planner: capabilities.planner ?? true,
      habits: capabilities.habits ?? true,
    };
  }

  /** Detecta a fase do ciclo menstrual a partir do histórico de checkins recentes.
   *  Retorna label e dia do ciclo estimado, ou null se não houver dados. */
  private detectMenstrualPhase(checkins: Array<{ localDate: Date; isFlowing: boolean | null }>): { label: string; cycleDay: number } | null {
    // Ordena do mais antigo ao mais recente
    const sorted = [...checkins].sort((a, b) => a.localDate.getTime() - b.localDate.getTime());

    // Encontra a entrada mais recente com isFlowing = true
    const lastFlowing = [...sorted].reverse().find(c => c.isFlowing === true);
    if (!lastFlowing) return null;

    // Encontra o início do episódio (primeiro dia consecutivo de fluxo)
    const lastFlowingIdx = sorted.findIndex(c => c.localDate.getTime() === lastFlowing.localDate.getTime());
    let flowStartIdx = lastFlowingIdx;
    for (let i = lastFlowingIdx - 1; i >= 0; i--) {
      if (sorted[i].isFlowing === true) flowStartIdx = i;
      else break;
    }
    const flowStartDate = sorted[flowStartIdx].localDate;

    const msPerDay = 86_400_000;
    const daysSince = Math.round((Date.now() - flowStartDate.getTime()) / msPerDay);
    if (daysSince < 0 || daysSince > 34) return null;

    const cycleDay = daysSince + 1;
    let label: string;
    if (cycleDay <= 5)       label = 'Menstruação';
    else if (cycleDay <= 13) label = 'Pós-menstruação';
    else if (cycleDay <= 16) label = 'Ovulação';
    else if (cycleDay <= 22) label = 'Pós-ovulação';
    else                     label = 'TPM';

    return { label, cycleDay };
  }

  async buildDailyContext(input: GroundingInput): Promise<DailyContext> {
    const dateKey = normalizeDateKey(input.context.localDate) ?? new Date().toISOString().slice(0, 10);
    const { start, end } = dateRange(dateKey);

    const prismaAny = this.prisma as any;

    const [rawTasks, rawHabits, rawGoals, actionFeedback, rawPostponements, rawHealthSignals, rawLastCheckin, rawSnoozeEvents, rawFlowCheckins, rawNegativeMemories] = await Promise.all([
      this.capabilities.planner && prismaAny.timelineBlock?.findMany ? prismaAny.timelineBlock.findMany({
        where: { userId: input.userId, localDate: { gte: start, lte: end } },
        orderBy: { startAt: 'asc' },
        select: {
          id: true,
          title: true,
          status: true,
          startAt: true,
          endAt: true,
          category: true,
          intensity: true,
          isAiSuggested: true,
          gcalEventId: true,
          temporalPolicy: true,
          adaptationPermission: true,
          adaptabilitySource: true,
          adaptabilityConfidence: true,
          recurring: true,
        },
      }).catch(() => []) : Promise.resolve([]),
      this.capabilities.habits && prismaAny.habit?.findMany ? prismaAny.habit.findMany({
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
      this.capabilities.planner && prismaAny.eventLog?.findMany ? prismaAny.eventLog.findMany({
        where: { userId: input.userId, eventName: 'timeline.block_postponed' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { properties: true, createdAt: true },
      }).then((rows: Array<{ properties: unknown; createdAt: Date }>) => rows
        .map((row) => {
          const properties = row.properties as Record<string, unknown>;
          return {
            blockId: cleanText(properties?.blockId) || null,
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
      prismaAny.dailyCheckin?.findFirst ? prismaAny.dailyCheckin.findFirst({
        where: { userId: input.userId, localDate: { lte: end } },
        orderBy: { localDate: 'desc' },
        select: { localDate: true },
      }).catch(() => null) : Promise.resolve(null),
      // Eventos de Deriva (snooze) dos últimos 14 dias — para detectar padrão recorrente
      this.capabilities.planner && prismaAny.eventLog?.findMany ? prismaAny.eventLog.findMany({
        where: {
          userId: input.userId,
          eventName: 'timeline.block_snoozed',
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: { properties: true, createdAt: true },
      }).catch(() => []) : Promise.resolve([]),
      // Checkins dos últimos 35 dias com isFlowing para detectar fase menstrual
      prismaAny.dailyCheckin?.findMany ? prismaAny.dailyCheckin.findMany({
        where: {
          userId: input.userId,
          localDate: { gte: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { localDate: 'asc' },
        select: { localDate: true, isFlowing: true },
      }).catch(() => []) : Promise.resolve([]),
      prismaAny.userMemory?.findMany ? prismaAny.userMemory.findMany({
        where: {
          userId: input.userId,
          lifecycle: 'active',
          negativeState: { not: null },
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
        select: { targetId: true, canonicalKey: true, content: true },
        take: 100,
      }).catch(() => []) : Promise.resolve([]),
    ]);

    const lastCheckinKey = normalizeDateKey((rawLastCheckin as { localDate?: Date } | null)?.localDate);
    let daysSinceLastCheckin: number | null = null;
    if (lastCheckinKey) {
      const diffMs = new Date(`${dateKey}T00:00:00.000Z`).getTime() - new Date(`${lastCheckinKey}T00:00:00.000Z`).getTime();
      daysSinceLastCheckin = Math.max(0, Math.round(diffMs / 86_400_000));
    }

    const postponedBlockIds = new Set((rawPostponements as GroundedPostponement[])
      .map((postponement) => postponement.blockId)
      .filter((blockId): blockId is string => Boolean(blockId)));
    const tasks = (rawTasks as GroundedTask[]).map((task) => {
      const persisted = resolveTimelineAdaptability(task);
      const inference = inferTimelineAdaptability({
        ...task,
        ...persisted,
        manualOverride: task.adaptabilitySource === 'manual',
        wasPostponed: Boolean(task.id && postponedBlockIds.has(task.id)),
      });
      const inferredSource = inference.inferenceSource === 'google_calendar' ? 'gcal'
        : inference.inferenceSource === 'recurring_schedule' ? 'recurrence'
          : inference.inferenceSource === 'commitment_pattern' ? 'language'
            : inference.inferenceSource === 'ai_suggestion' ? 'ai'
              : inference.inferenceSource === 'postponed_task' ? 'behavior'
                : inference.inferenceSource === 'manual_override' ? 'manual'
                  : 'default';
      return {
        ...task,
        temporalPolicy: inference.temporalPolicy,
        adaptationPermission: inference.adaptationPermission,
        adaptabilityInferenceSource: inference.inferenceSource,
        adaptabilityInferenceConfidence: inference.inferenceConfidence,
        adaptabilitySource: inferredSource,
        adaptabilityConfidence: inference.inferenceConfidence,
      };
    });
    const habits = rawHabits as GroundedHabit[];
    const goals = rawGoals as GroundedGoal[];
    const postponedActions = rawPostponements as GroundedPostponement[];

    // Agrupar eventos de snooze por blockId e detectar padrão recorrente (3+)
    const snoozeCountMap = new Map<string, { title: string; count: number; lastAt: string }>();
    for (const row of (rawSnoozeEvents as Array<{ properties: unknown; createdAt: Date }>)) {
      const props = row.properties as Record<string, unknown>;
      const blockId = cleanText(props?.blockId);
      const title = cleanText(props?.title);
      if (!blockId || !title) continue;
      const existing = snoozeCountMap.get(blockId);
      if (existing) {
        existing.count += 1;
      } else {
        snoozeCountMap.set(blockId, { title, count: 1, lastAt: row.createdAt.toISOString() });
      }
    }
    const repeatedSnoozes: GroundedRepeatedSnooze[] = [];
    for (const [blockId, info] of snoozeCountMap.entries()) {
      if (info.count >= 3) {
        repeatedSnoozes.push({ blockId, title: info.title, snoozeCount: info.count, lastSnoozedAt: info.lastAt });
      }
    }

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
    const blockedActionTargetIds = unique((rawNegativeMemories as Array<{ targetId?: string | null }>).map((item) => item.targetId ?? ''));
    const blockedActionCanonicalKeys = unique((rawNegativeMemories as Array<{ canonicalKey?: string | null }>).map((item) => item.canonicalKey ?? ''));

    // Fase menstrual estimada a partir do histórico de fluxo
    const menstrualPhaseResult = this.detectMenstrualPhase(
      (rawFlowCheckins as Array<{ localDate: Date; isFlowing: boolean | null }>)
    );

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
      blockedActionTargetIds,
      blockedActionCanonicalKeys,
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
      repeatedSnoozes,
      daysSinceLastCheckin,
      menstrualPhaseLabel: menstrualPhaseResult?.label ?? null,
      menstrualCycleDay: menstrualPhaseResult?.cycleDay ?? null,
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

    const adaptivePlanSummary = serializeAdaptivePlan(input.adaptivePlan);

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
      blockedActionTargetIds: mergeContextList(input.context.blockedActionTargetIds, lists.blockedActionTargetIds ?? []),
      blockedActionCanonicalKeys: mergeContextList(input.context.blockedActionCanonicalKeys, lists.blockedActionCanonicalKeys ?? []),
      todayAnchorTitles: mergeContextList(input.context.todayAnchorTitles, lists.todayAnchorTitles),
      daysSinceLastCheckin: lists.daysSinceLastCheckin,
      groundingContext,
      decisionBrain,
      allowedActionTitles: decisionBrain.allowedActions.map((action) => action.title),
      blockedDecisionTitles: decisionBrain.blockedActions.map((action) => action.title),
      adaptivePlanSummary,
      grounding: {
        type: input.type,
        ...lists,
        decisionBrain,
      },
    };
  }
}
