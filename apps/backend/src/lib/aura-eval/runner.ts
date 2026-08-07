/**
 * Aura eval runner — calls OpenAI for each fixture and scores against the
 * deterministic invariants in matchers.ts.
 *
 * Run locally:   npm run aura:eval --workspace=@app/backend
 * Run in CI:     same command. Requires OPENAI_API_KEY in env.
 *
 * Pass criterion: at least PASS_THRESHOLD cases pass with zero failures.
 * Default 10 of 12. Adjust as the case suite grows.
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

import { buildAuraSystemPrompt } from '../aura-prompt';
import { getOpenAiMaxCompletionTokens, getOpenAiModel, openAiTemperature } from '../openai-config';
import { AURA_EVAL_CASES, type AuraEvalCase } from './cases';
import { evaluateResponse, type EvalFailure } from './matchers';

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env'), override: false });

const PASS_THRESHOLD = Number(process.env.AURA_EVAL_PASS_THRESHOLD ?? '10');
const MAX_TOKENS = Number(process.env.AURA_EVAL_MAX_TOKENS ?? '600');

type CaseResult = {
  case: AuraEvalCase;
  response: string;
  failures: EvalFailure[];
  durationMs: number;
};

async function runOne(client: OpenAI, model: string, evalCase: AuraEvalCase): Promise<CaseResult> {
  const systemPrompt = buildAuraSystemPrompt({
    domain: evalCase.domain,
    ...evalCase.promptInputs,
  });

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...(evalCase.history ?? []),
    { role: 'user', content: evalCase.userMessage },
  ];

  const startedAt = Date.now();
  const completion = await client.chat.completions.create({
    // Sem helper, `temperature: 0` + `max_tokens` davam 400 em gpt-5/o-series e
    // a eval inteira reprovava por erro de request, não por qualidade.
    model,
    messages,
    ...openAiTemperature(model, 0),
    seed: 42,
    max_completion_tokens: getOpenAiMaxCompletionTokens(MAX_TOKENS),
  } as any);
  const response = completion.choices[0]?.message?.content ?? '';
  const failures = evaluateResponse(response, evalCase.expects);

  return {
    case: evalCase,
    response,
    failures,
    durationMs: Date.now() - startedAt,
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY missing — aura:eval requires a real API key.');
    process.exit(2);
  }

  const client = new OpenAI({ apiKey });
  const model = getOpenAiModel();
  console.log(`Running ${AURA_EVAL_CASES.length} cases against model "${model}"…`);

  const results: CaseResult[] = [];
  for (const c of AURA_EVAL_CASES) {
    process.stdout.write(`  ▶ ${c.id} … `);
    try {
      const result = await runOne(client, model, c);
      results.push(result);
      const status = result.failures.length === 0 ? 'PASS' : `FAIL (${result.failures.length})`;
      process.stdout.write(`${status} (${result.durationMs}ms)\n`);
    } catch (err) {
      results.push({
        case: c,
        response: '',
        failures: [{ invariant: 'runner', message: String(err) }],
        durationMs: 0,
      });
      process.stdout.write('ERROR\n');
    }
  }

  const passed = results.filter((r) => r.failures.length === 0).length;
  const failed = results.length - passed;

  console.log('\n--- Results ---');
  for (const r of results) {
    if (r.failures.length === 0) continue;
    console.log(`\n[${r.case.id}] ${r.case.domain}`);
    console.log(`  rationale: ${r.case.rationale}`);
    for (const f of r.failures) {
      console.log(`  ✗ ${f.invariant}: ${f.message}`);
    }
    console.log(`  response: ${r.response.slice(0, 280).replace(/\n/g, ' ⏎ ')}…`);
  }

  console.log(`\n${passed}/${results.length} passed (threshold ${PASS_THRESHOLD}).`);

  if (passed < PASS_THRESHOLD) {
    console.error(`Aura eval below threshold (${passed} < ${PASS_THRESHOLD}).`);
    process.exit(1);
  }
  if (failed > 0) {
    console.warn(`Note: ${failed} case(s) below par but threshold met.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
