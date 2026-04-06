import assert from 'node:assert/strict';

import { AIService } from './ai.service';

async function run() {
  let capturedMessages: Array<{ role: string; content: string }> = [];
  const fakeClient = {
    chat: {
      completions: {
        create: async ({ messages }: any) => {
          capturedMessages = messages;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    profileSummary: 'Pessoa em fase de reorganização da rotina com sensação atual de sobrecarga e busca de mais previsibilidade.',
                    routineSummaryNormalized: 'Acorda às 07:00, dorme às 23:00 e sente mais peso no fim da tarde em dias de trabalho intenso.',
                    initialStateSummary: 'Chega ao app se sentindo cansada, com sono instável recente e necessidade de um dia mais gentil.',
                    topThemes: ['sono', 'rotina', 'trabalho'],
                    initialSuggestions: [
                      'Comece os próximos dias com blocos leves antes das tarefas mais exigentes.',
                      'Observe se noites curtas antecedem as quedas de energia da tarde.',
                      'Deixe espaço de respiro entre tarefas importantes.',
                    ],
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const result = await AIService.generateOnboardingProfile(
    {
      fullName: 'Ana',
      age: 33,
      currentFeeling: 'Estou cansada e um pouco sobrecarregada.',
      sleepQualityNote: 'Tenho dormido mal nos últimos dias.',
      wakeTime: '07:00',
      sleepTime: '23:00',
      routineText: 'Trabalho o dia todo e no fim da tarde fico esgotada.',
      mainEnergyPressure: 'Excesso de demandas e pouco descanso.',
      primaryGoal: 'Quero organizar melhor minha energia ao longo da semana.',
      supportGoals: ['stability', 'routine'],
    },
    fakeClient as any,
  );

  assert.match(result.profileSummary, /reorganização da rotina/i);
  assert.equal(result.topThemes[0], 'sono');
  assert.equal(result.initialSuggestions.length, 3);
  assert.equal(capturedMessages[0]?.role, 'system');
  assert.match(capturedMessages[0]?.content || '', /Você é Aura/i);
  assert.match(capturedMessages[0]?.content || '', /BOAS-VINDAS/i);
  assert.equal(capturedMessages[1]?.role, 'user');
  assert.match(capturedMessages[1]?.content || '', /DADOS DO USUÁRIO/i);
}

run()
  .then(() => {
    console.log('onboarding-ai.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
