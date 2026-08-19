import assert from 'node:assert/strict';

import { ObjectiveProgressionService } from './objective-progression.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OBJECTIVE_ID = '660e8400-e29b-41d4-a716-446655440000';

function createRepository(subgoals: unknown[], milestones: unknown[] = []) {
  const objective = {
    id: OBJECTIVE_ID,
    userId: USER_ID,
    title: 'Publicar portfólio',
    progress: 0,
    subgoals,
    milestones,
    pathVersion: 1,
  };

  const repository: any = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(repository),
    objective: {
      findFirst: async ({ where }: any) => (
        where.id === OBJECTIVE_ID && where.userId === USER_ID ? objective : null
      ),
      update: async ({ data }: any) => {
        Object.assign(objective, data);
        return objective;
      },
    },
  };

  return { repository, objective };
}

async function run() {
  {
    const { repository, objective } = createRepository([
      { id: 'one', title: 'Separar três fotos para o portfólio', done: false, order: 0, doneWhen: 'três fotos estiverem em uma pasta do portfólio' },
      { id: 'two', title: 'Selecionar a foto de capa do portfólio', done: false, order: 1, doneWhen: 'uma foto estiver marcada como capa' },
    ]);
    const service = new ObjectiveProgressionService(repository);

    await assert.rejects(
      service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'two' }),
      /objective_action_not_active/,
    );

    const result = await service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'one' });
    assert.equal(result.completedNow, true);
    assert.equal(result.objectiveCompletedNow, false);
    assert.equal(result.nextAction?.id, 'two');
    assert.deepEqual(objective.subgoals, [
      { id: 'one', title: 'Separar três fotos para o portfólio', done: true, order: 0, aiGenerated: false, doneWhen: 'três fotos estiverem em uma pasta do portfólio', status: 'done' },
      { id: 'two', title: 'Selecionar a foto de capa do portfólio', done: false, order: 1, aiGenerated: false, doneWhen: 'uma foto estiver marcada como capa' },
    ]);
    assert.equal(objective.pathVersion, 2);
  }

  {
    const { repository, objective } = createRepository([
      { id: 'only', title: 'Enviar a versão final do portfólio para Ana', completed: false, doneWhen: 'o e-mail enviado aparecer na pasta Enviados' },
    ]);
    const service = new ObjectiveProgressionService(repository);

    const first = await service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'only' });
    const duplicate = await service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'only' });

    assert.equal(first.objectiveCompletedNow, true);
    assert.equal(duplicate.completedNow, false);
    assert.equal(duplicate.objectiveCompletedNow, false);
    assert.equal(objective.progress, 100);
    assert.deepEqual(objective.subgoals, [
      { id: 'only', title: 'Enviar a versão final do portfólio para Ana', done: true, order: 0, aiGenerated: false, doneWhen: 'o e-mail enviado aparecer na pasta Enviados', status: 'done' },
    ]);
  }

  {
    const { repository, objective } = createRepository(
      [{ id: 'stage-action', title: 'Enviar o arquivo da etapa atual para Ana', done: false, order: 0, milestoneId: 'm-1', doneWhen: 'o e-mail enviado aparecer na pasta Enviados' }],
      [
        { id: 'm-1', title: 'Etapa atual', order: 0, doneWhen: 'Atual concluída', actions: [] },
        { id: 'm-2', title: 'Etapa futura', order: 1, doneWhen: 'Futura concluída', actions: [] },
      ],
    );
    const service = new ObjectiveProgressionService(repository);

    const result = await service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'stage-action' });

    assert.equal(result.objectiveCompletedNow, false);
    assert.equal(result.nextMilestone?.id, 'm-2');
    assert.ok(objective.progress < 100);
  }
}

run().then(() => console.log('objective-progression tests passed'));
