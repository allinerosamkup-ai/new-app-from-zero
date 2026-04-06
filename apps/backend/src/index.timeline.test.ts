import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function run() {
  const createdBlocks: any[] = [];
  const updatedBlocks: any[] = [];

  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    timelineBlock: {
      create: async ({ data }: any) => {
        const created = {
          id: '11111111-1111-1111-1111-111111111111',
          ...data,
        };
        createdBlocks.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const updated = {
          id: where.id,
          ...data,
        };
        updatedBlocks.push(updated);
        return updated;
      },
    },
  };

  const app = createApp({
    prisma: prisma as any,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            title: 'Consulta médica',
            startTime: '14:30',
            endTime: '15:00',
            category: 'pessoal',
            intensity: 'P',
            status: 'planned',
          },
        ],
      }),
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createdBlocks.length, 1);
    assert.equal(createdBlocks[0].title, 'Consulta médica');
    assert.equal(createdBlocks[0].intensity, 'P');
    assert.equal(createdBlocks[0].status, 'planned');

    const updateResponse = await fetch(`${baseUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-06',
        forceSave: true,
        blocks: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            title: 'Consulta médica',
            startTime: '14:30',
            endTime: '15:00',
            category: 'pessoal',
            intensity: 'P',
            status: 'completed',
          },
        ],
      }),
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updatedBlocks.length, 1);
    assert.equal(updatedBlocks[0].id, '22222222-2222-4222-8222-222222222222');
    assert.equal(updatedBlocks[0].status, 'completed');
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
    console.log('index.timeline tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
