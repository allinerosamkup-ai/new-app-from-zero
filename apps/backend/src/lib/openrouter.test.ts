import assert from 'node:assert/strict';

import {
  DEFAULT_OPENROUTER_MAX_COMPLETION_TOKENS,
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterMaxCompletionTokens,
  getOpenRouterModel,
} from './openrouter';

async function run() {
  const originalModel = process.env.OPENAI_MODEL;
  const originalMaxTokens = process.env.OPENAI_MAX_COMPLETION_TOKENS;

  try {
    delete process.env.OPENAI_MODEL;
    assert.equal(getOpenRouterModel(), DEFAULT_OPENROUTER_MODEL);

    process.env.OPENAI_MODEL = 'google/gemma-4-31b-it:free';
    assert.equal(getOpenRouterModel(), 'google/gemma-4-31b-it:free');

    process.env.OPENAI_MODEL = '   ';
    assert.equal(getOpenRouterModel(), DEFAULT_OPENROUTER_MODEL);

    delete process.env.OPENAI_MAX_COMPLETION_TOKENS;
    assert.equal(getOpenRouterMaxCompletionTokens(), DEFAULT_OPENROUTER_MAX_COMPLETION_TOKENS);
    assert.equal(getOpenRouterMaxCompletionTokens(2200), 2200);
    assert.equal(getOpenRouterMaxCompletionTokens(5000), DEFAULT_OPENROUTER_MAX_COMPLETION_TOKENS);

    process.env.OPENAI_MAX_COMPLETION_TOKENS = '900';
    assert.equal(getOpenRouterMaxCompletionTokens(), 900);
    assert.equal(getOpenRouterMaxCompletionTokens(1200), 900);

    process.env.OPENAI_MAX_COMPLETION_TOKENS = 'invalid';
    assert.equal(getOpenRouterMaxCompletionTokens(1800), 1800);
  } finally {
    if (originalModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalModel;
    }

    if (originalMaxTokens === undefined) {
      delete process.env.OPENAI_MAX_COMPLETION_TOKENS;
    } else {
      process.env.OPENAI_MAX_COMPLETION_TOKENS = originalMaxTokens;
    }
  }
}

run()
  .then(() => {
    console.log('openrouter.model tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
