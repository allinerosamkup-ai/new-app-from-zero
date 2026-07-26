import type { RoutineBuilderStep, RoutinePlan, RoutinePlanEntry, RoutineSession } from './types';

export function shouldRestoreRoutineSession(incoming: { initialSource?: string; focus?: string }): boolean {
  return !incoming.initialSource?.trim() && !incoming.focus?.trim();
}

export function nextBuilderStep(session: Pick<RoutineSession, 'status' | 'stage' | 'draftPlan'>): RoutineBuilderStep {
  if (session.status === 'applied') return 'done';
  if (session.draftPlan) return 'preview';
  if (session.stage === 'review') return 'review';
  if (session.stage === 'clarify') return 'clarify';
  if (session.stage === 'compose' || session.status === 'ready') return 'compose';
  return 'source';
}

export function groupPlanByDay(entries: RoutinePlanEntry[]): Array<{ date: string; entries: RoutinePlanEntry[] }> {
  const grouped = new Map<string, RoutinePlanEntry[]>();
  for (const entry of [...entries].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))) {
    const current = grouped.get(entry.date) ?? [];
    current.push(entry);
    grouped.set(entry.date, current);
  }
  return [...grouped.entries()].map(([date, dayEntries]) => ({ date, entries: dayEntries }));
}

export function buildRoutinePreviewSections(plan: RoutinePlan, today: string): {
  today: RoutinePlanEntry[];
  week: RoutinePlanEntry[];
  habits: RoutinePlanEntry[];
  objectives: RoutinePlan['contextItems'];
} {
  const week = [...plan.entries].sort((left, right) =>
    `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`),
  );

  return {
    today: week.filter((entry) => entry.date === today),
    week,
    habits: week.filter((entry) => entry.kind === 'habit'),
    objectives: plan.contextItems.filter((item) => item.kind === 'goal' || item.kind === 'project'),
  };
}
