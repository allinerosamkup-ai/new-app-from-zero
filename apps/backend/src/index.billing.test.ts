import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';
import type { BillingOffer } from './services/billing-provider';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

async function run() {
  const checkoutCalls: any[] = [];
  const cancelCalls: string[] = [];
  const caktoWebhookCalls: any[] = [];
  const offers: BillingOffer[] = [
    { plan: 'monthly', amountCents: 2990, currency: 'BRL', billingPeriod: 'month', enabled: true },
    { plan: 'annual', amountCents: 24900, currency: 'BRL', billingPeriod: 'year', enabled: true },
    { plan: 'lifetime', amountCents: 9900, currency: 'BRL', billingPeriod: 'once', enabled: true },
  ];
  const billingProvider = {
    name: 'cakto' as const,
    isConfigured: () => true,
    createCheckoutSession: async (userId: string, email: string | undefined, plan: string, attemptKey: string) => {
      checkoutCalls.push({ userId, email, plan, attemptKey });
      if (attemptKey === 'attempt-conflict') throw new Error('checkout_attempt_conflict');
      return { url: `https://checkout/${plan}`, verificationId: `attempt-${plan}` };
    },
    verifyCheckoutSession: async (userId: string, sessionId: string) => ({
      confirmed: true, plan: 'lifetime' as const, status: 'paid', userId, sessionId,
    }),
    getOfferCatalog: () => offers,
    cancelSubscription: async (userId: string) => {
      cancelCalls.push(userId);
      return { canceled: true, periodEnd: '2026-09-13T00:00:00.000Z' };
    },
  };
  const summary = {
    access: 'pro' as const,
    source: 'trial' as const,
    subscriptionStatus: null,
    provider: null,
    plan: null,
    periodEnd: null,
    trialEndsAt: '2026-08-17T00:00:00.000Z',
    daysRemaining: 7,
    checkoutAvailable: true,
  };
  const app = createApp({
    prisma: {
      $queryRaw: async () => [], $executeRaw: async () => ({}),
      billingAccount: { findUnique: async () => ({ billingProvider: 'cakto' }) },
    } as any,
    billingProvider,
    caktoService: {
      handleWebhook: async (payload: any) => {
        caktoWebhookCalls.push(payload);
        if (payload.secret !== 'valid') throw new Error('invalid_webhook_secret');
        if (payload.transient) throw new Error('cakto_api_failed:503');
        return { duplicate: false, result: 'subscription_activated' };
      },
      cancelSubscription: async (userId: string) => {
        cancelCalls.push(userId);
        return { canceled: true, periodEnd: '2026-09-13T00:00:00.000Z' };
      },
    },
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
      assert.deepEqual(await response.json(), {
        url: `https://checkout/${plan}`, verificationId: `attempt-${plan}`,
      });
    }
    assert.deepEqual(checkoutCalls.map((call) => call.userId), [USER_ID, USER_ID, USER_ID]);
    assert.deepEqual(checkoutCalls.map((call) => call.plan), ['monthly', 'annual', 'lifetime']);

    const bodyIdempotency = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'annual', attemptKey: 'attempt-from-client' }),
    });
    assert.equal(bodyIdempotency.status, 200);
    assert.equal(checkoutCalls.at(-1)?.attemptKey, 'attempt-from-client');
    const conflict = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'idempotency-key': 'attempt-conflict' },
      body: JSON.stringify({ plan: 'annual' }),
    });
    assert.equal(conflict.status, 409);

    const status = await (await fetch(`${baseUrl}/api/billing/status`)).json();
    assert.deepEqual(status, { ...summary, offers });

    const verification = await fetch(`${baseUrl}/api/billing/checkout-session/attempt-lifetime`);
    assert.equal(verification.status, 200);
    const verificationBody = await verification.json();
    assert.equal(verificationBody.confirmed, true);
    assert.equal(verificationBody.status, 'paid');

    const missingConfirmation = await fetch(`${baseUrl}/api/billing/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(missingConfirmation.status, 400);
    assert.equal(cancelCalls.length, 0);
    const canceled = await fetch(`${baseUrl}/api/billing/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }),
    });
    assert.equal(canceled.status, 200);
    assert.deepEqual(cancelCalls, [USER_ID]);

    const caktoInvalid = await fetch(`${baseUrl}/api/billing/webhook/cakto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'wrong' }),
    });
    assert.equal(caktoInvalid.status, 401);
    const caktoValid = await fetch(`${baseUrl}/api/billing/webhook/cakto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: 'valid' }),
    });
    assert.equal(caktoValid.status, 200);
    const caktoTransient = await fetch(`${baseUrl}/api/billing/webhook/cakto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'valid', transient: true }),
    });
    assert.equal(caktoTransient.status, 503, 'transient Cakto failures must remain retryable');
    assert.equal(caktoWebhookCalls.length, 3, 'Cakto webhook is public and bypasses app auth');

    const legacyWebhook = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(legacyWebhook.status, 404);
    const legacyStripeWebhook = await fetch(`${baseUrl}/api/billing/webhook/stripe`, {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(legacyStripeWebhook.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

run()
  .then(() => console.log('index.billing tests passed'))
  .catch((error) => { console.error(error); process.exit(1); });
