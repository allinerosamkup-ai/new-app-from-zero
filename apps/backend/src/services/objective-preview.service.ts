import { getSaoPauloDateContext } from '../lib/notification-filters';
import type { GoalDecomposition } from './goal-intelligence.service';

export type PreviewTask = {
  id: string;
  title: string;
  doneWhen: string;
  estimatedMinutes: number;
  effortSize: 'small' | 'medium' | 'large';
  level: 1 | 2 | 3;
  milestoneId?: string;
  parentId?: string | null;
  basedOn: 'stated' | 'inferred';
};

export type BreakdownPreview = {
  suggestedTitle: string;
  resultDefinition: string | null;
  currentReality: string | null;
  question: string | null;
  milestones: Array<{ id: string; title: string; order: number; doneWhen: string }>;
  tasks: PreviewTask[];
  conflicts: Array<{ task: string; reason: string; suggestion: string }>;
};

export type DatedAction = {
  id: string;
  title: string;
  scheduledFor?: string | null;
  effortSize?: 'small' | 'medium' | 'large' | null;
  done?: boolean;
};

export type RescheduleMove = {
  actionId: string;
  title: string;
  from: string | null;
  to: string;
};

export type ReschedulePreview = {
  moves: RescheduleMove[];
  conflicts: Array<{ actionId: string; reason: string }>;
  unmatched: string[];
};

const EFFORT_MINUTES: Record<'small' | 'medium' | 'large', number> = {
  small: 25,
  medium: 60,
  large: 120,
};

const WEEKDAY_TOKENS: Array<{ keys: string[]; day: number }> = [
  { keys: ['domingo', 'sunday'], day: 0 },
  { keys: ['segunda', 'monday'], day: 1 },
  { keys: ['terca', 'terça', 'tuesday'], day: 2 },
  { keys: ['quarta', 'wednesday'], day: 3 },
  { keys: ['quinta', 'thursday'], day: 4 },
  { keys: ['sexta', 'friday'], day: 5 },
  { keys: ['sabado', 'sábado', 'saturday'], day: 6 },
];

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextWeekday(fromKey: string, fromWeekday: number, target: number): string {
  const delta = (target - fromWeekday + 7) % 7 || 7;
  return addDays(fromKey, delta);
}

export function effortToMinutes(effort?: 'small' | 'medium' | 'large' | null): number {
  return EFFORT_MINUTES[effort ?? 'small'];
}

export function mapDecompositionToPreview(input: {
  title: string;
  decomposition: GoalDecomposition;
}): BreakdownPreview {
  const title = input.title.trim();
  const decomposition = input.decomposition;
  const tasks: PreviewTask[] = [];
  const milestones = (decomposition.milestones ?? []).map((milestone, index) => ({
    id: milestone.id || `milestone-${index + 1}`,
    title: milestone.title,
    order: milestone.order ?? index,
    doneWhen: milestone.doneWhen,
  }));

  milestones.forEach((milestone, index) => {
    tasks.push({
      id: milestone.id,
      title: milestone.title,
      doneWhen: milestone.doneWhen,
      estimatedMinutes: effortToMinutes('medium'),
      effortSize: 'medium',
      level: 1,
      basedOn: 'inferred',
    });
    const nested = (decomposition.milestones[index]?.actions?.length
      ? decomposition.milestones[index].actions
      : index === 0 ? decomposition.steps : []);
    nested.forEach((step, stepIndex) => {
      const effort = step.effortSize ?? 'small';
      tasks.push({
        id: `${milestone.id}-action-${stepIndex + 1}`,
        title: step.title,
        doneWhen: step.doneWhen ?? `“${step.title}” estiver concluído`,
        estimatedMinutes: effortToMinutes(effort),
        effortSize: effort,
        level: 2,
        milestoneId: milestone.id,
        parentId: milestone.id,
        basedOn: step.basedOn,
      });
    });
  });

  if (milestones.length === 0) {
    decomposition.steps.forEach((step, index) => {
      const effort = step.effortSize ?? 'small';
      tasks.push({
        id: `action-${index + 1}`,
        title: step.title,
        doneWhen: step.doneWhen ?? `“${step.title}” estiver concluído`,
        estimatedMinutes: effortToMinutes(effort),
        effortSize: effort,
        level: 2,
        basedOn: step.basedOn,
      });
    });
  }

  return {
    suggestedTitle: title,
    resultDefinition: decomposition.resultDefinition,
    currentReality: decomposition.currentReality,
    question: decomposition.mode === 'question' ? decomposition.question : null,
    milestones,
    tasks,
    conflicts: (decomposition.rejectedSteps ?? []).map((item) => ({
      task: item.title,
      reason: item.reason,
      suggestion: 'Removida do preview. Confirme o restante ou edite à mão.',
    })),
  };
}

