import assert from 'node:assert/strict';

import {
  DECOMPOSITION_RULES,
  TaskDecompositionService,
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

  console.log('task-decomposition.service tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
