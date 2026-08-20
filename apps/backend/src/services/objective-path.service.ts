import { randomUUID } from 'node:crypto';

import {
  activeConcreteObjectiveSubgoals,
  isConcreteObjectiveSubgoal,
  normalizeObjectiveSubgoals,
  type ObjectiveSubgoal,
} from '../lib/objective-subgoals';
import {
  GoalIntelligenceService,
  buildFallbackGoalDecomposition,
  isConversationalPhrase,
  type GoalDecomposition,
  type GoalIntelligenceInput,
  type GoalMilestone,
} from './goal-intelligence.service';

type ObjectivePathRow = {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  progress: number;
  archived: boolean;
  pausedAt?: Date | string | null;
  deadline?: Date | string | null;
  resultDefinition?: string | null;
  currentReality?: string | null;
  milestones: unknown;
  subgoals: unknown;
  pathVersion: number;
  pathProposal?: unknown;
  pathProposalCreatedAt?: Date | string | null;
  pathStatus?: string;
  pathQuestion?: string | null;
};

type TransactionClient = {
  objective: { updateMany(args: unknown): Promise<{ count: number }> };
  eventLog: { create(args: unknown): Promise<unknown> };
};

type ObjectivePathPrisma = TransactionClient & {
  objective: TransactionClient['objective'] & {
    findFirst(args: unknown): Promise<ObjectivePathRow | null>;
  };
  $transaction<T>(operation: (transaction: TransactionClient) => Promise<T>): Promise<T>;
};

export type ObjectivePathProposal = {
  baseVersion: number;
  reason: string;
  resultDefinition: string | null;
  currentReality: string | null;
  milestones: GoalMilestone[];
  createdAt: string;
};

type Decompose = (input: GoalIntelligenceInput) => Promise<GoalDecomposition>;

/**
 * Janela principal da IA: o modelo precisa de mais de 9s quando o contexto está
 * cheio (foi o que derrubou o "Correr 3 x na semana" em produção duas vezes).
 * O fallback digno só assume depois que a cadeia completa falha: primeiro retoma
 * a IA uma vez (o timeout é transitório na maioria dos casos), depois entrega
 * os passos canônicos centrados na meta — nunca frases do contexto viradas de
 * ação.
 */
const DECOMPOSITION_DEADLINE_MS = 8_000;
const AI_RETRY_DELAY_MS = 500;

/** Sanitiza as falas da pessoa antes de virarem material de geração: micro-frases
 *  de conversação ("Olá tudo bem", "Obrigada", "Sim") são diário, não intenção. */
function cleanStatements(statements: string[] | undefined): string[] {
  return (statements ?? []).filter((statement) => !isConversationalPhrase(statement));
}

type PersistConfirmedPath = (
  transaction: TransactionClient,
  snapshot: {
    id: string; userId: string; title: string; resultDefinition: string | null;
    currentReality: string | null; milestones: unknown; subgoals: unknown; pathVersion: number;
  },
  source: string,
) => Promise<void>;

export class ObjectivePathNotFoundError extends Error {}
export class ObjectivePathConflictError extends Error {}
export class ObjectivePathInvalidProposalError extends Error {}

function milestonesOf(value: unknown): GoalMilestone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string') return [];
    return [{
      id: row.id,
      title: row.title,
      order: typeof row.order === 'number' ? row.order : 0,
      doneWhen: typeof row.doneWhen === 'string' ? row.doneWhen : '',
      actions: [],
    }];
  }).sort((left, right) => left.order - right.order);
}

function actionRows(objectiveId: string, decomposition: GoalDecomposition): ObjectiveSubgoal[] {
  return normalizeObjectiveSubgoals(decomposition.steps.map((step, index) => ({
    id: randomUUID(),
    title: step.title,
    done: false,
    order: index,
    aiGenerated: true,
    milestoneId: step.milestoneId ?? decomposition.currentMilestoneId,
    doneWhen: step.doneWhen ?? null,
    effortSize: step.effortSize ?? null,
    basedOn: step.basedOn,
    evidenceRefs: step.evidenceRefs ?? [`objective:${objectiveId}`],
    ...(step.patternBasis?.length ? { patternBasis: step.patternBasis } : {}),
    userEdited: false,
  })));
}

