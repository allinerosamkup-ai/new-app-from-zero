import type { DailyContext, GroundedTask } from './context-grounding.service';

export type AgendaAdaptationTrigger = 'manual' | 'checkin' | 'cron' | 'home' | 'planner';
export type AgendaAdaptationMode = 'preview' | 'apply';

export type AgendaAdaptationChange = {
  type: 'keep' | 'pause' | 'suggest' | 'skip';
  title: string;
  targetId?: string | null;
  from?: string | null;
  to?: string | null;
  reason: string;
  confidence: number;
};

export type AgendaAdaptationResult = {
  date: string;
  mode: AgendaAdaptationMode;
  trigger: AgendaAdaptationTrigger;
  summary: string;
  changes: AgendaAdaptationChange[];
  blockedSuggestions: string[];
  applied: boolean;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function formatTime(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function phaseFromContext(context: DailyContext, requestContext: Record<string, unknown>): string {
  return cleanText(requestContext.phase) ||
    cleanText(requestContext.phaseLabel) ||
    cleanText(requestContext.moodPhase) ||
    'sem fase definida';
}

function isHeavy(task: GroundedTask): boolean {
  return task.intensity === 'P' || task.category === 'trabalho';
}

function shouldPauseForLowCapacity(phase: string): boolean {
  const key = phase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(turbulencia|pausa|recolhimento|desacelerando)\b/.test(key);
}

export class AgendaAdaptationService {
  static buildPreview(input: {
    dailyContext: DailyContext;
    requestContext?: Record<string, unknown>;
    mode?: AgendaAdaptationMode;
    trigger?: AgendaAdaptationTrigger;
  }): AgendaAdaptationResult {
    const context = input.requestContext ?? {};
    const phase = phaseFromContext(input.dailyContext, context);
    const lowCapacity = shouldPauseForLowCapacity(phase);
    const pendingTasks = input.dailyContext.tasks.filter((task) => task.status !== 'completed');
    const completedTitles = [
      ...input.dailyContext.completedTaskTitles,
      ...input.dailyContext.completedHabitTitles,
      ...input.dailyContext.completedGoalTitles,
      ...input.dailyContext.completedSubgoalTitles,
    ];
    const blockedSuggestions = [
      ...completedTitles,
      ...input.dailyContext.blockedActionTitles,
      ...input.dailyContext.recentSuggestionTitles,
    ].filter(Boolean);

    const changes: AgendaAdaptationChange[] = [];
    for (const task of pendingTasks.slice(0, 8)) {
      const title = cleanText(task.title);
      if (!title) continue;
      const from = formatTime(task.startAt);
      if (lowCapacity && isHeavy(task)) {
        changes.push({
          type: 'pause',
          title,
          from,
          to: null,
          reason: `Fase ${phase}: tarefa pesada fica marcada para revisão antes de entrar no dia.`,
          confidence: 0.78,
        });
      } else {
        changes.push({
          type: 'keep',
          title,
          from,
          to: from,
          reason: from ? 'Compromisso real do dia; manter no radar.' : 'Pendência real do dia; manter como âncora.',
          confidence: 0.84,
        });
      }
    }

    const pendingHabit = input.dailyContext.pendingHabitTitles.find((title) =>
      !blockedSuggestions.some((blocked) => blocked.toLowerCase() === title.toLowerCase()),
    );
    if (pendingHabit && changes.length < 4 && !lowCapacity) {
      changes.push({
        type: 'suggest',
        title: pendingHabit,
        reason: 'Hábito devido hoje e ainda não concluído.',
        confidence: 0.72,
      });
    }

    const summary = changes.length > 0
      ? `Encontrei ${changes.length} ajuste(s) ancorado(s) no dia real.`
      : 'Sem ajuste útil agora: melhor não inventar tarefa.';

    return {
      date: input.dailyContext.date,
      mode: input.mode ?? 'preview',
      trigger: input.trigger ?? 'manual',
      summary,
      changes,
      blockedSuggestions,
      applied: false,
    };
  }
}