export function previewReschedule(input: {
  naturalLanguage: string;
  actions: DatedAction[];
  now?: Date;
}): ReschedulePreview {
  const text = input.naturalLanguage.trim();
  const folded = fold(text);
  const today = getSaoPauloDateContext(input.now ?? new Date());
  const weekdayHits = WEEKDAY_TOKENS
    .filter((entry) => entry.keys.some((key) => folded.includes(fold(key))))
    .map((entry) => nextWeekday(today.dateKey, today.weekday, entry.day));

  if (/\bhoje\b/.test(folded)) weekdayHits.unshift(today.dateKey);
  if (/\bamanha\b/.test(folded)) weekdayHits.push(addDays(today.dateKey, 1));

  const dates = [...new Set(weekdayHits)];
  const openActions = input.actions.filter((action) => !action.done);
  const mentioned = openActions.filter((action) => {
    const title = fold(action.title);
    if (title.length < 4) return false;
    return folded.includes(title) || title.split(' ').filter((part) => part.length >= 4).some((part) => folded.includes(part));
  });

  const unmatched: string[] = [];
  if (mentioned.length === 0) unmatched.push(text);
  if (dates.length === 0) {
    return { moves: [], conflicts: [], unmatched: mentioned.length ? ['data'] : unmatched };
  }

  const targets = mentioned.length > 0 ? mentioned : [];
  const moves: RescheduleMove[] = targets.map((action, index) => ({
    actionId: action.id,
    title: action.title,
    from: action.scheduledFor ?? null,
    to: dates[Math.min(index, dates.length - 1)],
  }));

  const loadByDay = new Map<string, DatedAction[]>();
  for (const action of openActions) {
    if (!action.scheduledFor) continue;
    const list = loadByDay.get(action.scheduledFor) ?? [];
    list.push(action);
    loadByDay.set(action.scheduledFor, list);
  }

  const conflicts: Array<{ actionId: string; reason: string }> = [];
  for (const move of moves) {
    const occupying = (loadByDay.get(move.to) ?? []).filter((action) => action.id !== move.actionId);
    const heavy = occupying.filter((action) => action.effortSize === 'medium' || action.effortSize === 'large');
    if (heavy.length >= 2) {
      conflicts.push({
        actionId: move.actionId,
        reason: `Esse dia já tem ${heavy.length} ações pesadas. Confirme se ainda cabe.`,
      });
    }
  }

  return { moves, conflicts, unmatched };
}

export function previewTasksToSubgoals(tasks: PreviewTask[]) {
  return tasks
    .filter((task) => task.level !== 1)
    .map((task, index) => ({
      id: task.id,
      title: task.title,
      done: false,
      order: index,
      aiGenerated: true,
      milestoneId: task.milestoneId ?? null,
      parentId: task.level === 3 ? task.parentId ?? null : null,
      doneWhen: task.doneWhen,
      effortSize: task.effortSize,
      basedOn: task.basedOn,
    }));
}
