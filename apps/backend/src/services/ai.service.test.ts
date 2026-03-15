import assert from 'node:assert/strict';

import { AIService } from './ai.service';

async function run() {
  const deltas: string[] = [];

  const fakeClient = {
    chat: {
      completions: {
        create: async () => ({
          async *[Symbol.asyncIterator]() {
            yield {
              choices: [{ delta: { content: 'Olá, ' } }],
            };
            yield {
              choices: [{ delta: { content: 'vamos organizar isso juntas.' } }],
            };
          },
        }),
      },
    },
  };

  const result = await AIService.streamJournalReply(
    {
      context: {
        routineSummary: 'Costuma trabalhar melhor no fim da manhã.',
        promptSummary: 'Rotina percebida: Costuma trabalhar melhor no fim da manhã.',
        topThemes: ['trabalho'],
        topPlannerCategories: ['trabalho'],
        checkinToday: {
          moodScore: 3,
          energyScore: 2,
          stateLabel: 'Dia sensível',
        },
      },
      history: [
        { role: 'user', content: 'Estou preocupada com minha energia.' },
      ],
      message: 'Hoje eu já comecei atrasada.',
      onDelta: (chunk) => {
        deltas.push(chunk);
      },
    },
    fakeClient as any,
  );

  assert.equal(result, 'Olá, vamos organizar isso juntas.');
  assert.deepEqual(deltas, ['Olá, ', 'vamos organizar isso juntas.']);
}

run()
  .then(() => {
    console.log('ai.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
