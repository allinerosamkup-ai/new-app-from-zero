import assert from 'node:assert/strict';

import { parseSseChunk } from './ai_service';

const input =
  'event: assistant.delta\n' +
  'data: {"chunk":"Olá, "}\n\n' +
  'event: assistant.completed\n' +
  'data: {"message":{"content":"Olá, estou com você."}}\n\n';

const parsed = parseSseChunk(input);

assert.equal(parsed.events.length, 2);
assert.equal(parsed.events[0].event, 'assistant.delta');
assert.equal(parsed.events[0].data.chunk, 'Olá, ');
assert.equal(parsed.events[1].event, 'assistant.completed');
assert.equal(parsed.events[1].data.message.content, 'Olá, estou com você.');
assert.equal(parsed.remainder, '');

console.log('mobile ai_service tests passed');
