import assert from 'node:assert/strict';

async function run() {
  let contract: typeof import('./checkin-draft.contract');
  try {
    contract = await import('./checkin-draft.contract');
  } catch {
    assert.fail('CheckinDraftSchema ainda não existe');
  }

  const draft = contract.CheckinDraftSchema.parse({
    status: 'ready',
    localDate: '2026-07-31',
    occurredAt: '2026-07-31T12:00:00.000Z',
    source: 'aura_text',
    sourceMessageId: 'message-1',
    idempotencyKey: 'session-1:message-1',
    rawText: 'Estou chateada e cansada',
    note: 'Estou chateada e cansada',
    emotions: ['sad', 'tired'],
    factors: [],
    mood: { value: 3, provenance: 'inferred', confidence: 0.9, evidence: ['chateada'] },
    energy: { value: 3, provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
    clarity: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
    irritability: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
    physical: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
    social: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
    sleepScore: { value: null, provenance: 'absent', confidence: 0, evidence: [] },
    sleepHours: null,
  });

  assert.equal(draft.mood.provenance, 'inferred');
  assert.equal(draft.energy.value, 3);
  assert.equal(draft.clarity.value, null);
  assert.equal(draft.source, 'aura_text');

  assert.equal(contract.CheckinDraftSchema.safeParse({
    ...draft,
    mood: { value: 11, provenance: 'inferred', confidence: 0.9, evidence: ['ótima'] },
  }).success, false);
}

void run().then(() => console.log('checkin-draft.contract tests passed'));
