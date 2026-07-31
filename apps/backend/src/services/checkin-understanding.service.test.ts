import assert from 'node:assert/strict';

import { CHECKIN_UTTERANCES_PT_BR } from './checkin-utterances.pt-BR';

async function run() {
  let serviceModule: typeof import('./checkin-understanding.service');
  try {
    serviceModule = await import('./checkin-understanding.service');
  } catch {
    assert.fail('CheckinUnderstandingService ainda não existe');
  }

  for (const utterance of CHECKIN_UTTERANCES_PT_BR) {
    const result = serviceModule.CheckinUnderstandingService.understand({
      message: utterance.text,
      localDate: '2026-07-31',
      occurredAt: '2026-07-31T12:00:00.000Z',
      source: 'aura_text',
      sourceMessageId: 'message-1',
      idempotencyKey: 'session-1:message-1',
    });
    assert.equal(result.status, utterance.status, utterance.text);
    if ('mood' in utterance) assert.equal(result.mood.value, utterance.mood, utterance.text);
    if ('energy' in utterance) assert.equal(result.energy.value, utterance.energy, utterance.text);
  }

  const exact = serviceModule.CheckinUnderstandingService.understand({
    message: 'Estou chateada e cansada',
    localDate: '2026-07-31',
    occurredAt: '2026-07-31T12:00:00.000Z',
    source: 'aura_text',
    sourceMessageId: 'message-1',
    idempotencyKey: 'session-1:message-1',
  });
  assert.deepEqual(exact.emotions, ['sad', 'tired']);
  assert.equal(exact.mood.provenance, 'inferred');
  assert.equal(exact.energy.provenance, 'inferred');
  assert.ok(exact.mood.evidence.includes('chateada'));
  assert.ok(exact.energy.evidence.includes('cansada'));
  assert.equal(exact.clarity.value, null);
  assert.equal(exact.irritability.value, null);
  assert.equal(exact.physical.value, null);
  assert.equal(exact.social.value, null);
  assert.equal(exact.note, 'Estou chateada e cansada');

  const candidate = serviceModule.CheckinUnderstandingService.understand({
    message: 'Hoje não estou conseguindo explicar direito',
    localDate: '2026-07-31',
    occurredAt: '2026-07-31T12:00:00.000Z',
    source: 'aura_voice',
    sourceMessageId: 'voice-1',
    idempotencyKey: 'voice-session:voice-1',
    candidate: { moodScore: 4, energyScore: 3, emotions: ['sad'], factors: ['overwhelmed'] },
  });
  assert.equal(candidate.status, 'ready');
  assert.equal(candidate.mood.confidence, 0.7);
  assert.deepEqual(candidate.factors, ['overwhelmed']);

  const patternReflection = serviceModule.CheckinUnderstandingService.understand({
    message: 'Percebi que fico sobrecarregada quando aceito tudo de uma vez.',
    localDate: '2026-07-31',
    source: 'aura_text',
  });
  assert.equal(patternReflection.status, 'unsupported');
}

void run().then(() => console.log('checkin-understanding.service tests passed'));
