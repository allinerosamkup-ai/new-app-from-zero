import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildContextText,
  buildGoalDecompositionPrompt,
  detectUnsupportedSpecificity,
  GoalIntelligenceService,
  type GoalStep,
} from './goal-intelligence.service';

const SALA = 'Deixar a sala pronta para uso';

function step(title: string, basedOn: GoalStep['basedOn'] = 'inferred'): GoalStep {
  return { title, basedOn };
}

describe('detectUnsupportedSpecificity', () => {
  it('reprova a fita crepe: objeto e problema que ninguém informou', () => {
    const verdict = detectUnsupportedSpecificity(
      step('Pegue um rolo de fita crepe e confira se há área solta no chão da sala'),
      SALA,
    );

    assert.equal(verdict.ok, false);
    assert.match(verdict.ok === false ? verdict.reason : '', /fita|crepe|rolo/);
  });

  it('reprova detalhe arbitrário como "caixa azul"', () => {
    const verdict = detectUnsupportedSpecificity(
      step('Coloque os objetos pequenos dentro da caixa azul'),
      SALA,
    );

    assert.equal(verdict.ok, false);
  });

  it('aprova ação concreta que não inventa objeto', () => {
    const verdict = detectUnsupportedSpecificity(
      step('Retire da sala tudo o que não deveria estar ali'),
      SALA,
    );

    assert.equal(verdict.ok, true);
  });

  it('aprova quando o objeto veio da própria pessoa', () => {
    const context = buildContextText({
      goalTitle: SALA,
      userStatements: ['Só falta terminar de organizar os móveis e colocar minhas coisas de trabalho'],
    });

    const verdict = detectUnsupportedSpecificity(
      step('Coloque no lugar os móveis que ainda estão fora de posição', 'stated'),
      context,
    );

    assert.equal(verdict.ok, true);
  });
});

describe('GoalIntelligenceService.screenSteps', () => {
  it('não reprova passo por vocabulário diferente do objetivo', () => {
    // Regressão de produção: "listar as categorias que você quer controlar" foi
    // descartado para "organizar minhas finanças" por não repetir palavra do
    // título. Pertinência é julgamento de significado, e isso é do validador.
    const result = GoalIntelligenceService.screenSteps(
      [
        step('Listar as categorias que você quer controlar'),
        step('Registrar os lançamentos mais recentes'),
        step('Conferir se está completo o suficiente para usar'),
      ],
      { goalTitle: 'Organizar minhas finanças' },
    );

    assert.equal(result.kept.length, 3);
    assert.equal(result.rejected.length, 0);
  });

  it('mantém o que se sustenta e descarta o que foi inventado', () => {
    const result = GoalIntelligenceService.screenSteps(
      [
        step('Retire da sala tudo o que não pertence a ela'),
        step('Pegue fita crepe e prenda o que estiver solto'),
        step('Organize os elementos principais da sala'),
      ],
      { goalTitle: SALA },
    );

    assert.equal(result.kept.length, 2);
    assert.equal(result.rejected.length, 1);
    assert.match(result.rejected[0].title, /fita crepe/);
  });

  it('deduplica passo repetido com outras palavras iguais', () => {
    const result = GoalIntelligenceService.screenSteps(
      [step('Organize a sala'), step('organize a  sala')],
      { goalTitle: SALA },
    );

    assert.equal(result.kept.length, 1);
  });
});

describe('buildGoalDecompositionPrompt', () => {
  it('proíbe inventar obstáculo e cita o caso real como exemplo ruim', () => {
    const prompt = buildGoalDecompositionPrompt({ goalTitle: SALA });

    assert.match(prompt, /NÃO INVENTAR OBSTÁCULO/);
    assert.match(prompt, /fita crepe/);
    assert.match(prompt, /basedOn/);
  });

  it('não pede micro-ação hiper-específica nem nomear objetos que não existem', () => {
    const prompt = buildGoalDecompositionPrompt({ goalTitle: SALA });

    assert.doesNotMatch(prompt, /hiper-específic/i);
    assert.doesNotMatch(prompt, /Nomeie objetos reais/i);
  });

  it('coloca o que a pessoa disse como única fonte de fato', () => {
    const prompt = buildGoalDecompositionPrompt({
      goalTitle: SALA,
      userStatements: ['Falta organizar os móveis'],
    });

    assert.match(prompt, /única fonte de fato/);
    assert.match(prompt, /Falta organizar os móveis/);
  });

  it('não oferece a pergunta como saída no contrato de decomposição', () => {
    const prompt = buildGoalDecompositionPrompt({ goalTitle: SALA });

    assert.match(prompt, /PERGUNTAR NÃO É UMA OPÇÃO/);
    // O JSON de saída não tem campo de pergunta: sem a opção, não há escolha.
    assert.doesNotMatch(prompt, /"question"\s*:/);
  });

  it('lembra que ela já contou, quando contou', () => {
    const prompt = buildGoalDecompositionPrompt({
      goalTitle: SALA,
      userStatements: ['Só falta organizar os móveis e colocar minhas coisas de trabalho'],
    });

    assert.match(prompt, /JÁ CONTOU/);
  });
});