function proposalOf(value: unknown): ObjectivePathProposal | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<ObjectivePathProposal>;
  if (typeof row.baseVersion !== 'number' || !Array.isArray(row.milestones)) return null;
  return row as ObjectivePathProposal;
}

function withUniqueMilestoneIds(
  milestones: GoalMilestone[],
  reservedIds: Iterable<string>,
): GoalMilestone[] {
  const used = new Set(reservedIds);
  return milestones.map((milestone) => {
    const baseId = milestone.id.trim() || 'milestone';
    let id = baseId;
    let suffix = 2;
    while (used.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...milestone, id };
  });
}

export class ObjectivePathService {
  constructor(
    private readonly prisma: ObjectivePathPrisma,
    private readonly decompose: Decompose = (input) => GoalIntelligenceService.decompose(input),
    private readonly persistConfirmedPath: PersistConfirmedPath = async () => {},
  ) {}

  private async objective(userId: string, objectiveId: string): Promise<ObjectivePathRow> {
    const objective = await this.prisma.objective.findFirst({
      where: { id: objectiveId, userId, archived: false },
    });
    if (!objective) throw new ObjectivePathNotFoundError('objective_not_found');
    return objective;
  }

  async generate(input: {
    userId: string;
    objectiveId: string;
    locale: string;
    userStatements?: string[];
    completedActions?: string[];
    blockedActions?: string[];
    canonicalFacts?: string[];
    patternContext?: string | null;
    patternEvidenceRefs?: string[];
    patternBasis?: GoalIntelligenceInput['patternBasis'];
    moodLabel?: string | null;
    energyScore?: number | null;
    capacity?: GoalIntelligenceInput['capacity'];
    operationalProfile?: GoalIntelligenceInput['operationalProfile'];
  }): Promise<{ status: 'ready' | 'needs_answer' | 'retrying'; objectiveId: string; pathVersion: number; question: string | null }> {
    const objective = await this.objective(input.userId, input.objectiveId);
    const existing = normalizeObjectiveSubgoals(objective.subgoals);
    const concreteExisting = existing.filter(isConcreteObjectiveSubgoal);
    if (objective.pathStatus === 'ready' && existing.some((action) => action.userEdited || (action.done && isConcreteObjectiveSubgoal(action)))) {
      throw new ObjectivePathConflictError('revision_requires_proposal');
    }
    const intelligenceInput: GoalIntelligenceInput = {
      goalTitle: objective.title,
      existingActions: concreteExisting.filter((action) => !action.done).map((action) => action.title),
      completedActions: [
        ...concreteExisting.filter((action) => action.done).map((action) => action.title),
        ...(input.completedActions ?? []),
      ],
      blockedActions: input.blockedActions,
      canonicalFacts: input.canonicalFacts,
      userStatements: [objective.description ?? '', ...(input.userStatements ?? [])].filter(Boolean),
      locale: input.locale,
      patternContext: input.patternContext,
      patternEvidenceRefs: input.patternEvidenceRefs,
      patternBasis: input.patternBasis,
      moodLabel: input.moodLabel,
      energyScore: input.energyScore,
      capacity: input.capacity,
      operationalProfile: input.operationalProfile,
    };
    const cleanInput: GoalIntelligenceInput = {
      ...intelligenceInput,
      userStatements: cleanStatements(intelligenceInput.userStatements),
    };
    const fallback = buildFallbackGoalDecomposition(cleanInput);
    const sourceTier = (decomposition: GoalDecomposition): string =>
      decomposition.assumptions.some((assumption) => String(assumption).includes('sem consulta completa à IA')) ? 'fallback_canonical' : 'ai';

    let decomposition: GoalDecomposition;
    const decomposeWithinDeadline = async (): Promise<GoalDecomposition> => {
      // A chamada original continua podendo terminar em segundo plano, mas a
      // decisão do caminho nunca espera indefinidamente por ela. O fallback é
      // um resultado válido e executável, não um estado de erro.
      return Promise.race([
        this.decompose(cleanInput),
        new Promise<GoalDecomposition>((resolve) => setTimeout(() => resolve(fallback), DECOMPOSITION_DEADLINE_MS)),
      ]);
    };
    try {
      // Uma tentativa principal e uma segunda tentativa curta, ambas limitadas.
      // Assim, uma IA lenta ou indisponível não mantém o objetivo em
      // `generating` sem prazo: no pior caso o caminho canônico é persistido.
      const first = await decomposeWithinDeadline();
      if (sourceTier(first) === 'ai' || first.mode === 'question') {
        decomposition = first;
      } else {
        await new Promise((resolve) => setTimeout(resolve, AI_RETRY_DELAY_MS));
        const retry = await decomposeWithinDeadline();
        decomposition = sourceTier(retry) === 'ai' ? retry : fallback;
      }
    } catch {
      decomposition = fallback;
    }

    if (decomposition.mode === 'question' || decomposition.steps.length === 0) {
      // Pergunta é raciocínio interno. Para todo objetivo com título, o fallback
      // canônico é suficiente para começar sem inventar objetos ou circunstâncias.
      const fallback = buildFallbackGoalDecomposition(cleanInput);
      if (fallback.mode === 'actions' && fallback.steps.length > 0) {
        decomposition = fallback;
      } else {
        // Única exceção: sem título não existe meta sobre a qual agir.
        const question = decomposition.question;
        const pathStatus = question ? 'needs_answer' : 'retrying';
        const updated = await this.prisma.$transaction(async (transaction) => {
          const write = await transaction.objective.updateMany({
            where: { id: objective.id, userId: input.userId, pathVersion: objective.pathVersion },
            data: { pathStatus, pathQuestion: question, pathProposal: null, pathProposalCreatedAt: null },
          });
          if (write.count !== 1) throw new ObjectivePathConflictError('objective_path_changed');
          await transaction.eventLog.create({
            data: { userId: input.userId, eventName: 'objective_path_questioned', properties: { objectiveId: objective.id, question, pathVersion: objective.pathVersion } },
          });
          return write;
        });
        void updated;
        return { status: pathStatus, objectiveId: objective.id, pathVersion: objective.pathVersion, question };
      }
    }

    const subgoals = actionRows(objective.id, decomposition);
    const milestones = decomposition.milestones.map((milestone) => ({ ...milestone, actions: [] }));
    await this.prisma.$transaction(async (transaction) => {
      const write = await transaction.objective.updateMany({
        where: { id: objective.id, userId: input.userId, pathVersion: objective.pathVersion },
        data: {
          resultDefinition: decomposition.resultDefinition,
          currentReality: decomposition.currentReality,
          milestones: milestones as any,
          subgoals: subgoals as any,
          pathVersion: { increment: 1 },
          pathStatus: 'ready',
          pathQuestion: null,
          pathProposal: null,
          pathProposalCreatedAt: null,
        },
      });
      if (write.count !== 1) throw new ObjectivePathConflictError('objective_path_changed');
      await transaction.eventLog.create({
        data: {
          userId: input.userId,
          eventName: 'objective_path_generated',
          properties: {
            objectiveId: objective.id,
            pathVersion: objective.pathVersion + 1,
            resultDefinition: decomposition.resultDefinition,
            currentReality: decomposition.currentReality,
            assumptions: decomposition.assumptions,
            sourceTier: sourceTier(decomposition),
          },
        },
      });
      await this.persistConfirmedPath(transaction, {
        id: objective.id,
        userId: input.userId,
        title: objective.title,
        resultDefinition: decomposition.resultDefinition,
        currentReality: decomposition.currentReality,
        milestones,
        subgoals,
        pathVersion: objective.pathVersion + 1,
      }, 'objective_path_generated');
    });

    return { status: 'ready', objectiveId: objective.id, pathVersion: objective.pathVersion + 1, question: null };
  }

