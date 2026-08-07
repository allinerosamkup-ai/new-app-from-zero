import { randomUUID } from 'node:crypto';

import { normalizeObjectiveSubgoals, type ObjectiveSubgoal } from '../lib/objective-subgoals';

type ObjectiveRecoveryRow = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  archived: boolean;
  subgoals: unknown;
  updatedAt?: Date | string | null;
};

type ObjectiveActionRecoveryTransaction = {
  objective: {
    findMany(args: unknown): Promise<ObjectiveRecoveryRow[]>;
    findFirst(args: unknown): Promise<ObjectiveRecoveryRow | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  objectiveActionRecoveryClaim: {
    updateMany(args: unknown): Promise<{ count: number }>;
    create(args: unknown): Promise<RecoveryClaimRow>;
    findFirst(args: unknown): Promise<RecoveryClaimRow | null>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
};

type ObjectiveActionRecoveryPrisma = ObjectiveActionRecoveryTransaction & {
  $transaction<T>(operation: (transaction: ObjectiveActionRecoveryTransaction) => Promise<T>): Promise<T>;
};

type RecoveryClaimRow = {
  userId: string;
  objectiveId: string;
  leaseToken: string;
  leaseUntil: Date;
  retryNotBefore: Date | null;
  attempts: number;
  lastError: string | null;
};

export type GoalSubtasksSuggestionRequest = {
  type: 'goal-subtasks';
  context: {
    goalTitle: string;
    existingSubtasks: string[];
    locale: string;
  };
};

export type GoalSubtasksSuggestionGenerator = (
  request: GoalSubtasksSuggestionRequest,
  options?: { signal?: AbortSignal },
) => Promise<unknown>;

export type ObjectiveActionRecoveryResult = {
  eligible: number;
  attempted: number;
  recovered: number;
  failed: number;
  deferred: number;
  retryAfterMs: number | null;
};

type RecoveryOutcome = {
  status: 'recovered' | 'failed' | 'deferred';
  attempted: boolean;
  retryAfterMs: number | null;
};

type ObjectiveActionRecoveryOptions = {
  maxPerRequest?: number;
  backoffMs?: number;
  leaseMs?: number;
  generationTimeoutMs?: number;
  now?: () => number;
};

const DEFAULT_MAX_PER_REQUEST = 3;
const DEFAULT_BACKOFF_MS = 60_000;
const DEFAULT_LEASE_MS = 120_000;
const DEFAULT_GENERATION_TIMEOUT_MS = 90_000;
const LEASE_FENCE_MARGIN_MS = 1;

function suggestionItems(value: unknown): string[] {
  const payload = value && typeof value === 'object' && 'suggestion' in value
    ? (value as { suggestion?: unknown }).suggestion
    : value;
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const title = item.trim();
    const identity = title.toLocaleLowerCase('pt-BR');
    if (!title || seen.has(identity)) return [];
    seen.add(identity);
    return [title];
  });
}

function recoveredActions(objectiveId: string, titles: string[]): ObjectiveSubgoal[] {
  return normalizeObjectiveSubgoals(titles.map((title, index) => ({
    id: `recovered-${objectiveId}-${index + 1}`,
    title,
    done: false,
    order: index,
    aiGenerated: true,
  })));
}

export class ObjectiveActionRecoveryService {
  private readonly maxPerRequest: number;
  private readonly backoffMs: number;
  private readonly leaseMs: number;
  private readonly generationTimeoutMs: number;
  private readonly now: () => number;

  constructor(
    private readonly prisma: ObjectiveActionRecoveryPrisma,
    private readonly generateGoalSubtasks: GoalSubtasksSuggestionGenerator,
    options: ObjectiveActionRecoveryOptions = {},
  ) {
    this.maxPerRequest = Math.max(1, options.maxPerRequest ?? DEFAULT_MAX_PER_REQUEST);
    this.backoffMs = Math.max(1, options.backoffMs ?? DEFAULT_BACKOFF_MS);
    this.leaseMs = Math.max(2, options.leaseMs ?? DEFAULT_LEASE_MS);
    this.generationTimeoutMs = Math.max(
      1,
      Math.min(options.generationTimeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS, this.leaseMs - LEASE_FENCE_MARGIN_MS),
    );
    this.now = options.now ?? Date.now;
  }

