import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function run() {
  const previousFetch = globalThis.fetch;
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const upserts: any[] = [];

  process.env.GOOGLE_CLIENT_ID = 'google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
  process.env.FRONTEND_URL = 'https://app.airia.pro';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes('oauth2.googleapis.com/token')) {
      return previousFetch(input, init);
    }

    return new Response(JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const prisma = {
    userPreference: {
      upsert: async (input: any) => {
        upserts.push(input);
        return input.create;
      },
      findUnique: async () => null,
    },
  };

  const app = createApp({
    prisma: prisma as any,
    authMiddleware: (_req: any, res: any) => {
      res.status(401).json({ error: 'auth required' });
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/gcal/callback?code=ok&state=550e8400-e29b-41d4-a716-446655440000`,
      { redirect: 'manual' },
    );

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /\/planner\?gcal=connected$/);
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0].where.userId, '550e8400-e29b-41d4-a716-446655440000');
  } finally {
    globalThis.fetch = previousFetch;
    process.env.GOOGLE_CLIENT_ID = previousClientId;
    process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    process.env.FRONTEND_URL = previousFrontendUrl;
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
    console.log('index.gcal tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
