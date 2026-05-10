import assert from 'node:assert/strict';

import { AURA_EVAL_CASES } from './aura-eval/cases';
import { evaluateResponse } from './aura-eval/matchers';

/**
 * Deterministic guardrail for the Aura eval harness — no OpenAI calls.
 *
 * Goals:
 *   1. Every case has a non-empty rationale (so a failing case is
 *      explainable from the suite alone).
 *   2. Every case has at least one invariant (an empty `expects` would
 *      always pass and waste an API call).
 *   3. Domains that should ground in context (planning, home, checkin,
 *      aura-command) carry either mustReferenceAnchorFromContext or
 *      mustEndWithQuestionOrCallToAction. This prevents adding cases that
 *      forget to test grounding.
 *   4. journal-finalize cases require mustNotEndWithQuestion (the whole
 *      point of the domain).
 *   5. The matcher itself behaves on canonical inputs (smoke).
 */

const GROUNDING_DOMAINS = new Set(['planning', 'home', 'checkin', 'aura-command']);

function assertCases() {
  assert.ok(AURA_EVAL_CASES.length > 0, 'no cases defined');

  const ids = new Set<string>();
  for (const c of AURA_EVAL_CASES) {
    assert.ok(!ids.has(c.id), `duplicate case id: ${c.id}`);
    ids.add(c.id);

    assert.ok(c.rationale && c.rationale.trim().length > 10, `case ${c.id} missing rationale`);
    assert.ok(c.userMessage && c.userMessage.trim().length > 0, `case ${c.id} missing userMessage`);

    const invariantKeys = Object.keys(c.expects);
    assert.ok(invariantKeys.length > 0, `case ${c.id} has no invariants`);

    if (GROUNDING_DOMAINS.has(c.domain)) {
      const hasGroundingInvariant =
        Boolean(c.expects.mustReferenceAnchorFromContext) ||
        Boolean(c.expects.mustEndWithQuestionOrCallToAction);
      assert.ok(
        hasGroundingInvariant,
        `case ${c.id} (${c.domain}) must declare mustReferenceAnchorFromContext or mustEndWithQuestionOrCallToAction`,
      );
    }

    if (c.domain === 'journal-finalize') {
      assert.equal(
        c.expects.mustNotEndWithQuestion,
        true,
        `journal-finalize case ${c.id} must set mustNotEndWithQuestion: true`,
      );
    }
  }
}

function assertMatcherSmoke() {
  // mustInclude is case- and accent-insensitive
  assert.deepEqual(
    evaluateResponse('Pão fresco às 18h.', { mustInclude: ['pao', '18h'] }),
    [],
  );

  // mustNotEndWithQuestion fires
  const failures = evaluateResponse('Combinado. Quer agora?', {
    mustNotEndWithQuestion: true,
  });
  assert.equal(failures.length, 1, 'must detect trailing question');
  assert.equal(failures[0].invariant, 'mustNotEndWithQuestion');

  // maxSentences fires
  const tooLong = evaluateResponse('Um. Dois. Três. Quatro.', { maxSentences: 2 });
  assert.equal(tooLong.length, 1);
  assert.equal(tooLong[0].invariant, 'maxSentences');

  // mustReferenceAnchorFromContext fires when nothing matches
  const ungrounded = evaluateResponse('Tudo bem por aí?', {
    mustReferenceAnchorFromContext: ['contador', 'reunião 11h'],
  });
  assert.equal(ungrounded.length, 1);
  assert.equal(ungrounded[0].invariant, 'mustReferenceAnchorFromContext');
}

function run() {
  assertCases();
  assertMatcherSmoke();
  console.log('aura-eval (deterministic) tests passed');
}

run();
