import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

async function run() {
  const checkoutCalls: any[] = [];
  const offers = [
    { plan: 'monthly', amountCents: 2990, currency: 'BRL', billingPeriod: 'month', enabled: true },
    { plan: 'annual', amountCents: 24900, currency: 'BRL', billingPeriod: 'year', enabled: true },
    { plan: 'lifetime', amountCents: 9900, currency: 'BRL', billingPeriod: 'once', enabled: true },
  ];
  const stripeService = {
    createCheckoutSession: async (userId: string, email: string | undefined, plan: string, attemptKey: string) => {
      checkoutCalls.push({ userId, email, plan, attemptKey });
      return `https://checkout/${plan}`;
    },
    createPortalSession: async () => 'https://portal/session',
    verifyCheckoutSession: async (userId: string, sessionId: string) => ({
      confirmed: true,
      plan: 'lifetime',
      userId,
      sessionId,
    }),
    getOfferCatalog: () => offers,
    handleWebhook: async () => ({ duplicate: false }),
  };
  const summary = {
    access: 'pro' as const,
    source: 'trial' as const,
    subscriptionStatus: null,
    plan: null,
    periodEnd: null,
    trialEndsAt: '2026-08-17T00:00:00.000Z',
    daysRemaining: 7,
    checkoutAvailable: true,
  };
  const app = createApp({
    prisma: { $queryRaw: async () => [], $executeRaw: async () => ({}) } as any,
    stripeService: stripeService as any,
    billingAccessService: {
      grantInitialTrial: async () => summary,
      getSummary: async () => summary,
    },
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = USER_ID;
      next();
    },
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to open test server');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const invalid = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'weekly' }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(checkoutCalls.length, 0);

    for (const plan of ['monthly', 'annual', 'lifetime']) {
      const response = await fetch(`${baseUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'idempotency-key': `attempt-${plan}` },
        body: JSON.stringify({ userId: 'forged', email: 'person@example.com', plan }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).url, `https://checkout/${plan}`);
    }
    assert.deepEqual(checkoutCalls.map((call) => call.userId), [USER_ID, USER_ID, USER_ID]);
    assert.deepEqual(checkoutCalls.map((call) => call.plan), ['monthly', 'annual', 'lifetime']);

    const status = await (await fetch(`${baseUrl}/api/billing/status`)).json();
    assert.deepEqual(status, { ...summary, offers });

    const verification = await fetch(`${baseUrl}/api/billing/checkout-session/cs_test`);
    assert.equal(verification.status, 200);
    const verificationBody = await verification.json();
    assert.equal(verificationBody.confirmed, true);
    assert.equal(verificationBody.userId, USER_ID);

    const noSignature = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(noSignature.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

run()
  .then(() => console.log('index.billing tests passed'))
  .catch((error) => { console.error(error); process.exit(1); });