  async answer(input: {
    userId: string;
    objectiveId: string;
    locale: string;
    answer: string;
    userStatements?: string[];
    completedActions?: string[];
    blockedActions?: string[];
    canonicalFacts?: string[];
    patternContext?: string | null;
    patternEvidenceRefs?: string[];
    patternBasis?: GoalIntelligenceInput['patternBasis'];
    moodLabel?: string | null;
    energyScore?: number | null;
    capacity?: GoalIntelligenceInput['capacity'];
    operationalProfile?: GoalIntelligenceInput['operationalProfile'];
  }) {
    const objective = await this.objective(input.userId, input.objectiveId);
    await this.prisma.eventLog.create({
      data: {
        userId: input.userId,
        eventName: 'objective_path_answered',
        properties: { objectiveId: input.objectiveId, answer: input.answer, pathVersion: objective.pathVersion },
      },
    });
    return this.generate({ ...input, userStatements: [...(input.userStatements ?? []), input.answer] });
  }

  async advance(input: {
    userId: string;
    objectiveId: string;
    expectedVersion: number;
    locale: string;
    userStatements?: string[];
    completedActions?: string[];
    blockedActions?: string[];
    canonicalFacts?: string[];
    patternContext?: string | null;
    patternEvidenceRefs?: string[];
    patternBasis?: GoalIntelligenceInput['patternBasis'];
    moodLabel?: string | null;
    energyScore?: number | null;
    capacity?: GoalIntelligenceInput['capacity'];
    operationalProfile?: GoalIntelligenceInput['operationalProfile'];
  }): Promise<{ status: 'ready' | 'needs_answer' | 'retrying'; pathVersion: number; question: string | null }> {
    const objective = await this.objective(input.userId, input.objectiveId);
    if (objective.pathVersion !== input.expectedVersion) throw new ObjectivePathConflictError('objective_path_changed');
    const existing = normalizeObjectiveSubgoals(objective.subgoals);
    if (activeConcreteObjectiveSubgoals(existing).length > 0) {
      throw new ObjectivePathConflictError('current_milestone_still_has_action');
    }
    const milestones = milestonesOf(objective.milestones);
    const completedMilestoneIds = new Set(existing.filter((action) => action.done).map((action) => action.milestoneId).filter(Boolean));
    const nextMilestone = milestones.find((milestone) => !completedMilestoneIds.has(milestone.id));
    if (!nextMilestone) throw new ObjectivePathInvalidProposalError('next_milestone_missing');

    const decomposition = await this.decompose({
      goalTitle: objective.title,
      existingActions: [],
      completedActions: [
        ...existing.filter((action) => action.done).map((action) => action.title),
        ...(input.completedActions ?? []),
      ],
      blockedActions: input.blockedActions,
      userStatements: [
        objective.description ?? '',
        ...(input.userStatements ?? []),
        `A etapa que será aberta agora é "${nextMilestone.title}". Evidência esperada: ${nextMilestone.doneWhen ?? ''}`,
      ].filter(Boolean),
      canonicalFacts: input.canonicalFacts,
      patternContext: input.patternContext,
      patternEvidenceRefs: input.patternEvidenceRefs,
      patternBasis: input.patternBasis,
      moodLabel: input.moodLabel,
      energyScore: input.energyScore,
      capacity: input.capacity,
      operationalProfile: input.operationalProfile,
      locale: input.locale,
    });

    const usableDecomposition = decomposition.mode === 'actions' && decomposition.steps.length > 0
      ? decomposition
      : buildFallbackGoalDecomposition({ goalTitle: objective.title, userStatements: input.userStatements, capacity: input.capacity });
    if (usableDecomposition.mode !== 'actions' || usableDecomposition.steps.length === 0) {
      // Só ocorre se o próprio objetivo não tiver título; não há ação honesta
      // possível sem uma direção mínima.
      const pathStatus = usableDecomposition.question ? 'needs_answer' : 'retrying';
      const write = await this.prisma.objective.updateMany({
        where: { id: objective.id, userId: input.userId, pathVersion: input.expectedVersion },
        data: { pathStatus, pathQuestion: usableDecomposition.question },
      });
      if (write.count !== 1) throw new ObjectivePathConflictError('objective_path_changed');
      return { status: pathStatus, pathVersion: input.expectedVersion, question: usableDecomposition.question };
    }

    const generated = actionRows(objective.id, usableDecomposition).map((action, index) => ({
      ...action,
      order: existing.length + index,
      milestoneId: nextMilestone.id,
    }));
    await this.prisma.$transaction(async (transaction) => {
      const write = await transaction.objective.updateMany({
        where: { id: objective.id, userId: input.userId, pathVersion: input.expectedVersion },
        data: {
          subgoals: [...existing, ...generated] as any,
          pathVersion: { increment: 1 },
          pathStatus: 'ready',
          pathQuestion: null,
          pathProposal: null,
          pathProposalCreatedAt: null,
        },
      });
      if (write.count !== 1) throw new ObjectivePathConflictError('objective_path_changed');
      await transaction.eventLog.create({
        data: { userId: input.userId, eventName: 'objective_milestone_opened', properties: { objectiveId: objective.id, milestoneId: nextMilestone.id, fromVersion: input.expectedVersion, toVersion: input.expectedVersion + 1 } },
      });
      await this.persistConfirmedPath(transaction, {
        id: objective.id,
        userId: input.userId,
        title: objective.title,
        resultDefinition: objective.resultDefinition ?? null,
        currentReality: objective.currentReality ?? null,
        milestones,
        subgoals: [...existing, ...generated],
        pathVersion: input.expectedVersion + 1,
      }, 'objective_milestone_opened');
    });
    return { status: 'ready', pathVersion: input.expectedVersion + 1, question: null };
  }

