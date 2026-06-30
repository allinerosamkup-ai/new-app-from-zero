import assert from 'node:assert/strict';

import {
  OnboardingProcessSchema,
  PRIOR_DIAGNOSIS_VALUES,
  hasActiveDiagnosis,
  hasAdhdContext,
  hasBipolarContext,
} from './onboarding.contract';

const baseInput = {
  fullName: 'Alline',
  age: 33,
  currentFeeling: 'cansada porem disposta',
  sleepQualityNote: 'dormi 6h interrompido',
  wakeTime: '07:00',
  sleepTime: '23:30',
  routineText: 'manha foco trabalho, tarde reunioes, noite leitura',
  mainEnergyPressure: 'reunioes longas drenando energia',
  primaryGoal: 'manter ritmo nas semanas baixas',
  supportGoals: ['planejamento', 'foco'],
};

// Aceita sem diagnostico
{
  const result = OnboardingProcessSchema.safeParse(baseInput);
  assert.equal(result.success, true);
}

// Aceita com diagnoses validos
{
  const result = OnboardingProcessSchema.safeParse({
    ...baseInput,
    priorDiagnoses: ['adhd', 'bipolar_ii'],
    medicationCurrentlyUsing: true,
  });
  assert.equal(result.success, true);
}

// Rejeita diagnostico fora da whitelist
{
  const result = OnboardingProcessSchema.safeParse({
    ...baseInput,
    priorDiagnoses: ['anxiety_disorder'],
  });
  assert.equal(result.success, false);
}

// Limite max 5
{
  const result = OnboardingProcessSchema.safeParse({
    ...baseInput,
    priorDiagnoses: [
      'bipolar_ii',
      'cyclothymia',
      'adhd',
      'cyclical_depression',
      'prefer_not_to_say',
      'bipolar_ii',
    ],
  });
  assert.equal(result.success, false);
}

// Helpers
{
  assert.equal(hasActiveDiagnosis(['adhd']), true);
  assert.equal(hasActiveDiagnosis(['prefer_not_to_say']), false);
  assert.equal(hasActiveDiagnosis([]), false);
  assert.equal(hasActiveDiagnosis(null), false);

  assert.equal(hasAdhdContext(['adhd', 'bipolar_ii']), true);
  assert.equal(hasAdhdContext(['bipolar_ii']), false);

  assert.equal(hasBipolarContext(['bipolar_ii']), true);
  assert.equal(hasBipolarContext(['cyclothymia']), true);
  assert.equal(hasBipolarContext(['adhd']), false);
}

// Garante que a constante exporta o conjunto esperado
{
  assert.deepEqual([...PRIOR_DIAGNOSIS_VALUES].sort(), [
    'adhd',
    'bipolar_ii',
    'cyclical_depression',
    'cyclothymia',
    'prefer_not_to_say',
  ]);
}

console.log('onboarding.contract tests passed');
