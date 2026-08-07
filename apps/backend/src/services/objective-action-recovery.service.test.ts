import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../index';
import {
  ObjectiveActionRecoveryService,
} from './objective-action-recovery.service';
import { buildGoalDecompositionPrompt } from './goal-intelligence.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

type ObjectiveFixture = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  archived: boolean;
  subgoals: unknown;
  updatedAt?: Date;
};

function createRepository(initial: ObjectiveFixture[]) {
  const objectives = structuredClone(initial);
  const claims: Array<{
    userId: string;
    objectiveId: string;
    leaseToken: string;
    leaseUntil: Date;
    retryNotBefore: Date | null;
    attempts: number;
    lastError: string | null;
  }> = [];
  let writes = 0;
  let transactionDepth = 0;

  const repository = {
    objective: {
      findMany: async () => objectives,
      findFirst: async ({ where }: any) => objectives.find((objective) => (
        objective.id === where.id
        && objective.userId === where.userId
        && objective.archived === false
        && objective.progress < 100
      )) ?? null,
      updateMany: async ({ where, data }: any) => {
        if (transactionDepth === 0) throw new Error('objective recovery write must be transactional');
        const objective = objectives.find((item) => item.id === where.id && item.userId === where.userId);
        if (!objective || objective.archived || objective.progress >= 100) return { count: 0 };
        if (where.title !== undefined && objective.title !== where.title) return { count: 0 };
        if (where.updatedAt !== undefined && objective.updatedAt?.getTime() !== where.updatedAt.getTime()) return { count: 0 };
        if (JSON.stringify(objective.subgoals) !== JSON.stringify(where.subgoals.equals)) return { count: 0 };
        objective.subgoals = structuredClone(data.subgoals);
        writes += 1;
        return { count: 1 };
      },
    },
    objectiveActionRecoveryClaim: {
      updateMany: async ({ where, data }: any) => {
        const claim = claims.find((item) => item.userId === where.userId && item.objectiveId === where.objectiveId);
        if (!claim) return { count: 0 };
        if (where.leaseToken !== undefined) {
          if (claim.leaseToken !== where.leaseToken) return { count: 0 };
          if (where.leaseUntil?.gt && claim.leaseUntil <= where.leaseUntil.gt) return { count: 0 };
          claim.leaseUntil = data.leaseUntil;
          if ('retryNotBefore' in data) claim.retryNotBefore = data.retryNotBefore;
          if ('lastError' in data) claim.lastError = data.lastError;
          return { count: 1 };
        }
        if (claim.leaseUntil > where.leaseUntil.lte) return { count: 0 };
        const retryAllowed = claim.retryNotBefore === null || claim.retryNotBefore <= where.OR[1].retryNotBefore.lte;
        if (!retryAllowed) return { count: 0 };
        claim.leaseToken = data.leaseToken;
        claim.leaseUntil = data.leaseUntil;
        claim.retryNotBefore = data.retryNotBefore;
        claim.attempts += data.attempts.increment;
        claim.lastError = data.lastError;
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        if (claims.some((item) => item.userId === data.userId && item.objectiveId === data.objectiveId)) {
          throw Object.assign(new Error('unique claim'), { code: 'P2002' });
        }
        const claim = { ...data };
        claims.push(claim);
        return claim;
      },
      findFirst: async ({ where }: any) => claims.find((claim) => (
        claim.userId === where.userId
        && claim.objectiveId === where.objectiveId
        && (where.leaseToken === undefined || claim.leaseToken === where.leaseToken)
      )) ?? null,
      deleteMany: async ({ where }: any) => {
        const index = claims.findIndex((claim) => (
          claim.userId === where.userId
          && claim.objectiveId === where.objectiveId
          && claim.leaseToken === where.leaseToken
        ));
        if (index < 0) return { count: 0 };
        claims.splice(index, 1);
        return { count: 1 };
      },
    },
  };
  const repositoryWithTransaction = Object.assign(repository, {
    $transaction: async <T>(operation: (transaction: typeof repository) => Promise<T>): Promise<T> => {
      transactionDepth += 1;
      try {
        return await operation(repository);
      } finally {
        transactionDepth -= 1;
      }
    },
  });

  return { repository: repositoryWithTransaction, objectives, claims, getWrites: () => writes };
}

