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
  assert.match(capturedMessages[0]?.content || '', /COORDENADA BIO-PSÍQUICA/i);
  assert.match(capturedMessages[0]?.content || '', /ritmo hoje/i);
  assert.equal(capturedModel, getOpenAiModel());
  assert.equal(capturedMessages[1]?.role, 'user');
  assert.match(capturedMessages[1]?.content || '', /Analise os dados de check-in/i);
  assert.match(capturedMessages[1]?.content || '', /SINAL PRIORITÁRIO/i);
  assert.match(capturedMessages[1]?.content || '', /Acordei mais arrastada hoje\./i);
  assert.match(capturedMessages[1]?.content || '', /não trate energia baixa como piora emocional/i);
  assert.match(capturedMessages[1]?.content || '', /Respirar por 1 minuto antes de responder/i);
  assert.match(capturedMessages[0]?.content || '', /Somática é ferramenta auxiliar/i);
  assert.match(capturedMessages[1]?.content || '', /fato vs interpretação/i);
}

run()
  .then(() => {
    console.log('checkin.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
