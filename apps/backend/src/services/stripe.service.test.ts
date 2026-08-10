import assert from 'node:assert/strict';

import { StripeService } from './stripe.service';

function fixture(options: { lifetimeEnabled?: boolean } = {}) {
  const billing = new Map<string, any>();
  const webhookEvents = new Set<string>();
  const customerCalls: any[] = [];
  const checkoutCalls: any[] = [];
  const billingWrites: any[] = [];
  let webhookEvent: any = null;

  const prisma: any = {
    billingAccount: {
      findUnique: async ({ where }: any) => {
        if (where.userId) return billing.get(where.userId) ?? null;
        return [...billing.values()].find((row) => (
          (where.stripeCustomerId && row.stripeCustomerId === where.stripeCustomerId)
          || (where.stripeSubscriptionId && row.stripeSubscriptionId === where.stripeSubscriptionId)
        )) ?? null;
      },
      upsert: async ({ where, create, update }: any) => {
        const current = billing.get(where.userId);
        const row = current ? { ...current, ...update } : { ...create };
        billing.set(where.userId, row);
        billingWrites.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = await prisma.billingAccount.findUnique({ where });
        if (!row) throw new Error('billing_not_found');
        const next = { ...row, ...data };
        billing.set(row.userId, next);
        billingWrites.push(next);
        return next;
      },
    },
    stripeWebhookEvent: {
      findUnique: async ({ where }: any) => webhookEvents.has(where.stripeEventId)
        ? { stripeEventId: where.stripeEventId }
        : null,
      create: async ({ data }: any) => {
        webhookEvents.add(data.stripeEventId);
        return data;
      },
    },
  };
  prisma.$transaction = async (work: (tx: any) => Promise<unknown>) => work(prisma);

  const stripe: any = {
    customers: {
      create: async (payload: any) => {
        customerCalls.push(payload);
        return { id: `cus_${customerCalls.length}` };
      },
    },
    checkout: {
      sessions: {
        create: async (payload: any, options: any) => {
          checkoutCalls.push({ payload, options });
          return { id: `cs_${checkoutCalls.length}`, url: `https://checkout/${checkoutCalls.length}` };
        },
        retrieve: async () => ({
          id: 'cs_lifetime',
          client_reference_id: 'user-lifetime',
          metadata: { userId: 'user-lifetime', plan: 'lifetime' },
          customer: 'cus_lifetime',
          payment_status: 'paid',
          status: 'complete',
        }),
      },
    },
    billingPortal: {
      sessions: { create: async ({ customer }: any) => ({ url: `https://portal/${customer}` }) },
    },
    subscriptions: { retrieve: async () => null },
    webhooks: {
      constructEvent: () => {
        if (!webhookEvent) throw new Error('invalid_signature');
        return webhookEvent;
      },
    },
  };

  const service = new StripeService({
    prisma,
    stripe,
    config: {
      appUrl: 'https://airia.pro',
      webhookSecret: 'whsec_test',
      priceIds: {
        monthly: 'price_month',
        annual: 'price_year',
        lifetime: 'price_life',
      },
      lifetimeEnabled: options.lifetimeEnabled ?? true,
    },
  });

  return {
    service,
    stripe,
    billing,
    webhookEvents,
    customerCalls,
    checkoutCalls,
    billingWrites,
    setWebhookEvent: (event: any) => { webhookEvent = event; },
  };
}

