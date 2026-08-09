import assert from 'node:assert/strict';

import { CheckinCreateSchema, CheckinResponseSchema } from './checkin.contract';

const validCheckin = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  localDate: '2026-03-13',
  moodScore: 4,
  energyScore: 5,
  clarityScore: 5,
  irritabilityScore: 2,
  physicalScore: 5,
  socialScore: 5,
  note: 'Acordei melhor hoje.',
};

{
  const result = CheckinCreateSchema.safeParse(validCheckin);

  assert.equal(result.success, true);
}

{
  const result = CheckinCreateSchema.safeParse({
    userId: validCheckin.userId,
    localDate: validCheckin.localDate,
    moodScore: 3,
    energyScore: 3,
    source: 'aura_text',
    sourceMessageId: 'message-1',
    idempotencyKey: 'session-1:message-1',
    signalMetadata: {
      mood: { provenance: 'inferred', confidence: 0.9, evidence: ['chateada'] },
      energy: { provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
    },
  });

  assert.equal(result.success, true, 'sinais opcionais não podem ser inventados para validar o check-in');
}

{
  const result = CheckinCreateSchema.safeParse({
    userId: validCheckin.userId,
    localDate: validCheckin.localDate,
    energyScore: 3,
  });

  assert.equal(result.success, false, 'humor e energia continuam sendo os dois sinais centrais');
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    checkinSlot: 'midday',
  });

  assert.equal(result.success, true);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    energyScore: 11,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    physicalScore: 11,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    socialScore: 11,
  });

  assert.equal(result.success, false);
}

{
  const result = CheckinResponseSchema.safeParse({
    id: validCheckin.userId,
    stateLabel: 'queda de energia',
    riskSafety: {
      riskLevel: 'low',
      signals: ['sono muito baixo'],
      route: 'adapt_day',
      message: 'A Airia pode oferecer autoapoio pratico e adaptacao leve do dia.',
    },
  });

  assert.equal(result.success, true);
}

// Diagnostic-aware optional fields
{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    medicationTakenToday: true,
    focusScore: 4,
    hyperfocusOccurred: false,
    mixedEpisodeNote: 'energia alta mas humor baixo',
    dayType: 'mixed',
  });
  assert.equal(result.success, true);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    focusScore: 11,
  });
  assert.equal(result.success, false);
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    dayType: 'whatever',
  });
  assert.equal(result.success, false);
}

// O que a tela pergunta sobre o dia e não tem escala: capacidade e objetivo
// prioritário. `signalMetadata` é `.strict()`, então sem chave própria o payload
// inteiro seria rejeitado — e o check-in falharia por causa de dois campos
// opcionais.
{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    signalMetadata: {
      mood: { provenance: 'reported', confidence: 1, evidence: ['screen:mood'] },
      dayPlan: { capacity: 'quick', priorityGoalId: 'goal-7' },
    },
  });

  assert.equal(result.success, true, 'capacidade e objetivo prioritário precisam ter onde ser gravados');
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    signalMetadata: { dayPlan: { capacity: 'enorme' } },
  });

  assert.equal(result.success, false, 'capacidade fora das três opções da tela não entra');
}

{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    signalMetadata: { dayPlan: { capacity: 'quick' }, inventada: true },
  });

  assert.equal(result.success, false, 'signalMetadata continua fechado a chave desconhecida');
}

// O diário sempre mandou `surface`, o esquema nunca aceitou, e o construtor de
// plano lançava dentro de um catch mudo — a proposta de check-in do diário e a
// de meta logo atrás morriam em silêncio.
{
  const result = CheckinCreateSchema.safeParse({
    ...validCheckin,
    signalMetadata: { surface: 'journal' },
  });

  assert.equal(result.success, true, 'a superfície de origem precisa caber em signalMetadata');
}

console.log('checkin.contract tests passed');
