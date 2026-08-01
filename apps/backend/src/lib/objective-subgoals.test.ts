import assert from 'node:assert/strict';

import { normalizeObjectiveSubgoals } from './objective-subgoals';

function run() {
  assert.deepEqual(
    normalizeObjectiveSubgoals([
      { id: 'sg-1', title: 'Abrir o calendário', done: false },
      { id: 'sg-2', title: 'Mandar mensagem', done: true, aiGenerated: true },
    ]),
    [
      { id: 'sg-1', title: 'Abrir o calendário', done: false, order: 0, aiGenerated: false },
      { id: 'sg-2', title: 'Mandar mensagem', done: true, order: 1, aiGenerated: true },
    ],
  );

  assert.deepEqual(
    normalizeObjectiveSubgoals([
      { id: 'legacy-1', title: 'Separar referências', completed: true } as any,
      { id: 'legacy-2', title: 'Montar esboço', done: false, plannerBlockId: 'block-1' } as any,
    ]),
    [
      { id: 'legacy-1', title: 'Separar referências', done: true, order: 0, aiGenerated: false },
      { id: 'legacy-2', title: 'Montar esboço', done: false, order: 1, plannerBlockId: 'block-1', aiGenerated: false },
    ],
  );
}

run();
console.log('objective-subgoals tests passed');
