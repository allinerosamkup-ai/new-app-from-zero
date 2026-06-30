import assert from 'node:assert/strict';

import { normalizeObjectiveSubgoals } from './objective-subgoals';

function run() {
  assert.deepEqual(
    normalizeObjectiveSubgoals([
      { id: 'sg-1', title: 'Abrir o calendário', done: false },
      { id: 'sg-2', title: 'Mandar mensagem', done: true, aiGenerated: true },
    ]),
    [
      { id: 'sg-1', title: 'Abrir o calendário', done: false, aiGenerated: false },
      { id: 'sg-2', title: 'Mandar mensagem', done: true, aiGenerated: true },
    ],
  );
}

run();
console.log('objective-subgoals tests passed');
