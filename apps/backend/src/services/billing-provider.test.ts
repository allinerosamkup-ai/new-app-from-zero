import assert from 'node:assert/strict';

import { createBillingProviderFromEnv } from './billing-provider';

const prisma = {} as any;

function configuredCaktoEnv() {
  return {
    BILLING_PROVIDER: 'cakto', CAKTO_CLIENT_ID: 'id', CAKTO_CLIENT_SECRET: 'secret', CAKTO_WEBHOOK_SECRET: 'hook',
    CAKTO_MONTHLY_OFFER_ID: 'm', CAKTO_ANNUAL_OFFER_ID: 'a', CAKTO_LIFETIME_OFFER_ID: 'l',
    CAKTO_SUBSCRIPTION_PRODUCT_ID: 'p1', CAKTO_LIFETIME_PRODUCT_ID: 'p2',
  };
}

async function run() {
  const cakto = createBillingProviderFromEnv(prisma, configuredCaktoEnv() as NodeJS.ProcessEnv);
  assert.equal(cakto.name, 'cakto');
  assert.equal(cakto.isConfigured(), true);

  const incomplete = createBillingProviderFromEnv(prisma, { BILLING_PROVIDER: 'cakto' } as NodeJS.ProcessEnv);
  assert.equal(incomplete.name, 'cakto');
  assert.equal(incomplete.isConfigured(), false);
  await assert.rejects(() => incomplete.createCheckoutSession('u', undefined, 'monthly', 'attempt-key'), /billing_unavailable/);

  const stripe = createBillingProviderFromEnv(prisma, { BILLING_PROVIDER: 'stripe' } as NodeJS.ProcessEnv);
  assert.equal(stripe.name, 'stripe');
  assert.equal(stripe.isConfigured(), false);
}

run().then(() => console.log('billing-provider tests passed'));
