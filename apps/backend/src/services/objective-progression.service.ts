import {
  isConcreteObjectiveSubgoal,
  normalizeObjectiveSubgoals,
  type ObjectiveSubgoal,
} from '../lib/objective-subgoals';

type ObjectiveRow = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  subgoals: unknown;
  milestones?: unknown;
  pathVersion?: number;
};

type ObjectiveProgressionPrisma = {
  $transaction<T>(
    callback: (tx: any) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' },
  ): Promise<T>;
  objective: {
    findFirst(args: unknown): Promise<ObjectiveRow | null>;
    update(args: unknown): Promise<ObjectiveRow>;
  };
};

export type ObjectiveProgressionResult = {
  objectiveId: string;
  progress: number;
  subgoals: ObjectiveSubgoal[];
  nextAction: Pick<ObjectiveSubgoal, 'id' | 'title' | 'order' | 'plannerBlockId'> | null;
  nextMilestone: { id: string; title: string; order: number; doneWhen: string | null } | null;
  completedNow: boolean;
  objectiveCompletedNow: boolean;
};

export class ObjectiveProgressionError extends Error {
  constructor(
    public readonly code:
      | 'objective_not_found'
      | 'objective_action_not_found'
      | 'objective_action_not_active',
  ) {
    super(code);
  }
}

function readSubgoals(value: unknown): ObjectiveSubgoal[] {
  return normalizeObjectiveSubgoals(Array.isArray(value) ? value : []);
}

function progressFor(subgoals: ObjectiveSubgoal[]): number {
  if (subgoals.length === 0) return 0;
  return Math.round((subgoals.filter((subgoal) => subgoal.done).length / subgoals.length) * 100);
}

function nextPending(subgoals: ObjectiveSubgoal[]) {
  return subgoals.find((subgoal) => (
    !subgoal.done
    && subgoal.status !== 'rejected'
    && subgoal.status !== 'deferred'
    && isConcreteObjectiveSubgoal(subgoal)
  )) ?? null;
}

function orderedMilestones(value: unknown): Array<{ id: string; title: string; order: number; doneWhen: string | null }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string') return [];
    return [{ id: row.id, title: row.title, order: typeof row.order === 'number' ? row.order : 0, doneWhen: typeof row.doneWhen === 'string' ? row.doneWhen : null }];
  }).sort((left, right) => left.order - right.order);
}

export class ObjectiveProgressionService {
  constructor(private readonly prisma: ObjectiveProgressionPrisma) {}

  async completeActiveAction(input: {
    userId: string;
    objectiveId: string;
    subgoalId: string;
  }): Promise<ObjectiveProgressionResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => this.completeInTransaction(tx, input),
          { isolationLevel: 'Serializable' },
        );
      } catch (error: any) {
        lastError = error;
        if (error?.code !== 'P2034') throw error;
      }
    }
    throw lastError;
  }

  private async completeInTransaction(
    tx: any,
    input: { userId: string; objectiveId: string; subgoalId: string },
  ): Promise<ObjectiveProgressionResult> {
    const objective = await tx.objective.findFirst({
      where: { id: input.objectiveId, userId: input.userId, archived: false },
    }) as ObjectiveRow | null;
    if (!objective) throw new ObjectiveProgressionError('objective_not_found');

    const subgoals = readSubgoals(objective.subgoals);
    const requested = subgoals.find((subgoal) => subgoal.id === input.subgoalId);
    if (!requested) throw new ObjectiveProgressionError('objective_action_not_found');

    const active = nextPending(subgoals);
    const milestones = orderedMilestones(objective.milestones);
    const currentMilestoneId = requested.milestoneId ?? milestones[0]?.id ?? null;
    const currentMilestone = milestones.find((milestone) => milestone.id === currentMilestoneId) ?? null;
    const nextMilestone = currentMilestone
      ? milestones.find((milestone) => milestone.order > currentMilestone.order) ?? null
      : null;
    if (requested.done) {
      return {
        objectiveId: objective.id,
        progress: progressFor(subgoals),
        subgoals,
        nextAction: active,
        nextMilestone: active ? null : nextMilestone,
        completedNow: false,
        objectiveCompletedNow: false,
      };
    }
    if (!active || active.id !== requested.id) {
      throw new ObjectiveProgressionError('objective_action_not_active');
    }

    const advanced = subgoals.map((subgoal) => (
      subgoal.id === requested.id ? { ...subgoal, done: true, status: 'done' as const } : subgoal
    ));
    const currentActionsDone = advanced
      .filter((action) => !currentMilestoneId || action.milestoneId === currentMilestoneId || !action.milestoneId)
      .every((action) => !isConcreteObjectiveSubgoal(action) || action.done || action.status === 'rejected');
    const progress = milestones.length > 0 && currentMilestone && currentActionsDone && nextMilestone
      ? Math.max(objective.progress, Math.round(((currentMilestone.order + 1) / milestones.length) * 100))
      : progressFor(advanced);
    const nextAction = nextPending(advanced);
    const wasCompleted = objective.progress >= 100;
    const objectiveCompleted = nextAction === null && nextMilestone === null;
    await tx.objective.update({
      where: { id: objective.id },
      data: { subgoals: advanced as any, progress: objectiveCompleted ? 100 : Math.min(progress, 99), pathVersion: (objective.pathVersion ?? 1) + 1 },
    });

    return {
      objectiveId: objective.id,
      progress: objectiveCompleted ? 100 : Math.min(progress, 99),
      subgoals: advanced,
      nextAction,
      nextMilestone: nextAction ? null : nextMilestone,
      completedNow: true,
      objectiveCompletedNow: !wasCompleted && objectiveCompleted,
    };
  }
}
