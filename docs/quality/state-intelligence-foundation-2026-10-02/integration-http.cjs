// Run only against integration-fixture.cjs after one real UI submission.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = 'http://127.0.0.1:4191';
async function json(url, body) {
  const response = await fetch(api + url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return { status: response.status, body: await response.json() };
}
(async () => {
  const initial = await json('/fixture/evidence');
  assert.equal(initial.body.rows.length, 1, 'one genuine UI POST must precede this proof');
  const row = initial.body.rows[0];
  const payload = { localDate: row.localDate.slice(0, 10), checkinSlot: row.checkinSlot, checkinPurpose: row.checkinPurpose, moodScore: row.moodScore, energyScore: row.energyScore, source: row.source, idempotencyKey: row.idempotencyKey, signalMetadata: row.signalMetadata, note: row.note, factors: row.factors, emotions: row.emotions };
  const retry = await json('/api/checkins', payload);
  assert.equal(retry.status, 200); assert.equal(retry.body.status, 'persisted'); assert.equal(retry.body.checkinId, row.id); assert.equal(retry.body.analysisStatus, 'unavailable');
  const changed = await json('/api/checkins', { ...payload, note: 'Cenário sintético: não quero mais viver.' });
  assert.equal(changed.status, 200); assert.equal(changed.body.checkinId, row.id); assert.equal(changed.body.analysisStatus, 'unavailable'); assert.equal(changed.body.riskSafety.route, 'crisis_protocol');
  const readback = await json('/api/checkins?days=90');
  assert.equal(readback.body.length, 1); assert.equal(readback.body[0].aiState.riskSafety.route, 'crisis_protocol'); assert.equal(readback.body[0].stateSummary, null); assert.equal(readback.body[0].aiState.analysisStatus, 'unavailable');
  await json('/fixture/mode', { failure: 'write' });
  const writeFailure = await json('/api/checkins', { ...payload, checkinSlot: 'evening-new', idempotencyKey: 'synthetic-write-failure', note: 'Cenário de escrita sem registro salvo.' });
  assert.equal(writeFailure.status, 500); assert.equal(writeFailure.body.status, undefined);
  await json('/fixture/mode', { failure: 'analysis' });
  const final = await json('/fixture/evidence'); assert.equal(final.body.rows.length, 1);
  const evidence = { declaration: final.body.declaration, checks: { genuineUiInitialSubmit: 'PASS', identicalRetryOneRecord: 'PASS', changedSameKeyPreservesSafety: 'PASS', explicitSourceReadback: 'PASS', writeFailureDoesNotClaimPersisted: 'PASS' }, retry: retry.body, changed: changed.body, writeFailure, final: final.body };
  fs.writeFileSync(path.join(__dirname, 'integration-http-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('INTEGRATION_HTTP_PASS: real UI source + real routes/service + retry/correction/crisis/readback/write failure; synthetic repository/provider only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