describe('GoalIntelligenceService.decompose', () => {
  function clientReturning(...payloads: unknown[]) {
    let call = 0;
    return {
      chat: {
        completions: {
          create: async () => {
            const payload = payloads[Math.min(call, payloads.length - 1)];
            call += 1;
            return { choices: [{ message: { content: JSON.stringify(payload) } }] };
          },
        },
      },
    } as any;
  }

  it('devolve passos quando geração e validação concordam', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: SALA },
      clientReturning(
        {
          resultDefinition: 'A sala funcional para o uso dela',
          assumptions: [],
          steps: [
            { title: 'Retire da sala o que não pertence ali', basedOn: 'inferred' },
            { title: 'Organize os elementos principais da sala', basedOn: 'inferred' },
          ],
          question: null,
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );

    assert.equal(result.mode, 'actions');
    assert.equal(result.steps.length, 2);
  });

  it('entrega os passos quando o revisor reprova mas a guarda aprovou', async () => {
    // Regressão de produção: o revisor é adversarial por instrução e, com
    // modelo pequeno, reprovava sistematicamente uma decomposição correta. O
    // pipeline caía na pergunta com o caminho pronto na mão.
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: SALA },
      clientReturning(
        {
          steps: [
            { title: 'Retire da sala o que não pertence ali', basedOn: 'inferred' },
            { title: 'Organize os elementos principais da sala', basedOn: 'inferred' },
          ],
        },
        { approved: false, failures: ['poderia ser mais específico'], missingInfo: null },
      ),
    );

    assert.equal(result.mode, 'actions');
    assert.equal(result.steps.length, 2);
    assert.equal(result.question, null);
  });

  it('só pergunta depois que a decomposição falhou nas duas tentativas', async () => {
    // Regressão de produção: enquanto passos e pergunta dividiam o mesmo
    // contrato, o modelo escolhia perguntar mesmo com contexto suficiente. A
    // pergunta agora é uma chamada separada, que só acontece no fim.
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: SALA },
      clientReturning(
        { steps: [{ title: 'Pegue fita crepe e prenda o rodapé', basedOn: 'inferred' }] },
        { steps: [{ title: 'Compre uma caixa organizadora', basedOn: 'inferred' }] },
        { question: 'O que ainda falta para você considerar essa sala pronta?' },
      ),
    );

    assert.equal(result.mode, 'question');
    assert.equal(result.steps.length, 0);
    assert.match(result.question ?? '', /o que ainda falta/i);
  });

  it('não gasta a chamada de pergunta quando os passos se sustentam', async () => {
    let calls = 0;
    const client = {
      chat: {
        completions: {
          create: async () => {
            calls += 1;
            const payload = calls === 1
              ? {
                steps: [
                  { title: 'Retire da sala o que não pertence ali', basedOn: 'inferred' },
                  { title: 'Organize os elementos principais da sala', basedOn: 'inferred' },
                ],
              }
              : { approved: true, failures: [], missingInfo: null };
            return { choices: [{ message: { content: JSON.stringify(payload) } }] };
          },
        },
      },
    } as any;

    const result = await GoalIntelligenceService.decompose({ goalTitle: SALA }, client);

    assert.equal(result.mode, 'actions');
    // Geração + validação. Nenhuma terceira chamada para formular pergunta.
    assert.equal(calls, 2);
  });

  it('não derruba a resposta por causa de rationale ou assumption longos', async () => {
    // Regressão de produção: o modelo devolveu uma decomposição correta com
    // rationale de ~170 chars e o schema reprovou o payload inteiro, virando
    // "sem informação suficiente" na tela com a informação toda disponível.
    const longo = 'x'.repeat(400);
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: SALA },
      clientReturning(
        {
          resultDefinition: longo,
          assumptions: [longo, longo],
          steps: [
            { title: 'Retire da sala o que não pertence ali', basedOn: 'inferred', rationale: longo },
            { title: 'Organize os elementos principais da sala', basedOn: 'inferred', rationale: longo },
          ],
          question: null,
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );

    assert.equal(result.mode, 'actions');
    assert.equal(result.steps.length, 2);
    assert.ok(result.resultDefinition!.length <= 240);
    assert.ok(result.assumptions.every((item) => item.length <= 240));
  });

  it('aceita basedOn desconhecido tratando como inferido', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: SALA },
      clientReturning(
        {
          steps: [
            { title: 'Retire da sala o que não pertence ali', basedOn: 'chute' },
            { title: 'Organize os elementos principais da sala' },
          ],
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );

    assert.equal(result.mode, 'actions');
    assert.ok(result.steps.every((step) => step.basedOn === 'inferred'));
  });

  it('não devolve nada sem chave e sem cliente — não inventa lista genérica', async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await GoalIntelligenceService.decompose({ goalTitle: SALA });
      assert.equal(result.steps.length, 0);
      assert.equal(result.question, null);
    } finally {
      if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    }
  });
});
