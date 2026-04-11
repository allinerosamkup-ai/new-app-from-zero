import assert from 'node:assert/strict';

import {
  DEFAULT_OPENAI_MAX_COMPLETION_TOKENS,
  DEFAULT_OPENAI_MODEL,
  getOpenAiMaxCompletionTokens,
  getOpenAiModel,
} from './openai-config';

async function run() {
  const originalModel = process.env.OPENAI_MODEL;
  const originalMaxTokens = process.env.OPENAI_MAX_COMPLETION_TOKENS;

  try {
    delete process.env.OPENAI_MODEL;
    assert.equal(getOpenAiModel(), DEFAULT_OPENAI_MODEL);

    process.env.OPENAI_MODEL = 'gpt-5.4';
    assert.equal(getOpenAiModel(), 'gpt-5.4');

    process.env.OPENAI_MODEL = '   ';
    assert.equal(getOpenAiModel(), DEFAULT_OPENAI_MODEL);

    delete process.env.OPENAI_MAX_COMPLETION_TOKENS;
    assert.equal(getOpenAiMaxCompletionTokens(), DEFAULT_OPENAI_MAX_COMPLETION_TOKENS);
    assert.equal(getOpenAiMaxCompletionTokens(2200), 2200);
    assert.equal(getOpenAiMaxCompletionTokens(5000), DEFAULT_OPENAI_MAX_COMPLETION_TOKENS);

    process.env.OPENAI_MAX_COMPLETION_TOKENS = '900';
    assert.equal(getOpenAiMaxCompletionTokens(), 900);
    assert.equal(getOpenAiMaxCompletionTokens(1200), 900);

    process.env.OPENAI_MAX_COMPLETION_TOKENS = 'invalid';
    assert.equal(getOpenAiMaxCompletionTokens(1800), 1800);
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
    console.log('openai-config tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
