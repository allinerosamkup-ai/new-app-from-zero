import assert from 'node:assert/strict';

import { AIService } from './ai.service';

async function run() {
  const deltas: string[] = [];
  let capturedMessages: Array<{ role: string; content: string }> = [];

  const fakeClient = {
    chat: {
      completions: {
        create: async ({ messages }: any) => {
          capturedMessages = messages;
          return {
            async *[Symbol.asyncIterator]() {
              yield {
                choices: [{ delta: { content: 'Olá, ' } }],
              };
              yield {
                choices: [{ delta: { content: 'vamos organizar isso juntas.' } }],
              };
            },
          };
        },
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
        userName: 'Ana',
        userProfileSummary: 'Prefere blocos mais leves quando acorda cansada.',
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
  assert.equal(capturedMessages[0]?.role, 'system');
  assert.match(capturedMessages[0]?.content || '', /Você é Aura/i);
  assert.match(capturedMessages[0]?.content || '', /DIARIO AO VIVO/i);
  assert.match(capturedMessages[0]?.content || '', /Não presuma diagnósticos/i);
  assert.equal(capturedMessages[1]?.role, 'user');
  assert.match(capturedMessages[1]?.content || '', /CONTEXTO DA PESSOA/i);
}

run()
  .then(() => {
    console.log('ai.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