  async recover(input: { userId: string; locale?: string }): Promise<ObjectiveActionRecoveryResult> {
    const rows = await this.prisma.objective.findMany({
      where: {
        userId: input.userId,
        archived: false,
        progress: { lt: 100 },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        progress: true,
        archived: true,
        subgoals: true,
        updatedAt: true,
      },
    });
    const eligible = rows.filter((objective) => (
      objective.userId === input.userId
      && objective.archived === false
      && objective.progress < 100
      && normalizeObjectiveSubgoals(objective.subgoals).length === 0
    ));

    let recovered = 0;
    let failed = 0;
    let deferred = 0;
    let attempted = 0;
    let started = 0;
    const retryDelays: number[] = [];

    for (const objective of eligible) {
      let outcome: RecoveryOutcome;

      if (started >= this.maxPerRequest) {
        outcome = { status: 'deferred', attempted: false, retryAfterMs: 0 };
      } else {
        outcome = await this.recoverObjective({
          objective,
          userId: input.userId,
          locale: input.locale ?? 'pt-BR',
        });
        if (outcome.attempted) started += 1;
      }

      if (outcome.attempted) attempted += 1;
      if (outcome.status === 'recovered') recovered += 1;
      if (outcome.status === 'failed') failed += 1;
      if (outcome.status === 'deferred') deferred += 1;
      if (outcome.retryAfterMs !== null) retryDelays.push(outcome.retryAfterMs);
    }

    return {
      eligible: eligible.length,
      attempted,
      recovered,
      failed,
      deferred,
      retryAfterMs: retryDelays.length > 0 ? Math.min(...retryDelays) : null,
    };
  }

  private async recoverObjective(input: {
    objective: ObjectiveRecoveryRow;
    userId: string;
    locale: string;
  }): Promise<RecoveryOutcome> {
    const titleSnapshot = input.objective.title;
    const updatedAtSnapshot = input.objective.updatedAt instanceof Date
      ? new Date(input.objective.updatedAt)
      : input.objective.updatedAt;
    const subgoalsSnapshot = input.objective.subgoals === undefined
      ? undefined
      : JSON.parse(JSON.stringify(input.objective.subgoals));

    const claim = await this.acquireClaim(input.userId, input.objective.id);
    if (!claim.acquired) {
      return { status: 'deferred', attempted: false, retryAfterMs: claim.retryAfterMs };
    }

    const fresh = await this.prisma.objective.findFirst({
      where: {
        id: input.objective.id,
        userId: input.userId,
        archived: false,
        progress: { lt: 100 },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        progress: true,
        archived: true,
        subgoals: true,
        updatedAt: true,
      },
    });
    if (!fresh) {
      await this.releaseClaim(input.userId, input.objective.id, claim.token);
      return { status: 'deferred', attempted: false, retryAfterMs: 0 };
    }
    if (normalizeObjectiveSubgoals(fresh.subgoals).length > 0) {
      await this.releaseClaim(input.userId, input.objective.id, claim.token);
      return { status: 'recovered', attempted: false, retryAfterMs: null };
    }
    if (fresh.title !== titleSnapshot || !sameInstant(fresh.updatedAt, updatedAtSnapshot)) {
      await this.releaseClaim(input.userId, input.objective.id, claim.token);
      return { status: 'deferred', attempted: false, retryAfterMs: 0 };
    }

    try {
      const suggestion = await this.generateWithLeaseTimeout({
        request: {
          type: 'goal-subtasks',
          context: {
            goalTitle: titleSnapshot,
            existingSubtasks: [],
            locale: input.locale,
          },
        },
        leaseUntilMs: claim.leaseUntilMs,
      });
      const actions = recoveredActions(input.objective.id, suggestionItems(suggestion));
      if (actions.length < 2) {
        await this.markFailure(input.userId, input.objective.id, claim.token, 'generation_returned_fewer_than_two_actions');
        return { status: 'failed', attempted: true, retryAfterMs: this.backoffMs };
      }

      const committed = await this.commitWithFence({
        objective: input.objective,
        userId: input.userId,
        token: claim.token,
        titleSnapshot,
        updatedAtSnapshot,
        subgoalsSnapshot,
        actions,
      });
      if (!committed) {
        return { status: 'deferred', attempted: true, retryAfterMs: 0 };
      }
      return { status: 'recovered', attempted: true, retryAfterMs: null };
    } catch (error) {
      await this.markFailure(
        input.userId,
        input.objective.id,
        claim.token,
        error instanceof Error ? error.message : String(error),
      );
      console.warn(`[objective-action-recovery] objetivo ${input.objective.id} preservado após falha:`, error);
      return { status: 'failed', attempted: true, retryAfterMs: this.backoffMs };
    }
  }

