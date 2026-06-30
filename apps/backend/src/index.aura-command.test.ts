import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function readResponseText(response: Response): Promise<string> {
  return await response.text();
}

async function run() {
  const createdSessions: any[] = [];
  const savedMessages: any[] = [];

  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    profile: {
      findUnique: async () => ({ fullName: 'Teste Aura' }),
    },
    memoryEmbedding: {
      findFirst: async () => null,
    },
    memoryItem: {
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
    },
    onboardingResponse: {
      findUnique: async () => ({ aiProfileSummary: 'Perfil resumido.' }),
    },
    dailyCheckin: {
      findFirst: async () => ({
        localDate: new Date('2026-04-06T00:00:00.000Z'),
        moodScore: 2,
        energyScore: 2,
        sleepScore: 3,
        stateLabel: 'Dia sensível',
        stateLabelType: 'sensível',
        stateSummary: 'Emoções à flor da pele.',
      }),
    },
    timelineBlock: {
      findMany: async () => [],
    },
    journalSession: {
      create: async ({ data }: any) => {
        const session = { id: `session-${createdSessions.length + 1}`, ...data };
        createdSessions.push(session);
        return session;
      },
      update: async ({ where, data }: any) => ({
        id: where.id,
        ...data,
      }),
    },
    journalMessage: {
      create: async ({ data }: any) => {
        savedMessages.push(data);
        return { id: `message-${savedMessages.length}`, ...data };
      },
    },
  };

  const app = createApp({
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
    prisma: prisma as any,
    auraCommandService: {
      interpretCommand: async () => ({
        assistantMessage: 'Isso parece diário. Vou guardar um resumo por aqui.',
        intent: 'reflective_handoff',
        action: 'handoff_to_journal',
        payload: {},
        needsConfirmation: false,
        needsClarification: false,
        clarifyingQuestion: null,
      }),
    } as any,
    aiService: {
      summarizeJournalSession: async () => ({
        summary: 'Resumo salvo pela Aura.',
        emotions: ['ansiosa', 'aliviada'],
        themes: ['relacionamento'],
        suggestions: ['Respirar antes de responder.'],
      }),
      streamJournalReply: async () => 'ok',
    } as any,
    generateJournalSuggestedTasks: async () => [],
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11',
        message: 'Estou mexida com o que aconteceu hoje e queria processar isso.',
        history: [
          { role: 'assistant', content: 'Pode me contar o que aconteceu.' },
          { role: 'user', content: 'Foi uma conversa difícil.' },
        ],
      }),
    });

    assert.equal(response.status, 200);
    const streamBody = await readResponseText(response);

    assert.equal(createdSessions.length, 1);
    assert.ok(savedMessages.length >= 2);
    assert.match(streamBody, /assistant\.completed/);
    assert.match(streamBody, /Resumo salvo pela Aura/);
    assert.match(streamBody, /journalSummary/i);

    const longCommandResponse = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d12',
        message: 'Organize esse texto grande no planner. '.repeat(650),
        history: [
          { role: 'assistant', content: 'Pode colar tudo aqui.' },
        ],
      }),
    });

    assert.equal(longCommandResponse.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

run()
  .then(() => {
    console.log('index.aura-command tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
