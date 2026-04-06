import assert from 'node:assert/strict';

import {
  normalizeAiSuggestion,
  usesJsonObjectResponse,
} from './ai-suggest-response';

function run() {
  assert.equal(usesJsonObjectResponse('goal-subtasks'), true);
  assert.equal(usesJsonObjectResponse('goal-route'), true);
  assert.equal(usesJsonObjectResponse('task-title'), false);

  assert.deepEqual(
    normalizeAiSuggestion('goal-subtasks', '{"items":["Abrir o calendário","Separar a bolsa"]}'),
    { items: ['Abrir o calendário', 'Separar a bolsa'] },
  );

  assert.deepEqual(
    normalizeAiSuggestion('goal-subtasks', '["Abrir o calendário","Separar a bolsa"]'),
    { items: ['Abrir o calendário', 'Separar a bolsa'] },
  );

  assert.deepEqual(
    normalizeAiSuggestion('goal-route', '{"tipo":"meta","titulo":"Planejar viagem","meta_sugerida":null,"emoji":"🎯"}'),
    { tipo: 'meta', titulo: 'Planejar viagem', meta_sugerida: null, emoji: '🎯' },
  );
}

run();
console.log('ai-suggest-response tests passed');