async function run() {
  const f = fixture();
  assert.deepEqual(f.service.getOfferCatalog(), [
    { plan: 'monthly', amountCents: 2990, currency: 'BRL', billingPeriod: 'month', enabled: true },
    { plan: 'annual', amountCents: 24900, currency: 'BRL', billingPeriod: 'year', enabled: true },
    { plan: 'lifetime', amountCents: 9900, currency: 'BRL', billingPeriod: 'once', enabled: true },
  ]);
  const customer = await f.service.getOrCreateCustomer('user-1', 'user@example.com');
  assert.equal(customer, 'cus_1');
  assert.equal(f.billing.get('user-1').stripeCustomerId, 'cus_1');
  assert.equal(f.customerCalls[0].metadata.userId, 'user-1');
  await f.service.getOrCreateCustomer('user-1');
  assert.equal(f.customerCalls.length, 1, 'the BillingAccount customer must be reused');

  await f.service.createCheckoutSession('user-1', 'user@example.com', 'monthly', 'attempt-1');
  await f.service.createCheckoutSession('user-1', 'user@example.com', 'annual', 'attempt-2');
  await f.service.createCheckoutSession('user-1', 'user@example.com', 'lifetime', 'attempt-3');
  assert.deepEqual(f.checkoutCalls.map((call) => call.payload.mode), ['subscription', 'subscription', 'payment']);
  assert.deepEqual(
    f.checkoutCalls.map((call) => call.payload.line_items[0].price),
    ['price_month', 'price_year', 'price_life'],
  );
  for (const [index, call] of f.checkoutCalls.entries()) {
    assert.equal(call.payload.client_reference_id, 'user-1');
    assert.match(call.payload.integration_identifier, /^airia_[a-z]{8}$/);
    assert.deepEqual(call.payload.payment_method_types, ['card']);
    assert.equal(call.payload.success_url, 'https://airia.pro/billing?session_id={CHECKOUT_SESSION_ID}');
    assert.equal(call.payload.metadata.userId, 'user-1');
    assert.equal(call.options.idempotencyKey, `airia:checkout:user-1:${call.payload.metadata.plan}:attempt-${index + 1}`);
  }

  await assert.rejects(
    () => f.service.createCheckoutSession('user-1', undefined, 'invalid' as any, 'attempt-x'),
    /invalid_plan/,
  );

  const verified = await f.service.verifyCheckoutSession('user-lifetime', 'cs_lifetime');
  assert.equal(verified.confirmed, true);
  assert.equal(verified.plan, 'lifetime');
  assert.equal(f.billing.get('user-lifetime').subscriptionStatus, 'active');
  assert.equal(f.billing.get('user-lifetime').currentPeriodEnd, null);
  await assert.rejects(
    () => f.service.verifyCheckoutSession('other-user', 'cs_lifetime'),
    /checkout_session_forbidden/,
  );

  const disabledOffer = fixture({ lifetimeEnabled: false });
  await assert.rejects(
    () => disabledOffer.service.createCheckoutSession(
      'user-lifetime', undefined, 'lifetime', 'attempt-disabled',
    ),
    /lifetime_offer_unavailable/,
  );
  const historicalPurchase = await disabledOffer.service.verifyCheckoutSession(
    'user-lifetime',
    'cs_lifetime',
  );
  assert.equal(
    historicalPurchase.confirmed,
    true,
    'disabling the offer must not revoke or block an already-paid lifetime purchase',
  );

  const invalid = fixture();
  await assert.rejects(() => invalid.service.handleWebhook(Buffer.from('{}'), 'bad'), /invalid_signature/);
  assert.equal(invalid.billingWrites.length, 0);
  assert.equal(invalid.webhookEvents.size, 0);

  f.setWebhookEvent({
    id: 'evt_subscription_created',
    type: 'customer.subscription.created',
    livemode: true,
    data: { object: {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      current_period_end: 1790000000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_year' } }] },
    } },
  });
  await f.service.handleWebhook(Buffer.from('{}'), 'valid');
  const writesAfterFirstDelivery = f.billingWrites.length;
  await f.service.handleWebhook(Buffer.from('{}'), 'valid');
  assert.equal(f.billingWrites.length, writesAfterFirstDelivery, 'duplicate Stripe events must have no repeated side effect');
  assert.equal(f.billing.get('user-1').subscriptionPlan, 'annual');
  assert.equal(f.billing.get('user-1').stripeSubscriptionId, 'sub_1');

  f.setWebhookEvent({
    id: 'evt_invoice_failed',
    type: 'invoice.payment_failed',
    livemode: true,
    data: { object: { subscription: 'sub_1' } },
  });
  await f.service.handleWebhook(Buffer.from('{}'), 'valid');
  assert.equal(f.billing.get('user-1').subscriptionStatus, 'past_due');

  f.setWebhookEvent({
    id: 'evt_subscription_deleted',
    type: 'customer.subscription.deleted',
    livemode: true,
    data: { object: {
      id: 'sub_1', customer: 'cus_1', status: 'canceled', current_period_end: 1790000000,
      cancel_at_period_end: false, items: { data: [{ price: { id: 'price_year' } }] },
    } },
  });
  await f.service.handleWebhook(Buffer.from('{}'), 'valid');
  assert.equal(f.billing.get('user-1').subscriptionStatus, 'canceled');
}

run().then(() => console.log('stripe.service tests passed'));
