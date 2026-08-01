import {
  normalizeObjectiveSubgoals,
  type ObjectiveSubgoal,
} from '../lib/objective-subgoals';

type ObjectiveRow = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  subgoals: unknown;
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
  return subgoals.find((subgoal) => !subgoal.done) ?? null;
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
    if (requested.done) {
      return {
        objectiveId: objective.id,
        progress: progressFor(subgoals),
        subgoals,
        nextAction: active,
        completedNow: false,
        objectiveCompletedNow: false,
      };
    }
    if (!active || active.id !== requested.id) {
      throw new ObjectiveProgressionError('objective_action_not_active');
    }

    const advanced = subgoals.map((subgoal) => (
      subgoal.id === requested.id ? { ...subgoal, done: true } : subgoal
    ));
    const progress = progressFor(advanced);
    const nextAction = nextPending(advanced);
    const wasCompleted = objective.progress >= 100;
    await tx.objective.update({
      where: { id: objective.id },
      data: { subgoals: advanced as any, progress },
    });

    return {
      objectiveId: objective.id,
      progress,
      subgoals: advanced,
      nextAction,
      completedNow: true,
      objectiveCompletedNow: !wasCompleted && progress === 100,
    };
  }
}
