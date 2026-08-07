import assert from 'node:assert/strict';

import { findEquivalentActionWithLlm } from './action-equivalence.service';

/** Cliente falso: devolve o JSON que o teste quiser, sem rede. */
function fakeClient(content: string | null, onCall?: (args: any) => void) {
  return async () => ({
    chat: {
      completions: {
        create: async (args: any) => {
          onCall?.(args);
          if (content === null) throw new Error('rede caiu');
          return { choices: [{ message: { content } }] };
        },
      },
    },
  });
}

const EXISTING = [
  { id: 'a1', text: 'Comprar pão' },
  { id: 'a2', text: 'Ligar para a médica' },
];

async function run() {
  // ── Caso que motiva tudo: sinônimo real, que o lexical não pega ──
  {
    const result = await findEquivalentActionWithLlm({
      candidate: 'Passar na padaria',
      existing: EXISTING,
      openaiFactory: fakeClient('{"duplicateOf":"a1","reason":"mesma compra"}'),
    });
    assert.equal(result.duplicateOf, 'a1');
    assert.equal(result.degraded, false);
  }

  // ── Ação nova de verdade ──
  {
    const result = await findEquivalentActionWithLlm({
      candidate: 'Caminhar 20 minutos',
      existing: EXISTING,
      openaiFactory: fakeClient('{"duplicateOf":null,"reason":null}'),
    });
    assert.equal(result.duplicateOf, null);
    assert.equal(result.degraded, false);
  }

  // ── Alucinação: id que não está na lista é descartado ──
  // Sem esta checagem, o modelo inventando um id apagaria em silêncio uma ação
  // nova da pessoa — o erro mais caro possível aqui.
  {
    const result = await findEquivalentActionWithLlm({
      candidate: 'Regar as plantas',
      existing: EXISTING,
      openaiFactory: fakeClient('{"duplicateOf":"id-que-nao-existe","reason":"inventado"}'),
    });
    assert.equal(result.duplicateOf, null);
  }

  // ── Falhas sempre permitem criar ──
  for (const bad of [null, 'isso não é json', '{"duplicateOf":']) {
    const result = await findEquivalentActionWithLlm({
      candidate: 'Qualquer coisa',
      existing: EXISTING,
      openaiFactory: fakeClient(bad as string | null),
    });
    assert.equal(result.duplicateOf, null, `entrada ${JSON.stringify(bad)} deveria permitir criar`);
    assert.equal(result.degraded, true);
  }

  // ── Sem lista ou sem candidato, nem chama o modelo ──
  {
    let called = false;
    const factory = fakeClient('{"duplicateOf":"a1"}', () => { called = true; });

    assert.equal((await findEquivalentActionWithLlm({ candidate: 'x', existing: [], openaiFactory: factory })).duplicateOf, null);
    assert.equal((await findEquivalentActionWithLlm({ candidate: '   ', existing: EXISTING, openaiFactory: factory })).duplicateOf, null);
    assert.equal(called, false, 'não pode gastar chamada quando não há o que comparar');
  }

  // ── Lista longa é cortada antes de ir para o modelo ──
  {
    let sentCount = 0;
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}`, text: `Ação ${i}` }));
    const factory = fakeClient('{"duplicateOf":null}', (args) => {
      const userMsg = args.messages.find((m: any) => m.role === 'user').content;
      sentCount = (userMsg.match(/^\d+\. \[/gm) || []).length;
    });

    await findEquivalentActionWithLlm({ candidate: 'Nova', existing: many, openaiFactory: factory });
    assert.ok(sentCount <= 40, `enviou ${sentCount} candidatos; o teto é 40`);
  }

  // ── Determinismo: temperatura pelo helper e resposta em JSON ──
  //
  // Modelo que aceita temperatura recebe 0, porque dedupe não pode variar entre
  // chamadas iguais. Modelo gpt-5/o-series NÃO aceita e o campo tem que sair da
  // requisição: mandar 0 ali dá 400, e como a falha é engolida (o item é criado
  // do mesmo jeito), o dedupe morre calado e a pessoa vê ação repetida.
  {
    const originalModel = process.env.OPENAI_MODEL;
    try {
      process.env.OPENAI_MODEL = 'gpt-4.1-mini';
      let args: any = null;
      await findEquivalentActionWithLlm({
        candidate: 'Nova',
        existing: EXISTING,
        openaiFactory: fakeClient('{"duplicateOf":null}', (a) => { args = a; }),
      });
      assert.equal(args.temperature, 0, 'dedupe não pode variar entre chamadas iguais');
      assert.equal(args.response_format.type, 'json_object');

      process.env.OPENAI_MODEL = 'gpt-5.4-mini';
      let reasoningArgs: any = null;
      await findEquivalentActionWithLlm({
        candidate: 'Nova',
        existing: EXISTING,
        openaiFactory: fakeClient('{"duplicateOf":null}', (a) => { reasoningArgs = a; }),
      });
      assert.equal(
        'temperature' in reasoningArgs,
        false,
        'modelo de raciocínio recusa temperatura custom; o campo tem que ser omitido',
      );
      assert.equal(reasoningArgs.response_format.type, 'json_object');
    } finally {
      if (originalModel === undefined) delete process.env.OPENAI_MODEL;
      else process.env.OPENAI_MODEL = originalModel;
    }
  }
}

run()
  .then(() => console.log('action-equivalence.service tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
