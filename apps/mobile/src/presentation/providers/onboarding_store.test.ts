import assert from 'node:assert/strict';

import api from '../../services/api_service';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from './auth_store';
import { ONBOARDING_QUESTIONS, useOnboardingStore } from './onboarding_store';

async function run() {
  let refreshCalls = 0;

  (useAuthStore.getState() as any).refresh = async () => {
    refreshCalls += 1;
  };

  (api.post as any) = async (url: string) => {
    assert.equal(url, '/api/onboarding/process');
    return {
      data: {
        profileSummary: 'Você está começando o app com vontade de reorganizar a rotina com mais gentileza.',
        routineSummaryNormalized: 'Acorda às 07:00, dorme às 23:00 e sente mais peso no fim da tarde.',
        initialStateSummary: 'Chega cansada e buscando mais estabilidade para os próximos dias.',
        topThemes: ['sono', 'rotina', 'trabalho'],
        initialSuggestions: [
          'Comece com blocos leves nas primeiras horas.',
          'Observe o impacto do sono nas tardes mais pesadas.',
          'Deixe pausas curtas entre demandas importantes.',
        ],
      },
    };
  };

  (supabase as any).from = (table: string) => ({
    upsert: async () => ({ data: null, error: null, table }),
    update: () => ({
      eq: async () => ({ data: null, error: null, table }),
    }),
  });

  useOnboardingStore.getState().reset();

  assert.equal(ONBOARDING_QUESTIONS.length, 8);
  assert.equal(useOnboardingStore.getState().currentQuestionIndex, 0);

  useOnboardingStore.getState().submitAnswer('Ana');
  useOnboardingStore.getState().submitAnswer('33');
  useOnboardingStore.getState().submitAnswer('Estou cansada e sobrecarregada.');
  useOnboardingStore.getState().submitAnswer('Tenho dormido mal nos últimos dias.');
  useOnboardingStore.getState().submitAnswer({ wakeTime: '07:00', sleepTime: '23:00' });
  useOnboardingStore.getState().submitAnswer('Trabalho o dia todo e no fim da tarde fico esgotada.');
  useOnboardingStore.getState().submitAnswer('Excesso de demandas e pouco descanso.');
  useOnboardingStore.getState().submitAnswer('Quero organizar melhor minha energia.');

  useOnboardingStore.getState().toggleSupportGoal('routine');
  useOnboardingStore.getState().setConsent('healthData', true);
  useOnboardingStore.getState().setConsent('aiProcessing', true);

  await useOnboardingStore.getState().completeOnboarding('550e8400-e29b-41d4-a716-446655440000');

  assert.equal(useOnboardingStore.getState().stage, 'summary');
  assert.match(useOnboardingStore.getState().aiProfile?.profileSummary ?? '', /reorganizar a rotina/i);
  assert.equal(refreshCalls, 0);

  await useOnboardingStore.getState().finalizeOnboarding();

  assert.equal(refreshCalls, 1);
}

run()
  .then(() => {
    console.log('onboarding_store tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
