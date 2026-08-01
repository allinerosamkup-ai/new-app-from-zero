import assert from 'node:assert/strict';

import { ObjectiveProgressionService } from './objective-progression.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OBJECTIVE_ID = '660e8400-e29b-41d4-a716-446655440000';

function createRepository(subgoals: unknown[]) {
  const objective = {
    id: OBJECTIVE_ID,
    userId: USER_ID,
    title: 'Publicar portfólio',
    progress: 0,
    subgoals,
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
      { id: 'one', title: 'Separar fotos', done: false, order: 0 },
      { id: 'two', title: 'Escolher capa', done: false, order: 1 },
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
      { id: 'one', title: 'Separar fotos', done: true, order: 0, aiGenerated: false },
      { id: 'two', title: 'Escolher capa', done: false, order: 1, aiGenerated: false },
    ]);
  }

  {
    const { repository, objective } = createRepository([
      { id: 'only', title: 'Enviar versão final', completed: false },
    ]);
    const service = new ObjectiveProgressionService(repository);

    const first = await service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'only' });
    const duplicate = await service.completeActiveAction({ userId: USER_ID, objectiveId: OBJECTIVE_ID, subgoalId: 'only' });

    assert.equal(first.objectiveCompletedNow, true);
    assert.equal(duplicate.completedNow, false);
    assert.equal(duplicate.objectiveCompletedNow, false);
    assert.equal(objective.progress, 100);
    assert.deepEqual(objective.subgoals, [
      { id: 'only', title: 'Enviar versão final', done: true, order: 0, aiGenerated: false },
    ]);
  }
}

run().then(() => console.log('objective-progression tests passed'));