  async proposeRevision(input: {
    userId: string;
    objectiveId: string;
    locale: string;
    reason: string;
    userStatements?: string[];
    completedActions?: string[];
    blockedActions?: string[];
    canonicalFacts?: string[];
    patternContext?: string | null;
    patternEvidenceRefs?: string[];
    patternBasis?: GoalIntelligenceInput['patternBasis'];
    moodLabel?: string | null;
    energyScore?: number | null;
    capacity?: GoalIntelligenceInput['capacity'];
    operationalProfile?: GoalIntelligenceInput['operationalProfile'];
  }): Promise<{ status: 'proposed' | 'needs_answer'; proposal: ObjectivePathProposal }> {
    const objective = await this.objective(input.userId, input.objectiveId);
    const existingActions = normalizeObjectiveSubgoals(objective.subgoals);
    const decomposition = await this.decompose({
      goalTitle: objective.title,
      existingActions: existingActions.filter((action) => !action.done).map((action) => action.title),
      completedActions: [...existingActions.filter((action) => action.done).map((action) => action.title), ...(input.completedActions ?? [])],
      blockedActions: input.blockedActions,
      canonicalFacts: input.canonicalFacts,
      userStatements: [objective.description ?? '', ...(input.userStatements ?? []), input.reason].filter(Boolean),
      locale: input.locale,
      patternContext: input.patternContext,
      patternEvidenceRefs: input.patternEvidenceRefs,
      patternBasis: input.patternBasis,
      moodLabel: input.moodLabel,
      energyScore: input.energyScore,
      capacity: input.capacity,
      operationalProfile: input.operationalProfile,
    });
    if (decomposition.mode !== 'actions' || decomposition.milestones.length === 0) {
      throw new ObjectivePathInvalidProposalError(decomposition.question ?? 'revision_without_valid_path');
    }

    const storedMilestones = milestonesOf(objective.milestones);
    const activeAction = existingActions.find((action) => (
      !action.done && action.status !== 'rejected' && action.status !== 'deferred'
    ));
    const lastCompletedAction = [...existingActions].reverse().find((action) => action.done);
    const currentMilestoneId = activeAction?.milestoneId
      ?? lastCompletedAction?.milestoneId
      ?? storedMilestones[0]?.id;
    const currentMilestoneIndex = Math.max(
      0,
      storedMilestones.findIndex((milestone) => milestone.id === currentMilestoneId),
    );
    const preservedMilestones = storedMilestones
      .slice(0, currentMilestoneIndex + 1)
      .map((milestone, index) => ({ ...milestone, order: index, actions: [] }));
    const generatedCurrentIndex = Math.max(
      0,
      decomposition.milestones.findIndex((milestone) => milestone.id === decomposition.currentMilestoneId),
    );
    const generatedFuture = withUniqueMilestoneIds(
      decomposition.milestones.slice(generatedCurrentIndex + 1),
      preservedMilestones.map((milestone) => milestone.id),
    ).map((milestone, index) => ({
      ...milestone,
      order: preservedMilestones.length + index,
      actions: [],
    }));
    const proposedMilestones = preservedMilestones.length > 0
      ? [...preservedMilestones, ...generatedFuture]
      : decomposition.milestones;
    const now = new Date().toISOString();
    const proposal: ObjectivePathProposal = {
      baseVersion: objective.pathVersion,
      reason: input.reason,
      resultDefinition: decomposition.resultDefinition,
      currentReality: decomposition.currentReality,
      milestones: proposedMilestones,
      createdAt: now,
    };
    const write = await this.prisma.objective.updateMany({
      where: { id: objective.id, userId: input.userId, pathVersion: objective.pathVersion },
      data: { pathProposal: proposal as any, pathProposalCreatedAt: new Date(now) },
    });
    if (write.count !== 1) throw new ObjectivePathConflictError('objective_path_changed');
    await this.prisma.eventLog.create({
      data: { userId: input.userId, eventName: 'objective_path_revision_proposed', properties: { objectiveId: objective.id, baseVersion: objective.pathVersion, reason: input.reason } },
    });
    return { status: 'proposed', proposal };
  }

