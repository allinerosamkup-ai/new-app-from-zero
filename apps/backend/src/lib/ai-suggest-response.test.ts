import assert from 'node:assert/strict';

import {
  normalizeAiSuggestion,
  usesJsonObjectResponse,
} from './ai-suggest-response';

function run() {
  assert.equal(usesJsonObjectResponse('goal-subtasks'), true);
  assert.equal(usesJsonObjectResponse('goal-capture-dialogue'), true);
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

  assert.deepEqual(
    normalizeAiSuggestion('goal-capture-dialogue', '{"status":"needs_clarification","question":"Qual resultado você quer ver primeiro?","summary":"Quer mudar algo importante.","kind":"inbox","title":"Mudar algo importante","firstActions":[],"linkedGoalTitle":null}'),
    {
      status: 'needs_clarification',
      question: 'Qual resultado você quer ver primeiro?',
      summary: 'Quer mudar algo importante.',
      kind: 'inbox',
      title: 'Mudar algo importante',
      firstActions: [],
      linkedGoalTitle: null,
    },
  );
}

run();
console.log('ai-suggest-response tests passed');
