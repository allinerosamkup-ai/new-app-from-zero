import assert from 'node:assert/strict';

import {
  DECOMPOSITION_RULES,
  TaskDecompositionService,
  decompositionShape,
  shouldDecompose,
} from './task-decomposition.service';

(async () => {
  // Tarefa vaga trava o início mesmo sendo curta.
  for (const title of [
    'Organizar a casa',
    'Limpar a cozinha',
    'Estudar matemática',
    'Trabalhar no relatório',
    'Resolver o problema do banco',
    'Clean the kitchen',
  ]) {
    assert.equal(shouldDecompose({ title }), true, title);
  }

  // Tarefa já acionável não vira três passos por capricho.
  for (const title of [
    'Ligar para a escola',
    'Tomar o remédio',
    'Buscar a Manu',
    'Pagar a conta de luz',
  ]) {
    assert.equal(shouldDecompose({ title }), false, title);
  }

  // Complemento específico já diz por onde começar, mesmo com verbo vago.
  assert.equal(
    shouldDecompose({ title: 'Revisar o slide 4 do deck da reunião de quinta' }),
    false,
    'verbo vago com alvo específico não precisa quebrar',
  );

  // Duração acima do limite quebra mesmo com título claro.
  assert.equal(shouldDecompose({ title: 'Ligar para a escola', durationMinutes: 45 }), true);
  assert.equal(shouldDecompose({ title: 'Ligar para a escola', durationMinutes: 20 }), false);

  // Profundidade máxima impede recursão infinita.
  assert.equal(
    shouldDecompose({ title: 'Organizar a casa', depth: DECOMPOSITION_RULES.maxDepth }),
    false,
  );

  assert.equal(shouldDecompose({ title: '   ' }), false);

  // Sem modelo disponível, não inventa passo genérico.
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.deepEqual(await TaskDecompositionService.decompose({ title: 'Organizar a casa' }), []);
  if (previousKey) process.env.OPENAI_API_KEY = previousKey;

  // Com modelo, normaliza duração dentro da faixa e corta o excesso de passos.
  const fakeClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                steps: [
                  { title: 'Jogar o lixo fora', durationMinutes: 2, starter: 'Pegue o saco' },
                  { title: 'Enxaguar a louça', durationMinutes: 90, starter: 'Abra a torneira' },
                  { title: 'Passar pano no balcão', durationMinutes: 10, starter: 'Molhe o pano' },
                  { title: 'Guardar as panelas', durationMinutes: 10, starter: 'Pegue a primeira' },
                  { title: 'Varrer o chão', durationMinutes: 10, starter: 'Pegue a vassoura' },
                  { title: 'Passo demais', durationMinutes: 10, starter: 'Não deveria aparecer' },
                ],
              }),
            },
          }],
        }),
      },
    },
  } as any;

  const steps = await TaskDecompositionService.decompose({ title: 'Limpar a cozinha' }, fakeClient);
  assert.equal(steps.length, DECOMPOSITION_RULES.maxSteps);
  assert.equal(steps[0].durationMinutes, DECOMPOSITION_RULES.stepMinMinutes, 'passo curto demais sobe para o piso');
  assert.equal(steps[1].durationMinutes, DECOMPOSITION_RULES.stepMaxMinutes, 'passo longo demais desce para o teto');
  assert.equal(steps[0].starter, 'Pegue o saco');

  // Tarefa que não precisa quebrar não chega a chamar o modelo.
  let called = false;
  const spyClient = {
    chat: { completions: { create: async () => { called = true; return { choices: [] }; } } },
  } as any;
  assert.deepEqual(await TaskDecompositionService.decompose({ title: 'Ligar para a escola' }, spyClient), []);
  assert.equal(called, false);

  // Resposta inválida do modelo não vira passo inventado.
  const brokenClient = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: 'não é json' } }] }) } },
  } as any;
  assert.deepEqual(await TaskDecompositionService.decompose({ title: 'Organizar a casa' }, brokenClient), []);

  // O prompt carrega o contexto do dia. Sem isso o modelo quebra tudo do mesmo
  // jeito, num dia bom e num dia de Recolhimento.
  const promptComContexto = TaskDecompositionService.buildPromptFor({
    title: 'Organizar a papelada do imposto',
    durationMinutes: 60,
    phase: 'Recolhimento',
    energyScore: 3,
    category: 'burocracia',
    note: 'preciso achar os informes antes',
  });
  assert.match(promptComContexto, /Fase de hoje: Recolhimento/);
  assert.match(promptComContexto, /Energia agora: 3\/10/);
  assert.match(promptComContexto, /Categoria: burocracia/);
  assert.match(promptComContexto, /preciso achar os informes/);

  // Regras que fazem o passo ser executável, não uma reescrita da tarefa.
  assert.match(promptComContexto, /Verbos proibidos/);
  assert.match(promptComContexto, /menos de 2 minutos/, 'o passo 1 tem que ser a porta de entrada');
  assert.match(promptComContexto, /palavras DELA/, 'o objeto tem que manter as palavras da usuária');
  assert.match(promptComContexto, /RUIM \(não faça assim\)/, 'exemplo contrastivo é o que mais segura o modelo');
  assert.match(promptComContexto, /Por que é ruim/);

  // Fase de baixa capacidade encolhe a quebra: 5 passos de 15 min num dia ruim é
  // o mesmo que não quebrar.
  const baixa = decompositionShape({ title: 'x', phase: 'Recolhimento' });
  const normal = decompositionShape({ title: 'x', phase: 'Fluindo', energyScore: 8 });
  assert.equal(baixa.maxSteps, 3);
  assert.equal(baixa.maxMinutes, 10);
  assert.equal(normal.maxSteps, DECOMPOSITION_RULES.maxSteps);
  assert.equal(normal.maxMinutes, DECOMPOSITION_RULES.stepMaxMinutes);
  assert.equal(decompositionShape({ title: 'x', energyScore: 3 }).maxSteps, 3, 'energia baixa também encolhe');

  assert.match(
    TaskDecompositionService.buildPromptFor({ title: 'x', phase: 'Recolhimento' }),
    /2 a 3 passos de 5 a 10 minutos/,
  );

  // O corte respeita a forma: em fase baixa, o excedente do modelo é descartado.
  const generoso = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({
      steps: Array.from({ length: 5 }, (_, i) => ({ title: `Passo ${i + 1}`, durationMinutes: 15, starter: 'x' })),
    }) } }] }) } },
  } as any;
  const emFaseBaixa = await TaskDecompositionService.decompose(
    { title: 'Organizar a casa', phase: 'Pausa' },
    generoso,
  );
  assert.equal(emFaseBaixa.length, 3);
  assert.ok(emFaseBaixa.every((step) => step.durationMinutes <= 10));

  console.log('task-decomposition.service tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
