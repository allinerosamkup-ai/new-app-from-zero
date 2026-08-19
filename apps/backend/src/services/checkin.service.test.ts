import assert from 'node:assert/strict';

import { getOpenAiModel } from '../lib/openai-config';
import { CheckinService } from './checkin.service';

async function run() {
  let capturedMessages: Array<{ role: string; content: string }> = [];
  let capturedModel = '';

  const fakeClient = {
    chat: {
      completions: {
        create: async ({ model, messages }: any) => {
          capturedModel = model;
          capturedMessages = messages;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    stateLabel: 'Dia sensível',
                    stateLabelType: 'sensível',
                    analysis: 'Seu corpo está pedindo menos carga e mais ritmo estável.',
                    recommendations: ['Beber água e alongar por 5 minutos.'],
                    suggestedIntensity: 'L',
                    rationale: 'Humor e energia vieram baixos ao mesmo tempo.',
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const result = await CheckinService.evaluateDayState(
    {
      checkinSlot: 'morning',
      moodScore: 2,
      energyScore: 2,
      clarityScore: 2,
      irritabilityScore: 3,
      physicalScore: 2,
      socialScore: 3,
      sleepScore: 2,
      note: 'Acordei mais arrastada hoje.',
      userName: 'Ana',
      profileSummary: 'Fica melhor quando reduz a carga no começo do dia.',
      moodCycleContext: 'Humor em queda leve, energia baixa.',
      recentSuggestionMemory: 'MEMORIA RECENTE DE SUGESTOES DA AURA:\n- [home/somatico] Respirar por 1 minuto antes de responder',
    },
    fakeClient as any,
  );

  assert.equal(result.stateLabel, 'Dia sensível');
  assert.equal(capturedMessages[0]?.role, 'system');
  assert.match(capturedMessages[0]?.content || '', /CHECK-IN/i);
  assert.match(capturedMessages[0]?.content || '', /LEITURA TOTAL/i);
  assert.match(capturedMessages[0]?.content || '', /ritmo atual/i);
  assert.equal(capturedModel, getOpenAiModel());
  assert.equal(capturedMessages[1]?.role, 'user');
  assert.match(capturedMessages[1]?.content || '', /Você lê o check-in/i);
  assert.match(capturedMessages[1]?.content || '', /SINAL PRIORITÁRIO/i);
  assert.match(capturedMessages[1]?.content || '', /Acordei mais arrastada hoje\./i);
  assert.match(capturedMessages[1]?.content || '', /diferencie capacidade baixa de piora emocional/i);
  assert.match(capturedMessages[1]?.content || '', /Respirar por 1 minuto antes de responder/i);
  assert.match(capturedMessages[0]?.content || '', /POLITICA DE SUGESTAO CONCRETA/i);
  assert.match(capturedMessages[1]?.content || '', /Pronto quando: <evidência observável>/i);

  const completedFakeClient = {
    chat: {
      completions: {
        create: async ({ messages }: any) => {
          capturedMessages = messages;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    stateLabel: 'Dia sensível',
                    stateLabelType: 'sensível',
                    analysis: 'A energia caiu, mas o treino já conta como movimento feito.',
                    recommendations: [
                      'Preparar o kit do treino às 09:00.',
                      'Responder uma pendência real da agenda às 17:00.',
                    ],
                    suggestedIntensity: 'L',
                    rationale: 'Evitar repetição de hábito concluído.',
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const completedResult = await CheckinService.evaluateDayState(
    {
      checkinSlot: 'evening-2006',
      moodScore: 3,
      energyScore: 2,
      clarityScore: 4,
      irritabilityScore: 2,
      physicalScore: 3,
      socialScore: 3,
      sleepScore: 4,
      userName: 'Ana',
      completionContext: 'Hábitos feitos hoje: "Treino"',
      avoidRecommendationTitles: ['Treino'],
    },
    completedFakeClient as any,
  );

  assert.deepEqual(completedResult.recommendations, []);
  assert.match(capturedMessages[1]?.content || '', /JÁ FEITO \/ NÃO SUGERIR DE NOVO/i);
  assert.match(capturedMessages[1]?.content || '', /Hábitos feitos hoje: "Treino"/i);
  assert.match(capturedMessages[1]?.content || '', /Não repita ação já concluída/i);

  const fallback = await CheckinService.evaluateDayState(
    { checkinSlot: 'morning', moodScore: 5, energyScore: 3 },
    { chat: { completions: { create: async () => ({ choices: [] }) } } } as any,
  );
  assert.equal(fallback.stateLabel, 'ritmo mais baixo');
  assert.equal(fallback.suggestedIntensity, 'L');
  assert.deepEqual(fallback.recommendations, []);
}

run()
  .then(() => {
    console.log('checkin.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
