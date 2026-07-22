import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { createRoutineBuilderRouter } from './routine-builder.routes';

async function run(): Promise<void> {
  const calls: string[] = [];
  const service = {
    createSession: async (userId: string, body: unknown) => { calls.push(`create:${userId}`); return { id: 'session-1', ...(body as object), status: 'draft' }; },
    getSession: async (userId: string, id: string) => { calls.push(`get:${userId}:${id}`); return { id, userId, status: 'ready' }; },
    ingestSource: async (input: any) => { calls.push(`source:${input.userId}`); return { id: input.sessionId, status: 'classified', items: [] }; },
    updateItems: async (input: any) => { calls.push(`items:${input.userId}`); return { id: input.sessionId, status: 'ready' }; },
    answerClarifications: async (input: any) => { calls.push(`answers:${input.userId}`); return { id: input.sessionId, status: 'ready' }; },
    compose: async (userId: string, sessionId: string) => { calls.push(`compose:${userId}`); return { id: sessionId, status: 'ready', draftPlan: { entries: [] } }; },
    apply: async (userId: string, sessionId: string) => { calls.push(`apply:${userId}`); return { sessionId, counts: { objectives: 0, habits: 0, timelineBlocks: 0 }, ids: { objectives: [], habits: [], timelineBlocks: [] } }; },
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).userId = 'user-1'; next(); });
  app.use('/api/routine-builder', createRoutineBuilderRouter({ service: service as any }));

  const create = await request(app).post('/api/routine-builder/sessions').send({
    focus: 'Organizar a mudança sem abandonar o trabalho',
    weekStart: '2026-07-27',
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(create.status, 201);

  assert.equal((await request(app).get('/api/routine-builder/sessions/session-1')).status, 200);
  assert.equal((await request(app).post('/api/routine-builder/sessions/session-1/source').send({ sourceType: 'text', text: 'Quero caminhar terça.' })).status, 200);
  assert.equal((await request(app).patch('/api/routine-builder/sessions/session-1/items').send({ items: [{ id: 'task-1', kind: 'task', title: 'Separar documentos', sourceExcerpt: 'Separar documentos', confidence: 0.9, reviewState: 'confirmed' }] })).status, 200);
  assert.equal((await request(app).post('/api/routine-builder/sessions/session-1/clarifications').send({ answers: [{ questionId: 'question:task-1:title', answer: 'Separar documentos pessoais' }] })).status, 200);
  assert.equal((await request(app).post('/api/routine-builder/sessions/session-1/compose').send({})).status, 200);
  assert.equal((await request(app).post('/api/routine-builder/sessions/session-1/apply').send({})).status, 200);
  assert.deepEqual(calls, [
    'create:user-1', 'get:user-1:session-1', 'source:user-1', 'items:user-1',
    'answers:user-1', 'compose:user-1', 'apply:user-1',
  ]);

  const invalid = await request(app).post('/api/routine-builder/sessions').send({ focus: 'x' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'validation_failed');
  assert.ok(Array.isArray(invalid.body.details));

  service.getSession = async () => { throw new Error('routine_session_not_found'); };
  const missing = await request(app).get('/api/routine-builder/sessions/other-user-session');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'routine_session_not_found');
}

void run().then(() => console.log('routine-builder.routes tests passed'));
