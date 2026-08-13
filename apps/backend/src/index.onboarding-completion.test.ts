import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

const AUTHENTICATED_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const FORGED_USER_ID = '00000000-0000-0000-0000-000000000999';
const TRIAL_END = '2026-08-17T12:00:00.000Z';

async function run() {
  const profileUpserts: any[] = [];
  const grantedUserIds: string[] = [];
  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    profile: {
      upsert: async (args: any) => {
        profileUpserts.push(args);
        return { id: args.where.id, onboardingDone: true };
      },
    },
  };
  const billingSummary = {
    access: 'pro' as const,
    source: 'trial' as const,
      subscriptionStatus: null,
      provider: null,
    plan: null,
    periodEnd: null,
    trialEndsAt: TRIAL_END,
    daysRemaining: 7,
    checkoutAvailable: true,
  };

  const app = createApp({
    prisma: prisma as any,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = AUTHENTICATED_USER_ID;
      next();
    },
    billingAccessService: {
      grantInitialTrial: async (userId: string) => {
        grantedUserIds.push(userId);
        return billingSummary;
      },
      getSummary: async () => billingSummary,
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to open test server');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: FORGED_USER_ID, subscriptionStatus: 'active' }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.saved, true);
      assert.deepEqual(body.billing, billingSummary);
    }

    assert.deepEqual(grantedUserIds, [AUTHENTICATED_USER_ID, AUTHENTICATED_USER_ID]);
    assert.equal(profileUpserts.length, 2);
    for (const upsert of profileUpserts) {
      assert.equal(upsert.where.id, AUTHENTICATED_USER_ID, 'body userId must be ignored');
      assert.deepEqual(upsert.update, { onboardingDone: true });
      assert.deepEqual(upsert.create, { id: AUTHENTICATED_USER_ID, onboardingDone: true });
      assert.equal('subscriptionStatus' in upsert.update, false);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

run()
  .then(() => console.log('index.onboarding-completion tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