  private async generateWithLeaseTimeout(input: {
    request: GoalSubtasksSuggestionRequest;
    leaseUntilMs: number;
  }): Promise<unknown> {
    const remainingLeaseMs = input.leaseUntilMs - this.now() - LEASE_FENCE_MARGIN_MS;
    const timeoutMs = Math.min(this.generationTimeoutMs, remainingLeaseMs);
    if (timeoutMs <= 0) throw new GenerationLeaseTimeoutError();

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const generation = Promise.resolve().then(() => this.generateGoalSubtasks(
      input.request,
      { signal: controller.signal },
    ));
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new GenerationLeaseTimeoutError());
      }, timeoutMs);
    });

    try {
      return await Promise.race([generation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async commitWithFence(input: {
    objective: ObjectiveRecoveryRow;
    userId: string;
    token: string;
    titleSnapshot: string;
    updatedAtSnapshot: Date | string | null | undefined;
    subgoalsSnapshot: unknown;
    actions: ObjectiveSubgoal[];
  }): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const nowMs = this.now();
      const renewed = await transaction.objectiveActionRecoveryClaim.updateMany({
        where: {
          userId: input.userId,
          objectiveId: input.objective.id,
          leaseToken: input.token,
          leaseUntil: { gt: new Date(nowMs) },
        },
        data: { leaseUntil: new Date(nowMs + this.leaseMs) },
      });
      if (renewed.count !== 1) return false;

      const updated = await transaction.objective.updateMany({
        where: {
          id: input.objective.id,
          userId: input.userId,
          title: input.titleSnapshot,
          archived: false,
          progress: { lt: 100 },
          subgoals: { equals: input.subgoalsSnapshot },
          ...(input.updatedAtSnapshot !== undefined
            ? { updatedAt: input.updatedAtSnapshot }
            : {}),
        },
        data: { subgoals: input.actions as any },
      });
      const deleted = await transaction.objectiveActionRecoveryClaim.deleteMany({
        where: {
          userId: input.userId,
          objectiveId: input.objective.id,
          leaseToken: input.token,
        },
      });
      if (deleted.count !== 1) {
        throw new Error('objective_recovery_claim_delete_failed');
      }
      return updated.count === 1;
    });
  }

  private async acquireClaim(userId: string, objectiveId: string): Promise<
    { acquired: true; token: string; leaseUntilMs: number } | { acquired: false; retryAfterMs: number }
  > {
    const nowMs = this.now();
    const now = new Date(nowMs);
    const token = randomUUID();
    const leaseUntil = new Date(nowMs + this.leaseMs);
    const acquired = await this.prisma.objectiveActionRecoveryClaim.updateMany({
      where: {
        userId,
        objectiveId,
        leaseUntil: { lte: now },
        OR: [
          { retryNotBefore: null },
          { retryNotBefore: { lte: now } },
        ],
      },
      data: {
        leaseToken: token,
        leaseUntil,
        retryNotBefore: null,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (acquired.count === 1) return { acquired: true, token, leaseUntilMs: leaseUntil.getTime() };

    try {
      await this.prisma.objectiveActionRecoveryClaim.create({
        data: {
          userId,
          objectiveId,
          leaseToken: token,
          leaseUntil,
          retryNotBefore: null,
          attempts: 1,
          lastError: null,
        },
      });
      return { acquired: true, token, leaseUntilMs: leaseUntil.getTime() };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const current = await this.prisma.objectiveActionRecoveryClaim.findFirst({
      where: { userId, objectiveId },
      select: { leaseUntil: true, retryNotBefore: true },
    });
    const retryAt = Math.max(
      current?.leaseUntil?.getTime() ?? nowMs,
      current?.retryNotBefore?.getTime() ?? nowMs,
    );
    return { acquired: false, retryAfterMs: Math.max(0, retryAt - nowMs) };
  }

  private async releaseClaim(userId: string, objectiveId: string, token: string): Promise<void> {
    await this.prisma.objectiveActionRecoveryClaim.deleteMany({
      where: { userId, objectiveId, leaseToken: token },
    });
  }

  private async markFailure(
    userId: string,
    objectiveId: string,
    token: string,
    lastError: string,
  ): Promise<void> {
    const nowMs = this.now();
    await this.prisma.objectiveActionRecoveryClaim.updateMany({
      where: { userId, objectiveId, leaseToken: token },
      data: {
        leaseUntil: new Date(nowMs),
        retryNotBefore: new Date(nowMs + this.backoffMs),
        lastError: lastError.slice(0, 500),
      },
    });
  }
}

function sameInstant(left: Date | string | null | undefined, right: Date | string | null | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left === null || right === null) return left === right;
  return new Date(left).getTime() === new Date(right).getTime();
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}

class GenerationLeaseTimeoutError extends Error {
  constructor() {
    super('objective_recovery_generation_timeout');
    this.name = 'GenerationLeaseTimeoutError';
  }
}
