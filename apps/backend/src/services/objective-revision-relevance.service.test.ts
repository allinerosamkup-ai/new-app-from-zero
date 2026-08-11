import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ObjectiveRevisionRelevanceService, buildObjectiveRevisionRelevancePrompt } from './objective-revision-relevance.service';

const input = {
  objectiveTitle: 'Conquistar clientes',
  resultDefinition: 'Fechar o primeiro contrato',
  currentReality: 'Tenho portfólio e Instagram',
  milestones: [{ id: 'm1', title: 'Apresentar o trabalho' }],
  currentActions: ['Selecionar três trabalhos do portfólio'],
  newContext: 'Decidi que não vou mais usar Instagram e recebi indicação de uma parceira.',
  source: 'journal' as const,
};

function client(responses: unknown[]) {
  const calls: string[] = [];
  return {
    calls,
    chat: { completions: { create: async ({ model }: any) => {
      calls.push(model);
      const body = responses.shift();
      return { choices: [{ message: { content: typeof body === 'string' ? body : JSON.stringify(body) } }] };
    } } },
  } as any;
}

describe('ObjectiveRevisionRelevanceService', () => {
  it('separa mudança estrutural de energia momentânea', () => {
    const prompt = buildObjectiveRevisionRelevancePrompt(input);
    assert.match(prompt, /muda materialmente/);
    assert.match(prompt, /energia ajusta somente o passo/);
    assert.match(prompt, /não autoriza reescrever a ambição/i);
  });

  it('aceita motivo estrutural validado', async () => {
    const result = await ObjectiveRevisionRelevanceService.evaluate(input, client([
      { relevant: true, reason: 'O canal disponível e a dependência de aquisição mudaram.' },
    ]));
    assert.equal(result.relevant, true);
    assert.match(result.reason ?? '', /canal disponível/);
  });

  it('falha fechada quando a resposta é inválida nos dois modelos', async () => {
    const fake = client(['inválido', { relevant: true, reason: null }]);
    const result = await ObjectiveRevisionRelevanceService.evaluate(input, fake);
    assert.deepEqual(result, { relevant: false, reason: null });
    assert.deepEqual(fake.calls, ['gpt-5.4-mini', 'gpt-4.1-mini']);
  });
});