async function run() {
  assert.match(
    buildGoalDecompositionPrompt({ goalTitle: 'Publicar o portfólio' }),
    /OBJETIVO: "Publicar o portfólio"/,
    'a recuperação usa o mesmo contrato de interpretação do fluxo normal',
  );
  assert.match(
    buildGoalDecompositionPrompt({ goalTitle: 'Publish the portfolio', locale: 'en-US' }),
    /Answer in English/,
    'o locale recebido do app deve orientar o idioma da geração',
  );

  {
    const { repository, objectives, getWrites } = createRepository([
      {
        id: 'active-empty', userId: USER_ID, title: 'Publicar o portfólio', progress: 0, archived: false,
        subgoals: [null, 'inválida'],
      },
      {
        id: 'active-valid', userId: USER_ID, title: 'Reformar a sala', progress: 20, archived: false,
        subgoals: [{ id: 'keep', title: 'Medir a parede', done: false }],
      },
      {
        id: 'completed', userId: USER_ID, title: 'Curso concluído', progress: 100, archived: false,
        subgoals: [],
      },
      {
        id: 'archived', userId: USER_ID, title: 'Projeto arquivado', progress: 0, archived: true,
        subgoals: [],
      },
    ]);
    const requests: unknown[] = [];
    const service = new ObjectiveActionRecoveryService(repository, async (request) => {
      requests.push(request);
      return { items: ['Abrir a pasta de fotos', 'Escolher três fotos'] };
    });

    const result = await service.recover({ userId: USER_ID });

    assert.deepEqual(requests, [{
      type: 'goal-subtasks',
      context: { goalTitle: 'Publicar o portfólio', existingSubtasks: [], locale: 'pt-BR' },
    }]);
    assert.deepEqual(result, {
      eligible: 1, attempted: 1, recovered: 1, failed: 0, deferred: 0, retryAfterMs: null,
    });
    assert.equal(getWrites(), 1);
    assert.deepEqual(objectives[0].subgoals, [
      {
        id: 'recovered-active-empty-1', title: 'Abrir a pasta de fotos', done: false,
        order: 0, aiGenerated: true,
      },
      {
        id: 'recovered-active-empty-2', title: 'Escolher três fotos', done: false,
        order: 1, aiGenerated: true,
      },
    ]);
    assert.deepEqual(objectives[1].subgoals, [{ id: 'keep', title: 'Medir a parede', done: false }]);
    assert.equal(objectives[2].progress, 100, 'objetivo concluído não pode ser reativado');
    assert.equal(objectives[3].archived, true, 'objetivo arquivado não pode ser reativado');

    const retry = await service.recover({ userId: USER_ID });
    assert.deepEqual(retry, {
      eligible: 0, attempted: 0, recovered: 0, failed: 0, deferred: 0, retryAfterMs: null,
    });
    assert.equal(requests.length, 1, 'repetir a recuperação não deve chamar IA nem persistir de novo');
    assert.equal(getWrites(), 1);
  }

  {
    const original = [{ id: 'legacy-failure', label: 'registro legado sem ação' }];
    const { repository, objectives, getWrites } = createRepository([{
      id: 'active-failure', userId: USER_ID, title: 'Organizar mudança', progress: 0, archived: false,
      subgoals: original,
    }]);
    const service = new ObjectiveActionRecoveryService(repository, async () => {
      throw new Error('AI unavailable');
    });

    const originalWarn = console.warn;
    console.warn = () => {};
    const result = await service.recover({ userId: USER_ID }).finally(() => {
      console.warn = originalWarn;
    });

    assert.deepEqual(result, {
      eligible: 1, attempted: 1, recovered: 0, failed: 1, deferred: 0, retryAfterMs: 60_000,
    });
    assert.equal(getWrites(), 0);
    assert.deepEqual(objectives[0].subgoals, original, 'falha deve manter o registro original intacto');
  }

  {
    const { repository, objectives } = createRepository([{
      id: 'endpoint-active', userId: USER_ID, title: 'Publicar o site', progress: 0, archived: false,
      subgoals: [],
    }]);
    let endpointRequest: unknown;
    const app = createApp({
      prisma: repository as any,
      authMiddleware: (req, _res, next) => {
        (req as any).userId = USER_ID;
        next();
      },
      generateGoalSubtasks: async (suggestionRequest) => {
        endpointRequest = suggestionRequest;
        return { items: ['Abrir o editor', 'Escolher o primeiro arquivo'] };
      },
    });

    const response = await request(app).post('/api/objectives/recover-actions').send({ locale: 'en-US' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      eligible: 1, attempted: 1, recovered: 1, failed: 0, deferred: 0, retryAfterMs: null,
    });
    assert.deepEqual(endpointRequest, {
      type: 'goal-subtasks',
      context: { goalTitle: 'Publicar o site', existingSubtasks: [], locale: 'en-US' },
    });
    assert.equal(Array.isArray(objectives[0].subgoals), true);

    const denied = createApp({
      prisma: repository as any,
      authMiddleware: (_req, res, _next) => res.status(401).json({ error: 'Unauthorized' }),
      generateGoalSubtasks: async () => ({ items: ['não deve executar'] }),
    });
    assert.equal((await request(denied).post('/api/objectives/recover-actions').send({})).status, 401);
  }

  {
    const { repository, getWrites } = createRepository([{
      id: 'single-flight', userId: USER_ID, title: 'Lançar projeto', progress: 0, archived: false,
      subgoals: [], updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    }]);
    let releaseGeneration!: (items: { items: string[] }) => void;
    const generated = new Promise<{ items: string[] }>((resolve) => { releaseGeneration = resolve; });
    let aiCalls = 0;
    const generator = async () => {
      aiCalls += 1;
      return generated;
    };
    const firstReplica = new ObjectiveActionRecoveryService(repository, generator);
    const secondReplica = new ObjectiveActionRecoveryService(repository, generator);

    const first = firstReplica.recover({ userId: USER_ID, locale: 'pt-BR' });
    const second = secondReplica.recover({ userId: USER_ID, locale: 'pt-BR' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(aiCalls, 1, 'duas requisições concorrentes devem compartilhar a mesma geração');
    releaseGeneration({ items: ['Abrir o arquivo do projeto', 'Escrever o título do projeto'] });
    const replicaResults = await Promise.all([first, second]);
    assert.equal(aiCalls, 1);
    assert.equal(getWrites(), 1);
    assert.equal(replicaResults.filter((result) => result.attempted === 1).length, 1);
    assert.equal(replicaResults.filter((result) => result.deferred === 1).length, 1);
  }

  {
    let now = 20_000;
    const { repository, getWrites } = createRepository([{
      id: 'fenced-worker', userId: USER_ID, title: 'Publicar relatório', progress: 0, archived: false,
      subgoals: [], updatedAt: new Date('2026-08-01T12:00:00.000Z'),
    }]);
    let releaseWorkerA!: (items: { items: string[] }) => void;
    let releaseWorkerB!: (items: { items: string[] }) => void;
    const workerAResult = new Promise<{ items: string[] }>((resolve) => { releaseWorkerA = resolve; });
    const workerBResult = new Promise<{ items: string[] }>((resolve) => { releaseWorkerB = resolve; });
    const workerA = new ObjectiveActionRecoveryService(repository, async () => workerAResult, {
      now: () => now,
      leaseMs: 100,
      generationTimeoutMs: 90,
    });
    const workerB = new ObjectiveActionRecoveryService(repository, async () => workerBResult, {
      now: () => now,
      leaseMs: 100,
      generationTimeoutMs: 90,
    });

    const first = workerA.recover({ userId: USER_ID });
    await new Promise((resolve) => setImmediate(resolve));
    now += 101;
    const second = workerB.recover({ userId: USER_ID });
    await new Promise((resolve) => setImmediate(resolve));

    releaseWorkerA({ items: ['Abrir o relatório antigo', 'Copiar o primeiro indicador'] });
    const staleWorker = await first;
    assert.equal(staleWorker.deferred, 1, 'worker com token vencido não pode gravar depois que outro assumiu');
    assert.equal(getWrites(), 0, 'fencing deve ocorrer antes do CAS do objetivo');

    releaseWorkerB({ items: ['Abrir o relatório atual', 'Escrever o primeiro indicador'] });
    const currentWorker = await second;
    assert.equal(currentWorker.recovered, 1);
    assert.equal(getWrites(), 1, 'somente o worker dono da lease renovada pode persistir');
  }

  {
    const { repository, getWrites } = createRepository([{
      id: 'generation-timeout', userId: USER_ID, title: 'Objetivo com IA lenta', progress: 0, archived: false,
      subgoals: [],
    }]);
    const service = new ObjectiveActionRecoveryService(repository, async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { items: ['Abrir o arquivo', 'Escrever uma linha'] };
    }, { leaseMs: 60, generationTimeoutMs: 20 } as any);

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const result = await service.recover({ userId: USER_ID });
      assert.equal(result.failed, 1, 'geração deve encerrar antes da lease e entrar em backoff');
      assert.equal(getWrites(), 0);
    } finally {
      console.warn = originalWarn;
    }
  }

  {
    const originalUpdatedAt = new Date('2026-08-01T12:00:00.000Z');
    const { repository, objectives, getWrites } = createRepository([{
      id: 'renamed-during-generation', userId: USER_ID, title: 'Nome antigo', progress: 0, archived: false,
      subgoals: [], updatedAt: originalUpdatedAt,
    }]);
    const service = new ObjectiveActionRecoveryService(repository, async () => {
      objectives[0].title = 'Nome novo';
      objectives[0].updatedAt = new Date('2026-08-01T12:01:00.000Z');
      return { items: ['Abrir o arquivo referente ao nome antigo', 'Escrever o nome antigo no arquivo'] };
    });

    const result = await service.recover({ userId: USER_ID });

    assert.deepEqual(result, {
      eligible: 1, attempted: 1, recovered: 0, failed: 0, deferred: 1, retryAfterMs: 0,
    });
    assert.equal(getWrites(), 0, 'CAS deve impedir ações geradas para um título desatualizado');
    assert.deepEqual(objectives[0].subgoals, []);
  }

  {
    const fixtures = Array.from({ length: 5 }, (_, index): ObjectiveFixture => ({
      id: `budget-${index + 1}`, userId: USER_ID, title: `Objetivo ${index + 1}`,
      progress: 0, archived: false, subgoals: [],
    }));
    const { repository, getWrites } = createRepository(fixtures);
    let aiCalls = 0;
    const service = new ObjectiveActionRecoveryService(repository, async () => {
      aiCalls += 1;
      return { items: ['Abrir o material', 'Separar a primeira página'] };
    });

    const first = await service.recover({ userId: USER_ID });

    assert.deepEqual(first, {
      eligible: 5, attempted: 3, recovered: 3, failed: 0, deferred: 2, retryAfterMs: 0,
    });
    assert.equal(aiCalls, 3);
    assert.equal(getWrites(), 3);
  }

  {
    let now = 1_000;
    const { repository, getWrites } = createRepository([{
      id: 'backoff', userId: USER_ID, title: 'Objetivo com falha', progress: 0, archived: false,
      subgoals: [],
    }]);
    let aiCalls = 0;
    const generator = async () => {
      aiCalls += 1;
      throw new Error('AI unavailable');
    };
    const service = new ObjectiveActionRecoveryService(repository, generator, { now: () => now, backoffMs: 60_000 });
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const failed = await service.recover({ userId: USER_ID });
      const restartedService = new ObjectiveActionRecoveryService(repository, generator, { now: () => now, backoffMs: 60_000 });
      const deferred = await restartedService.recover({ userId: USER_ID });
      now += 30_000;
      const stillDeferred = await restartedService.recover({ userId: USER_ID });

      assert.deepEqual(failed, {
        eligible: 1, attempted: 1, recovered: 0, failed: 1, deferred: 0, retryAfterMs: 60_000,
      });
      assert.deepEqual(deferred, {
        eligible: 1, attempted: 0, recovered: 0, failed: 0, deferred: 1, retryAfterMs: 60_000,
      });
      assert.equal(stillDeferred.retryAfterMs, 30_000);
      assert.equal(aiCalls, 1, 'backoff não pode repetir custo enquanto ainda está ativo');
      assert.equal(getWrites(), 0);
    } finally {
      console.warn = originalWarn;
    }
  }

  {
    let now = 10_000;
    const { repository, claims, getWrites } = createRepository([{
      id: 'expired-lease', userId: USER_ID, title: 'Objetivo após queda', progress: 0, archived: false,
      subgoals: [],
    }]);
    claims.push({
      userId: USER_ID,
      objectiveId: 'expired-lease',
      leaseToken: 'worker-that-crashed',
      leaseUntil: new Date(now + 120_000),
      retryNotBefore: null,
      attempts: 1,
      lastError: null,
    });
    let aiCalls = 0;
    const generator = async () => {
      aiCalls += 1;
      return { items: ['Abrir o documento', 'Escrever a primeira linha'] };
    };

    const beforeExpiry = await new ObjectiveActionRecoveryService(repository, generator, { now: () => now })
      .recover({ userId: USER_ID });
    now += 120_001;
    const afterRestart = await new ObjectiveActionRecoveryService(repository, generator, { now: () => now })
      .recover({ userId: USER_ID });

    assert.deepEqual(beforeExpiry, {
      eligible: 1, attempted: 0, recovered: 0, failed: 0, deferred: 1, retryAfterMs: 120_000,
    });
    assert.deepEqual(afterRestart, {
      eligible: 1, attempted: 1, recovered: 1, failed: 0, deferred: 0, retryAfterMs: null,
    });
    assert.equal(aiCalls, 1, 'lease expirada deve permitir recuperação segura após queda/restart');
    assert.equal(getWrites(), 1);
  }

  {
    const { repository, getWrites } = createRepository([{
      id: 'one-action', userId: USER_ID, title: 'Objetivo amplo', progress: 0, archived: false,
      subgoals: [],
    }]);
    const service = new ObjectiveActionRecoveryService(repository, async () => ({
      items: ['Abrir o material'],
    }));

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const result = await service.recover({ userId: USER_ID });
      assert.equal(result.failed, 1, 'uma única microação não satisfaz o contrato de objetivo');
      assert.equal(result.recovered, 0);
      assert.equal(getWrites(), 0);
    } finally {
      console.warn = originalWarn;
    }
  }
}

run().then(() => console.log('objective-action-recovery tests passed'));
