import assert from 'node:assert/strict';

import { CaktoService } from './cakto.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function createFixture() {
  const attempts: any[] = [];
  const events = new Map<string, any>();
  const accounts = new Map<string, any>();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let tokenCalls = 0;
  let beforeCancelResponse: (() => void) | null = null;
  const order: any = {
    id: 'order-1',
    status: 'paid',
    type: 'subscription',
    offer_type: 'main',
    baseAmount: '29.90',
    amount: '30.89',
    product: { id: 'subscription-product', type: 'subscription' },
    subscription: 'sub-1',
    subscription_period: 1,
    sck: '',
    checkoutUrl: 'https://pay.cakto.test/monthly-offer',
  };
  const subscription: any = {
    id: 'sub-1',
    status: 'active',
    amount: '29.90',
    product: { id: 'subscription-product', type: 'subscription' },
    offer: { id: 'monthly-offer', price: 29.9 },
    current_period: 1,
    recurrence_period: 30,
    next_payment_date: '2026-09-13T12:00:00.000Z',
    canceledAt: null,
  };
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith('/public_api/token/')) {
      tokenCalls += 1;
      assert.equal(init?.headers && (init.headers as Record<string, string>)['Content-Type'], 'application/x-www-form-urlencoded');
      return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200 });
    }
    if (url.includes('/public_api/orders/')) {
      return new Response(JSON.stringify(order), { status: 200 });
    }
    if (url.includes('/public_api/subscriptions/') && url.endsWith('/cancel/')) {
      beforeCancelResponse?.();
      return new Response(JSON.stringify({ detail: 'canceled' }), { status: 200 });
    }
    if (url.includes('/public_api/subscriptions/')) {
      return new Response(JSON.stringify(subscription), { status: 200 });
    }
    throw new Error(`unexpected request ${url}`);
  };
  const prisma: any = {
    billingCheckoutAttempt: {
      findUnique: async ({ where }: any) => attempts.find((row) => (
        where.publicToken ? row.publicToken === where.publicToken
          : where.id ? row.id === where.id
            : row.userId === where.userId_provider_attemptKey.userId
              && row.provider === where.userId_provider_attemptKey.provider
              && row.attemptKey === where.userId_provider_attemptKey.attemptKey
      )) ?? null,
      upsert: async ({ where, create }: any) => {
        const existing = attempts.find((row) => row.userId === where.userId_provider_attemptKey.userId
          && row.provider === where.userId_provider_attemptKey.provider
          && row.attemptKey === where.userId_provider_attemptKey.attemptKey);
        if (existing) return existing;
        const row = { id: `attempt-${attempts.length + 1}`, ...create };
        attempts.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = attempts.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    billingWebhookEvent: {
      findUnique: async ({ where }: any) => events.get(`${where.provider_eventId.provider}:${where.provider_eventId.eventId}`) ?? null,
      create: async ({ data }: any) => { events.set(`${data.provider}:${data.eventId}`, data); return data; },
    },
    billingAccount: {
      findUnique: async ({ where }: any) => accounts.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const row = { ...(accounts.get(where.userId) ?? create), ...(accounts.has(where.userId) ? update : {}) };
        accounts.set(where.userId, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = { ...(accounts.get(where.userId) ?? { userId: where.userId }), ...data };
        accounts.set(where.userId, row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const row = accounts.get(where.userId);
        if (!row || row.billingProvider !== where.billingProvider
          || row.externalSubscriptionId !== where.externalSubscriptionId) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
  prisma.$transaction = async (work: (tx: any) => Promise<any>) => work(prisma);
  const service = new CaktoService({
    prisma,
    fetchImpl: fetchImpl as typeof fetch,
    now: () => NOW,
    config: {
      baseUrl: 'https://api.cakto.test', checkoutBaseUrl: 'https://pay.cakto.test',
      clientId: 'client', clientSecret: 'secret', webhookSecret: 'webhook-secret',
      offers: {
        monthly: { offerId: 'monthly-offer', productId: 'subscription-product', amountCents: 2990 },
        annual: { offerId: 'annual-offer', productId: 'subscription-product', amountCents: 24900 },
        lifetime: { offerId: 'lifetime-offer', productId: 'lifetime-product', amountCents: 9900 },
      },
    },
  });
  return {
    service, attempts, events, accounts, requests, order, subscription,
    setBeforeCancelResponse(callback: (() => void) | null) { beforeCancelResponse = callback; },
    get tokenCalls() { return tokenCalls; },
  };
}

function paidPayload(sck: string) {
  return {
    event: 'purchase_approved',
    secret: 'webhook-secret',
    data: {
      id: 'order-1', sck, status: 'paid', amount: 29.9, paidAt: NOW.toISOString(),
      offer: { id: 'monthly-offer', name: 'Mensal', price: 29.9 },
      product: { id: 'subscription-product', type: 'subscription' },
      subscription: { id: 'sub-1' },
    },
  };
}

async function prepareMonthly(fixture: ReturnType<typeof createFixture>, key = 'attempt-key') {
  const checkout = await fixture.service.createCheckoutSession(USER_ID, 'person@example.com', 'monthly', key);
  fixture.order.sck = fixture.attempts[0].publicToken;
  return checkout;
}

async function run() {
  const f = createFixture();
  assert.deepEqual(f.service.getOfferCatalog().map((offer) => [offer.plan, offer.amountCents, offer.enabled]), [
    ['monthly', 2990, true], ['annual', 24900, true], ['lifetime', 9900, true],
  ]);

  for (const plan of ['monthly', 'annual', 'lifetime'] as const) {
    const three = createFixture();
    const created = await three.service.createCheckoutSession(USER_ID, undefined, plan, `attempt-${plan}`);
    assert.equal(new URL(created.url).pathname, `/${plan}-offer`);
    assert.equal(new URL(created.url).searchParams.get('sck'), three.attempts[0].publicToken);
  }

  const checkout = await prepareMonthly(f);
  assert.match(checkout.verificationId, /^attempt-/);
  const checkoutUrl = new URL(checkout.url);
  assert.equal(checkoutUrl.pathname, '/monthly-offer');
  assert.equal(checkoutUrl.searchParams.get('sck'), f.attempts[0].publicToken);
  assert.equal(checkoutUrl.searchParams.get('email'), 'person@example.com');
  const repeated = await f.service.createCheckoutSession(USER_ID, 'person@example.com', 'monthly', 'attempt-key');
  assert.deepEqual(repeated, checkout, 'one attempt key must reuse one checkout attempt');
  await assert.rejects(
    () => f.service.createCheckoutSession(USER_ID, 'person@example.com', 'annual', 'attempt-key'),
    /checkout_attempt_conflict/,
    'one idempotency key must never open a different plan',
  );

  const payload = paidPayload(f.order.sck);
  f.subscription.amount = '24.90';
  const invalid = createFixture();
  await assert.rejects(() => invalid.service.handleWebhook({ ...payload, secret: 'wrong' }), /invalid_webhook_secret/);
  assert.equal(invalid.requests.length, 0, 'invalid secret must not call the API');
  assert.equal(invalid.events.size, 0, 'invalid secret must not write');

  const paid = await f.service.handleWebhook(payload);
  assert.equal(paid.duplicate, false);
  assert.equal(f.accounts.get(USER_ID).billingProvider, 'cakto');
  assert.equal(f.accounts.get(USER_ID).subscriptionStatus, 'active');
  assert.equal(f.accounts.get(USER_ID).externalSubscriptionId, 'sub-1');
  assert.equal(f.accounts.get(USER_ID).currentPeriodEnd.toISOString(), '2026-09-13T12:00:00.000Z');
  assert.equal(f.attempts[0].status, 'paid');
  assert.equal(f.tokenCalls, 1);
  const duplicate = await f.service.handleWebhook(payload);
  assert.equal(duplicate.duplicate, true);
  assert.equal(f.tokenCalls, 1, 'duplicate webhook must not fetch the order again');

  f.subscription.next_payment_date = '2026-10-13T12:00:00.000Z';
  const renewed = await f.service.handleWebhook({ ...payload, event: 'subscription_renewed' });
  assert.equal(renewed.result, 'subscription_activated');
  assert.equal(f.accounts.get(USER_ID).currentPeriodEnd.toISOString(), '2026-10-13T12:00:00.000Z');
  assert.equal(f.tokenCalls, 1, 'OAuth token must be cached before expires_in');

  const verified = await f.service.verifyCheckoutSession(USER_ID, checkout.verificationId);
  assert.deepEqual(verified, { confirmed: true, plan: 'monthly', status: 'paid' });
  await assert.rejects(() => f.service.verifyCheckoutSession('other-user', checkout.verificationId), /checkout_session_forbidden/);

  for (const mismatch of ['status', 'baseAmount', 'checkoutUrl', 'product', 'subscriptionOffer', 'subscriptionStatus'] as const) {
    const x = createFixture();
    await prepareMonthly(x, `attempt-${mismatch}`);
    if (mismatch === 'status') x.order.status = 'waiting_payment';
    if (mismatch === 'baseAmount') x.order.baseAmount = '9.99';
    if (mismatch === 'checkoutUrl') x.order.checkoutUrl = 'https://pay.cakto.test/wrong-offer';
    if (mismatch === 'product') x.order.product = { id: 'wrong-product', type: 'subscription' };
    if (mismatch === 'subscriptionOffer') x.subscription.offer = { id: 'wrong-offer', price: 29.9 };
    if (mismatch === 'subscriptionStatus') x.subscription.status = 'canceled';
    await assert.rejects(
      () => x.service.handleWebhook(paidPayload(x.order.sck)),
      /(?:order_(?:not_paid|mismatch)|subscription_not_active)/,
    );
    assert.equal(x.accounts.size, 0);
  }

  f.order.status = 'refused';
  const refused = await f.service.handleWebhook({
    ...payload,
    event: 'subscription_renewal_refused',
    data: { ...payload.data, status: 'refused' },
  });
  assert.equal(refused.result, 'subscription_past_due');
  assert.equal(f.accounts.get(USER_ID).subscriptionStatus, 'past_due');

  f.order.status = 'canceled';
  f.subscription.status = 'canceled';
  f.subscription.next_payment_date = '2026-10-13T12:00:00.000Z';
  const canceledEvent = await f.service.handleWebhook({
    ...payload,
    event: 'subscription_canceled',
    data: { ...payload.data, status: 'canceled' },
  });
  assert.equal(canceledEvent.result, 'subscription_canceled');
  assert.equal(f.accounts.get(USER_ID).subscriptionStatus, 'canceled');
  assert.equal(f.accounts.get(USER_ID).currentPeriodEnd.toISOString(), '2026-10-13T12:00:00.000Z');

  const stale = createFixture();
  await prepareMonthly(stale, 'attempt-stale');
  stale.order.status = 'canceled';
  stale.subscription.status = 'canceled';
  stale.accounts.set(USER_ID, {
    userId: USER_ID, billingProvider: 'cakto', subscriptionStatus: 'active',
    subscriptionPlan: 'monthly', externalSubscriptionId: 'sub-new',
    currentPeriodEnd: new Date('2026-11-13T12:00:00.000Z'),
  });
  const staleResult = await stale.service.handleWebhook({
    ...paidPayload(stale.order.sck), event: 'subscription_canceled',
  });
  assert.equal(staleResult.result, 'stale_subscription_ignored');
  assert.equal(stale.accounts.get(USER_ID).subscriptionStatus, 'active');

  const stalePositive = createFixture();
  await prepareMonthly(stalePositive, 'attempt-old-positive');
  stalePositive.attempts[0].createdAt = new Date('2026-08-12T12:00:00.000Z');
  stalePositive.accounts.set(USER_ID, {
    userId: USER_ID, billingProvider: 'cakto', subscriptionStatus: 'active',
    subscriptionPlan: 'annual', externalSubscriptionId: 'sub-new', externalOrderId: 'order-new',
    currentPeriodEnd: new Date('2027-08-13T12:00:00.000Z'),
    updatedAt: new Date('2026-08-13T11:00:00.000Z'),
  });
  const stalePositiveResult = await stalePositive.service.handleWebhook(
    paidPayload(stalePositive.order.sck),
  );
  assert.equal(stalePositiveResult.result, 'stale_purchase_ignored');
  assert.equal(stalePositive.accounts.get(USER_ID).subscriptionPlan, 'annual');
  assert.equal(stalePositive.accounts.get(USER_ID).externalSubscriptionId, 'sub-new');

  const stalePositiveAgainstLifetime = createFixture();
  await prepareMonthly(stalePositiveAgainstLifetime, 'attempt-before-lifetime');
  stalePositiveAgainstLifetime.attempts[0].createdAt = new Date('2026-08-12T12:00:00.000Z');
  stalePositiveAgainstLifetime.accounts.set(USER_ID, {
    userId: USER_ID, billingProvider: 'cakto', subscriptionStatus: 'active',
    subscriptionPlan: 'lifetime', externalSubscriptionId: null, externalOrderId: 'lifetime-new',
    currentPeriodEnd: null, updatedAt: new Date('2026-08-13T11:00:00.000Z'),
  });
  await stalePositiveAgainstLifetime.service.handleWebhook(
    paidPayload(stalePositiveAgainstLifetime.order.sck),
  );
  assert.equal(stalePositiveAgainstLifetime.accounts.get(USER_ID).subscriptionPlan, 'lifetime');

  const newerPlan = createFixture();
  await prepareMonthly(newerPlan, 'attempt-new-plan');
  newerPlan.attempts[0].createdAt = new Date('2026-08-13T12:00:00.000Z');
  newerPlan.accounts.set(USER_ID, {
    userId: USER_ID, billingProvider: 'cakto', subscriptionStatus: 'active',
    subscriptionPlan: 'annual', externalSubscriptionId: 'sub-old', externalOrderId: 'order-old',
    currentPeriodEnd: new Date('2027-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-12T12:00:00.000Z'),
  });
  const newerPlanResult = await newerPlan.service.handleWebhook(paidPayload(newerPlan.order.sck));
  assert.equal(newerPlanResult.result, 'subscription_activated');
  assert.equal(newerPlan.accounts.get(USER_ID).subscriptionPlan, 'monthly');
  assert.equal(newerPlan.accounts.get(USER_ID).externalSubscriptionId, 'sub-1');

  for (const event of ['refund', 'chargeback'] as const) {
    const x = createFixture();
    await x.service.createCheckoutSession(USER_ID, undefined, 'lifetime', `attempt-${event}`);
    x.order.sck = x.attempts[0].publicToken;
    x.order.type = 'unique';
    x.order.subscription = null;
    x.order.baseAmount = '99.00';
    x.order.amount = '99.99';
    x.order.product = { id: 'lifetime-product', type: 'unique' };
    x.order.checkoutUrl = 'https://pay.cakto.test/lifetime-offer';
    x.order.status = event === 'refund' ? 'refunded' : 'chargedback';
    x.accounts.set(USER_ID, {
      userId: USER_ID, billingProvider: 'cakto', subscriptionStatus: 'active',
      subscriptionPlan: 'lifetime', externalOrderId: 'order-1', currentPeriodEnd: null,
    });
    await x.service.handleWebhook({
      event, secret: 'webhook-secret', data: {
        ...paidPayload(x.order.sck).data,
        status: x.order.status,
        amount: 99,
        offer: { id: 'lifetime-offer', price: 99 },
        product: x.order.product,
        subscription: null,
      },
    });
    assert.equal(x.accounts.get(USER_ID).subscriptionStatus, event === 'refund' ? 'refunded' : 'chargedback');
  }

  const cancel = createFixture();
  cancel.accounts.set(USER_ID, {
    userId: USER_ID, billingProvider: 'cakto', subscriptionPlan: 'monthly',
    externalSubscriptionId: 'sub-1', currentPeriodEnd: new Date('2026-09-13T12:00:00.000Z'),
  });
  const canceled = await cancel.service.cancelSubscription(USER_ID);
  assert.equal(canceled.canceled, true);
  assert.equal(cancel.accounts.get(USER_ID).subscriptionStatus, 'canceled');
  assert.equal(cancel.accounts.get(USER_ID).cancelAtPeriodEnd, true);
  assert.equal(
    cancel.requests.filter((request) => request.url.includes('/subscriptions/sub-1/')).length,
    2,
    'cancellation must re-read the current subscription before canceling it',
  );
  cancel.accounts.get(USER_ID).subscriptionPlan = 'lifetime';
  await assert.rejects(() => cancel.service.cancelSubscription(USER_ID), /lifetime_cannot_cancel/);

  const racingCancel = createFixture();
  racingCancel.accounts.set(USER_ID, {
    userId: USER_ID, billingProvider: 'cakto', subscriptionPlan: 'monthly',
    externalSubscriptionId: 'sub-1', currentPeriodEnd: new Date('2026-09-13T12:00:00.000Z'),
  });
  racingCancel.setBeforeCancelResponse(() => {
    racingCancel.accounts.set(USER_ID, {
      userId: USER_ID, billingProvider: 'cakto', subscriptionPlan: 'annual',
      externalSubscriptionId: 'sub-new', currentPeriodEnd: new Date('2027-08-13T12:00:00.000Z'),
      subscriptionStatus: 'active',
    });
  });
  await assert.rejects(() => racingCancel.service.cancelSubscription(USER_ID), /subscription_changed_after_cancel/);
  assert.equal(racingCancel.accounts.get(USER_ID).externalSubscriptionId, 'sub-new');
  assert.equal(racingCancel.accounts.get(USER_ID).subscriptionStatus, 'active');
}

run().then(() => console.log('cakto.service tests passed'));
