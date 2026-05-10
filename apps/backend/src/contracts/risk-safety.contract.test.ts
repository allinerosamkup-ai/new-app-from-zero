import assert from 'node:assert/strict';

import { AuraCommandResponseSchema } from './aura-command.contract';
import { CheckinResponseSchema } from './checkin.contract';
import { JournalAssistantCompletedSchema } from './journal.contract';
import { RiskSafetySchema } from './risk-safety.contract';

const validRiskSafety = {
  riskLevel: 'moderate',
  signals: ['sono muito baixo'],
  route: 'adapt_day',
  message: 'A Airia deve reduzir carga e adaptar agenda sem diagnosticar.',
};

{
  const result = RiskSafetySchema.safeParse(validRiskSafety);

  assert.equal(result.success, true);
}

{
  const result = RiskSafetySchema.safeParse({
    ...validRiskSafety,
    message: undefined,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinResponseSchema.safeParse({
    id: '550e8400-e29b-41d4-a716-446655440000',
    stateLabel: 'energia baixa',
    riskSafety: validRiskSafety,
  });

  assert.equal(result.success, true);
}

{
  const result = JournalAssistantCompletedSchema.safeParse({
    type: 'assistant.completed',
    message: 'Vamos reduzir a carga das próximas horas.',
    riskSafety: validRiskSafety,
  });

  assert.equal(result.success, true);
}

{
  const result = AuraCommandResponseSchema.safeParse({
    assistantMessage: 'Vou ajustar o dia com base na energia de agora.',
    intent: 'agenda_plan',
    action: 'create_agenda',
    payload: {},
    riskSafety: validRiskSafety,
  });

  assert.equal(result.success, true);
}

console.log('risk-safety.contract tests passed');
