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

  it('coloca o que a pessoa disse como fonte atual de maior autoridade', () => {
    const prompt = buildGoalDecompositionPrompt({
      goalTitle: SALA,
      userStatements: ['Falta organizar os móveis'],
    });

    assert.match(prompt, /fonte atual de maior autoridade/);
    assert.match(prompt, /Falta organizar os móveis/);
  });

  it('permite uma única pergunta somente quando ela muda materialmente o caminho', () => {
    const prompt = buildGoalDecompositionPrompt({ goalTitle: SALA });

    assert.match(prompt, /UMA PERGUNTA DECISIVA/);
    assert.match(prompt, /decisiveQuestion/);
    assert.match(prompt, /caminhos materialmente diferentes/i);
  });

  it('lembra que ela já contou, quando contou', () => {
    const prompt = buildGoalDecompositionPrompt({
      goalTitle: SALA,
      userStatements: ['Só falta organizar os móveis e colocar minhas coisas de trabalho'],
    });

    assert.match(prompt, /JÁ CONTOU/);
  });

  it('pede um caminho estruturado com realidade, etapas e evidência de avanço', () => {
    const prompt = buildGoalDecompositionPrompt({
      goalTitle: 'Conquistar a primeira cliente de maquiagem para noivas',
      userStatements: ['Já tenho portfólio e uso o Instagram; não tenho verba para anúncios'],
    });

    assert.match(prompt, /currentReality/);
    assert.match(prompt, /milestones/);
    assert.match(prompt, /currentMilestoneId/);
    assert.match(prompt, /doneWhen/);
    assert.match(prompt, /etapas futuras/i);
    assert.match(prompt, /não tenho verba para anúncios/i);
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

  it('objetivo amplo sem contexto suficiente gera pergunta decisiva, não checklist genérico', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: 'Organizar minhas finanças' },
      clientReturning({
        resultDefinition: '', currentReality: '', milestones: [],
        decisiveQuestion: 'Hoje o principal problema é dívida, gasto mensal ou falta de controle do dinheiro?',
      }),
    );

    assert.equal(result.mode, 'question');
    assert.match(result.question ?? '', /dívida, gasto mensal ou falta de controle/i);
    assert.equal(result.steps.length, 0);
  });

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

  it('preserva a estrutura causal do caminho e detalha apenas a etapa atual', async () => {
    const result = await GoalIntelligenceService.decompose(
      {
        goalTitle: 'Conquistar a primeira cliente de maquiagem para noivas',
        userStatements: ['Já tenho portfólio e uso o Instagram; não tenho verba para anúncios'],
      },
      clientReturning(
        {
          resultDefinition: 'Uma noiva contratou e confirmou o serviço',
          currentReality: 'Ela já tem portfólio e um canal orgânico no Instagram',
          assumptions: [],
          currentMilestoneId: 'm-1',
          milestones: [
            {
              id: 'm-1',
              title: 'Transformar o portfólio em uma apresentação clara',
              order: 0,
              doneWhen: 'O perfil mostra trabalhos de noiva e uma forma de contato',
              actions: [
                {
                  title: 'Selecionar no portfólio três maquiagens de noiva para destacar',
                  basedOn: 'stated',
                  rationale: 'Usa o portfólio que ela disse já ter',
                  doneWhen: 'As três imagens estiverem separadas',
                  effortSize: 'medium',
                  evidenceRefs: ['statement:0'],
                },
              ],
            },
            {
              id: 'm-2',
              title: 'Abrir conversas com noivas pelo canal existente',
              order: 1,
              doneWhen: 'Existirem conversas reais sobre disponibilidade',
              actions: [],
            },
          ],
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );

    assert.equal(result.mode, 'actions');
    assert.equal(result.currentReality, 'Ela já tem portfólio e um canal orgânico no Instagram');
    assert.equal(result.currentMilestoneId, 'm-1');
    assert.equal(result.milestones.length, 2);
    assert.equal(result.milestones[1].actions.length, 0);
    assert.equal(result.steps[0].milestoneId, 'm-1');
    assert.equal(result.steps[0].doneWhen, 'As três imagens estiverem separadas');
    assert.deepEqual(result.steps[0].evidenceRefs, ['statement:0']);
  });

  it('não deixa a guarda determinística aprovar um caminho reprovado semanticamente', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: SALA },
      clientReturning(
        {
          steps: [
            { title: 'Retire da sala o que não pertence ali', basedOn: 'inferred' },
            { title: 'Organize os elementos principais da sala', basedOn: 'inferred' },
          ],
        },
        { approved: false, failures: ['o segundo passo não demonstra avanço causal'], missingInfo: null },
        {
          steps: [
            { title: 'Retire da sala o que não pertence ali', basedOn: 'inferred' },
            { title: 'Organize os elementos principais da sala', basedOn: 'inferred' },
          ],
        },
        { approved: false, failures: ['a sequência continua sem vínculo causal suficiente'], missingInfo: null },
        { question: 'Para qual uso a sala precisa ficar pronta?' },
      ),
    );

    assert.equal(result.mode, 'question');
    assert.equal(result.steps.length, 0);
    assert.match(result.question ?? '', /qual uso/i);
  });

  it('usa o modelo alternativo depois de uma reprovação', async () => {
    const models: string[] = [];
    let calls = 0;
    const client = {
      chat: { completions: { create: async (request: any) => {
        models.push(request.model);
        calls += 1;
        const payload = calls === 1
          ? { steps: [{ title: 'Retire da sala o que não pertence ali', basedOn: 'inferred' }] }
          : calls === 2
            ? { approved: false, failures: ['sem vínculo causal'], missingInfo: null }
            : calls === 3
              ? { steps: [{ title: 'Deixe a sala pronta para uso', basedOn: 'inferred' }] }
              : calls === 4
                ? { approved: true, failures: [], missingInfo: null }
                : { question: null };
        return { choices: [{ message: { content: JSON.stringify(payload) } }] };
      } } },
    } as any;

    const result = await GoalIntelligenceService.decompose({ goalTitle: SALA }, client);

    assert.equal(result.mode, 'actions');
    assert.equal(models[2], 'gpt-4.1-mini');
  });

  it('corrige caminho de dívida sem introduzir investimento ou contas não mencionadas', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: 'Organizar minhas finanças', userStatements: ['Tenho uma dívida que preciso quitar'] },
      clientReturning(
        { steps: [{ title: 'Abrir uma conta de investimentos', basedOn: 'inferred' }] },
        { approved: false, failures: ['inventou investimento'], missingInfo: null },
        {
          resultDefinition: 'Dívida quitada ou com acordo executável', currentReality: 'Existe uma dívida informada', currentMilestoneId: 'debt-1',
          milestones: [{ id: 'debt-1', title: 'Dimensionar a dívida', order: 0, doneWhen: 'Valor e condições conhecidos', actions: [
            { title: 'Registrar o valor e as condições conhecidas da dívida', basedOn: 'stated', doneWhen: 'Dados conhecidos registrados' },
          ] }],
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );
    assert.equal(result.mode, 'actions');
    assert.doesNotMatch(result.steps.map((step) => step.title).join(' '), /invest|conta nova/i);
    assert.match(result.steps[0].title, /dívida/i);
  });

  it('usa portfólio e Instagram sem inventar site, anúncios pagos ou ferramenta', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: 'Conquistar clientes de noiva', userStatements: ['Tenho portfólio e uso Instagram; não tenho verba para anúncios'] },
      clientReturning(
        { steps: [{ title: 'Criar um site e campanha de anúncios pagos', basedOn: 'inferred' }] },
        { approved: false, failures: ['inventou site e anúncios'], missingInfo: null },
        {
          resultDefinition: 'Primeira conversa real com potencial cliente', currentReality: 'Já há portfólio e Instagram', currentMilestoneId: 'organic-1',
          milestones: [{ id: 'organic-1', title: 'Apresentar o trabalho no canal existente', order: 0, doneWhen: 'Trabalho publicado', actions: [
            { title: 'Selecionar no portfólio um trabalho de noiva para publicar no Instagram', basedOn: 'stated', doneWhen: 'Trabalho selecionado' },
          ] }],
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );
    assert.equal(result.mode, 'actions');
    assert.doesNotMatch(result.steps[0].title, /site|anúncio|ferramenta/i);
    assert.match(result.steps[0].title, /portfólio|Instagram/i);
  });

  it('contexto de mudança não preserva caixas, carro ou transportadora inventados', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: 'Concluir minha mudança de casa', userStatements: ['Já defini a nova casa e preciso concluir a mudança'] },
      clientReturning(
        { steps: [{ title: 'Compre caixas e reserve uma transportadora com carro', basedOn: 'inferred' }] },
        {
          resultDefinition: 'Itens essenciais transferidos para a nova casa', currentReality: 'A nova casa já foi definida', currentMilestoneId: 'move-1',
          milestones: [{ id: 'move-1', title: 'Definir o primeiro conjunto real', order: 0, doneWhen: 'Primeiro conjunto identificado', actions: [
            { title: 'Identificar o primeiro conjunto de itens que precisa sair da casa atual', basedOn: 'inferred', doneWhen: 'Conjunto identificado' },
          ] }],
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );
    assert.equal(result.mode, 'actions');
    assert.doesNotMatch(result.steps[0].title, /caixa|carro|transportadora|defeito/i);
  });

  it('baixa energia reduz a ação atual sem reduzir o resultado nem as etapas', async () => {
    const result = await GoalIntelligenceService.decompose(
      { goalTitle: 'Publicar meu portfólio', energyScore: 2, capacity: 'quick', userStatements: ['Já selecionei os trabalhos'] },
      clientReturning(
        {
          resultDefinition: 'Portfólio publicado e acessível', currentReality: 'Trabalhos já selecionados', currentMilestoneId: 'publish-1',
          milestones: [
            { id: 'publish-1', title: 'Montar apresentação', order: 0, doneWhen: 'Estrutura iniciada', actions: [{ title: 'Escrever o título da apresentação', basedOn: 'stated', effortSize: 'small', doneWhen: 'Título escrito' }] },
            { id: 'publish-2', title: 'Publicar o portfólio', order: 1, doneWhen: 'Link acessível', actions: [] },
          ],
        },
        { approved: true, failures: [], missingInfo: null },
      ),
    );
    assert.equal(result.resultDefinition, 'Portfólio publicado e acessível');
    assert.equal(result.milestones.length, 2);
    assert.equal(result.steps[0].effortSize, 'small');
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