  async confirmRevision(input: { userId: string; objectiveId: string; expectedVersion: number }) {
    const objective = await this.objective(input.userId, input.objectiveId);
    const proposal = proposalOf(objective.pathProposal);
    if (!proposal) throw new ObjectivePathInvalidProposalError('objective_path_proposal_missing');
    if (proposal.baseVersion !== input.expectedVersion || objective.pathVersion !== input.expectedVersion) {
      throw new ObjectivePathConflictError('objective_path_changed');
    }

    await this.prisma.$transaction(async (transaction) => {
      const write = await transaction.objective.updateMany({
        where: { id: objective.id, userId: input.userId, pathVersion: input.expectedVersion },
        data: {
          resultDefinition: proposal.resultDefinition,
          currentReality: proposal.currentReality,
          milestones: proposal.milestones as any,
          pathVersion: { increment: 1 },
          pathProposal: null,
          pathProposalCreatedAt: null,
          pathStatus: 'ready',
        },
      });
      if (write.count !== 1) throw new ObjectivePathConflictError('objective_path_changed');
      await transaction.eventLog.create({
        data: { userId: input.userId, eventName: 'objective_path_revision_confirmed', properties: { objectiveId: objective.id, fromVersion: input.expectedVersion, toVersion: input.expectedVersion + 1, reason: proposal.reason } },
      });
      await this.persistConfirmedPath(transaction, {
        id: objective.id,
        userId: input.userId,
        title: objective.title,
        resultDefinition: proposal.resultDefinition,
        currentReality: proposal.currentReality,
        milestones: proposal.milestones,
        subgoals: objective.subgoals,
        pathVersion: input.expectedVersion + 1,
      }, 'objective_path_revision_confirmed');
    });
    return { status: 'confirmed' as const, pathVersion: input.expectedVersion + 1 };
  }
}
