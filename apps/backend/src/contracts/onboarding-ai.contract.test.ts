import assert from 'node:assert/strict';

import { OnboardingAiOutputSchema } from './onboarding-ai.contract';

{
  const result = OnboardingAiOutputSchema.safeParse({
    profileSummary: 'Pessoa em fase de reorganização da rotina com sensação atual de sobrecarga.',
    routineSummaryNormalized: 'Acorda às 07:00, trabalha em horário comercial e sente queda no fim da tarde.',
    initialStateSummary: 'Chega ao app se sentindo cansada e um pouco pressionada.',
    topThemes: ['sono', 'rotina', 'trabalho'],
    initialSuggestions: [
      'Comece com blocos leves no início do dia.',
      'Observe como o sono está impactando sua energia.',
      'Evite sobrecarregar o fim da tarde por enquanto.',
    ],
  });

  assert.equal(result.success, true);
}

{
  const result = OnboardingAiOutputSchema.safeParse({
    profileSummary: 'curto',
    routineSummaryNormalized: 'rotina',
    initialStateSummary: 'estado',
    topThemes: [],
    initialSuggestions: [],
  });

  assert.equal(result.success, false);
}

console.log('onboarding-ai.contract tests passed');
