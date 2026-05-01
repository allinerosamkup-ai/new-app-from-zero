import assert from 'node:assert/strict';

import {
  JournalMessageStreamSchema,
  JournalStartSchema,
} from './journal.contract';

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const validSessionId = '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11';

{
  const result = JournalStartSchema.safeParse({
    userId: validUserId,
  });

  assert.equal(result.success, true);
}

{
  const result = JournalStartSchema.safeParse({});

  assert.equal(result.success, false);
}

{
  const result = JournalMessageStreamSchema.safeParse({
    userId: validUserId,
    sessionId: validSessionId,
    message: 'Hoje eu acordei meio travada para começar o dia.',
    localDate: '2026-05-01',
    currentHour: 10,
    currentMinute: 42,
    phase: 'Turbulência',
    warningFlags: ['rapid_drop'],
    forecast7dSummary: 'Amanhã pede carga menor.',
    taskMomentum7d: 2,
  });

  assert.equal(result.success, true);
  assert.equal((result as any).data?.localDate, '2026-05-01');
  assert.equal((result as any).data?.currentHour, 10);
}

{
  const result = JournalMessageStreamSchema.safeParse({
    userId: validUserId,
    sessionId: validSessionId,
    message: 'texto longo do diário '.repeat(650),
  });

  assert.equal(result.success, true);
}

{
  const result = JournalMessageStreamSchema.safeParse({
    userId: validUserId,
    sessionId: validSessionId,
    message: '',
  });

  assert.equal(result.success, false);
}

{
  const result = JournalMessageStreamSchema.safeParse({
    userId: validUserId,
    message: 'faltando sessionId',
  });

  assert.equal(result.success, false);
}

console.log('journal.contract tests passed');
