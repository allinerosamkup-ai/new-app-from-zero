import type {
  RoutineBuilderStep,
  RoutineItem,
  RoutinePlan,
  RoutinePlanEntry,
  RoutineSession,
  RoutineSuggestionCard,
} from './types';

export function shouldRestoreRoutineSession(incoming: { initialSource?: string; focus?: string }): boolean {
  return !incoming.initialSource?.trim() && !incoming.focus?.trim();
}

export function shouldAutoStartRoutineSource(
  incoming: { initialSource?: string; focus?: string },
  state: { hasSession: boolean; busy: boolean; alreadyStarted: boolean },
): boolean {
  return Boolean(
    incoming.initialSource?.trim()
    && incoming.focus?.trim()
    && !state.hasSession
    && !state.busy
    && !state.alreadyStarted,
  );
}

export function applyPlanEntryEdit(
  items: RoutineItem[],
  sourceItemId: string,
  patch: {
    title?: string;
    kind?: RoutineItem['kind'];
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    excluded?: boolean;
    recurrence?: RoutineItem['recurrence'];
  },
): RoutineItem[] {
  return items.map((item) => item.id !== sourceItemId
      ? item
      : {
        ...item,
        ...(patch.title?.trim() ? { title: patch.title.trim() } : {}),
        ...(patch.kind ? { kind: patch.kind } : {}),
        ...(patch.date ? { date: patch.date } : {}),
        ...(patch.startTime ? { startTime: patch.startTime } : {}),
        ...(patch.durationMinutes ? { durationMinutes: patch.durationMinutes } : {}),
        ...(patch.recurrence !== undefined ? { recurrence: patch.recurrence } : {}),
        reviewState: patch.excluded ? 'excluded' : 'confirmed',
      });
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

export function buildRoutineSuggestionCards(input: {
  items: RoutineItem[];
  plan: RoutinePlan;
  appliedSourceItemIds?: string[];
}): RoutineSuggestionCard[] {
  const applied = new Set(input.appliedSourceItemIds ?? []);
  const operationalKinds = new Set(['goal', 'project', 'task', 'habit', 'calendar']);
  const existingHabitTitles = new Set(
    input.plan.entries
      .filter((entry) => entry.kind === 'habit' && !entry.persist)
      .map((entry) => entry.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()),
  );

  return input.items
    .filter((item) => {
      if (!operationalKinds.has(item.kind) || item.duplicateOf) return false;
      if (item.kind !== 'habit') return true;
      const normalizedTitle = item.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      return !existingHabitTitles.has(normalizedTitle);
    })
    .map((item) => {
      const entries = input.plan.entries
        .filter((entry) => entry.persist && entry.sourceItemId === item.id)
        .sort((left, right) => `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`));
      const first = entries[0];
      const unscheduled = input.plan.unscheduled.find((entry) => entry.sourceItemId === item.id);
      const requiresOccurrence = item.kind === 'task' || item.kind === 'calendar';
      const state: RoutineSuggestionCard['state'] = applied.has(item.id)
        ? 'added'
        : item.reviewState === 'excluded'
          ? 'discarded'
          : requiresOccurrence && !first
            ? 'needs_adjustment'
            : 'available';

      return {
        sourceItemId: item.id,
        kind: item.kind as RoutineSuggestionCard['kind'],
        title: item.title,
        description: item.description,
        reason: first?.reason ?? unscheduled?.reason ?? item.classificationReason ?? item.sourceExcerpt,
        recurrence: item.recurrence,
        firstOccurrence: first
          ? {
              date: first.date,
              startTime: first.startTime,
              endTime: first.endTime,
              durationMinutes: first.durationMinutes,
            }
          : null,
        occurrenceCount: entries.length,
        state,
      };
    })
    .sort((left, right) => {
      const leftKey = left.firstOccurrence
        ? `${left.firstOccurrence.date}T${left.firstOccurrence.startTime}`
        : '9999';
      const rightKey = right.firstOccurrence
        ? `${right.firstOccurrence.date}T${right.firstOccurrence.startTime}`
        : '9999';
      return leftKey.localeCompare(rightKey);
    });
}

export function remainingRoutineSourceItemIds(cards: RoutineSuggestionCard[]): string[] {
  return cards
    .filter((card) => card.state === 'available')
    .map((card) => card.sourceItemId);
}

export function resolveRoutineSuggestionCardState(
  card: Pick<RoutineSuggestionCard, 'sourceItemId' | 'state'>,
  savingSourceItemIds: ReadonlySet<string>,
): RoutineSuggestionCard['state'] | 'saving' {
  return card.state === 'available' && savingSourceItemIds.has(card.sourceItemId)
    ? 'saving'
    : card.state;
}
