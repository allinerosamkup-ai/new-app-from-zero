import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../index';
import {
  buildGoalSubtasksPrompt,
  ObjectiveActionRecoveryService,
} from './objective-action-recovery.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

type ObjectiveFixture = {
  id: string;
  userId: string;
  title: string;
  progress: number;
  archived: boolean;
  subgoals: unknown;
};

function createRepository(initial: ObjectiveFixture[]) {
  const objectives = structuredClone(initial);
  let writes = 0;

  const repository = {
    objective: {
      findMany: async () => objectives,
      updateMany: async ({ where, data }: any) => {
        const objective = objectives.find((item) => item.id === where.id && item.userId === where.userId);
        if (!objective || objective.archived || objective.progress >= 100) return { count: 0 };
        if (JSON.stringify(objective.subgoals) !== JSON.stringify(where.subgoals.equals)) return { count: 0 };
        objective.subgoals = structuredClone(data.subgoals);
        writes += 1;
        return { count: 1 };
      },
    },
  };

  return { repository, objectives, getWrites: () => writes };
}

async function run() {
  assert.match(
    buildGoalSubtasksPrompt({ goalTitle: 'Publicar o portfólio', existingSubtasks: [] }),
    /Meta: "Publicar o portfólio"/,
    'a recuperação deve reutilizar o contrato de prompt goal-subtasks',
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
      context: { goalTitle: 'Publicar o portfólio', existingSubtasks: [] },
    }]);
    assert.deepEqual(result, { eligible: 1, recovered: 1, failed: 0 });
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
    assert.deepEqual(retry, { eligible: 0, recovered: 0, failed: 0 });
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

    assert.deepEqual(result, { eligible: 1, recovered: 0, failed: 1 });
    assert.equal(getWrites(), 0);
    assert.deepEqual(objectives[0].subgoals, original, 'falha deve manter o registro original intacto');
  }

  {
    const { repository, objectives } = createRepository([{
      id: 'endpoint-active', userId: USER_ID, title: 'Publicar o site', progress: 0, archived: false,
      subgoals: [],
    }]);
    const app = createApp({
      prisma: repository as any,
      authMiddleware: (req, _res, next) => {
        (req as any).userId = USER_ID;
        next();
      },
      generateGoalSubtasks: async () => ({ items: ['Abrir o editor', 'Escolher o primeiro arquivo'] }),
    });

    const response = await request(app).post('/api/objectives/recover-actions').send({});

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { eligible: 1, recovered: 1, failed: 0 });
    assert.equal(Array.isArray(objectives[0].subgoals), true);

    const denied = createApp({
      prisma: repository as any,
      authMiddleware: (_req, res, _next) => res.status(401).json({ error: 'Unauthorized' }),
      generateGoalSubtasks: async () => ({ items: ['não deve executar'] }),
    });
    assert.equal((await request(denied).post('/api/objectives/recover-actions').send({})).status, 401);
  }
}

run().then(() => console.log('objective-action-recovery tests passed'));
