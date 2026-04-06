import assert from 'node:assert/strict';

import { extractJsonValue } from './extract-json';

function run() {
  assert.deepEqual(
    extractJsonValue('{"message":"ok","tip":"respire"}'),
    { message: 'ok', tip: 'respire' },
  );

  assert.deepEqual(
    extractJsonValue('```json\n{"message":"ok","tip":"respire"}\n```'),
    { message: 'ok', tip: 'respire' },
  );

  assert.deepEqual(
    extractJsonValue('{"message":"Use a nota \\"{agora}\\" sem pressa.","tip":"Feche 1 aba primeiro."}'),
    { message: 'Use a nota "{agora}" sem pressa.', tip: 'Feche 1 aba primeiro.' },
  );

  assert.deepEqual(
    extractJsonValue('Resposta:\n{"items":["um","dois"],"meta":{"title":"Fechar {rascunho}"}}'),
    { items: ['um', 'dois'], meta: { title: 'Fechar {rascunho}' } },
  );
}

run();
console.log('extract-json tests passed');
