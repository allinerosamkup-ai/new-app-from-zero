import assert from 'node:assert/strict';

import request from 'supertest';

import { createApp } from './index';
import type { AiriaReadingEnvelope } from './services/airia-reading.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const envelope: AiriaReadingEnvelope = {
  version: 'v1' as const,
  generatedAt: '2026-08-13T21:00:00.000Z',
  capacity: {
    level: 'media', size: 'moderate', stepMinutes: 25,
    reason: 'Mantive um tamanho intermediário: sua energia está em 6 de 10.',
    basis: ['sua energia está em 6 de 10'], confidence: 'media', assumed: false, corrected: false,
  },
  currentState: {
    phase: 'Retomada', moodScore: 7, energyScore: 6,
    intraday: { observations: 3, direction: 'oscillating', range: 5, oscillation: 'variation_today' },
  },
  period: { from: '2026-08-01', to: '2026-08-13', observedDays: 8, windowDays: 13, coverage: 4, confidence: 0.62 },
  alerts: [],
  riskSafety: { riskLevel: 'none', route: 'self_support', signals: [], message: '' },
  decision: { id: 'decision-1', status: 'proposed', title: 'Separar os itens da sala', reason: 'Ação vinculada ao objetivo.', requiresConfirmation: true },
};

async function run() {
  const rebuildCalls: any[] = [];
  const feedbackCalls: any[] = [];
  const app = createApp({
    prisma: {
      userPreference: { findUnique: async () => ({ timezone: 'America/Sao_Paulo' }) },
    } as any,
    authMiddleware: (req, _res, next) => { (req as any).userId = USER_ID; next(); },
    airiaReadingService: {
      rebuild: async (input: any) => { rebuildCalls.push(input); return envelope; },
      get: async () => envelope,
      feedback: async (input: any) => { feedbackCalls.push(input); return envelope; },
    },
  });

  const reading = await request(app)
    .get('/api/airia/reading?from=2026-08-01&to=2026-08-13')
    .expect(200);
  assert.equal(reading.body.version, 'v1');
  assert.equal(reading.body.currentState.intraday.direction, 'oscillating');
  assert.equal(rebuildCalls.length, 1);
  assert.equal(rebuildCalls[0].periodFrom, '2026-08-01');
  assert.equal(rebuildCalls[0].periodTo, '2026-08-13');
  assert.equal(rebuildCalls[0].surface, 'read');

  await request(app)
    .post('/api/airia/decisions/decision-1/feedback')
    .send({ status: 'corrected', correction: 'Hoje preciso de um passo menor.', surface: 'aura' })
    .expect(200);
  assert.deepEqual(feedbackCalls[0], {
    userId: USER_ID,
    decisionId: 'decision-1',
    status: 'corrigida',
    surface: 'aura',
    correction: 'Hoje preciso de um passo menor.',
    note: undefined,
    capacityCorrection: undefined,
  });

  // Correção do tamanho do dia: um toque, sem texto obrigatório, e o enum em
  // português da tela chega ao serviço já traduzido para a direção que
  // `lib/capacity.ts` entende.
  await request(app)
    .post('/api/airia/decisions/decision-1/feedback')
    .send({ status: 'corrected', capacityCorrection: 'menos', surface: 'checkin-result' })
    .expect(200);
  assert.equal(feedbackCalls[1].capacityCorrection, 'down');
  assert.equal(feedbackCalls[1].correction, undefined, 'corrigir tamanho não exige texto');

  await request(app)
    .post('/api/airia/decisions/decision-1/feedback')
    .send({ status: 'corrected', capacityCorrection: 'mais', surface: 'home' })
    .expect(200);
  assert.equal(feedbackCalls[2].capacityCorrection, 'up');

  // Valor fora do contrato é recusado; a tela nunca inventa direção.
  await request(app)
    .post('/api/airia/decisions/decision-1/feedback')
    .send({ status: 'corrected', capacityCorrection: 'muito mais', surface: 'home' })
    .expect(400);
  assert.equal(feedbackCalls.length, 3, 'payload inválido não chega ao serviço');

  console.log('airia-reading routes tests passed');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
