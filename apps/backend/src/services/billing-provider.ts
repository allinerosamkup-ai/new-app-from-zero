import type { PrismaClient } from '@app/database';

import { CaktoService, createCaktoServiceFromEnv } from './cakto.service';
import { createStripeServiceFromEnv, StripeService } from './stripe.service';

export const BILLING_PLANS = ['monthly', 'annual', 'lifetime'] as const;
export type BillingPlan = typeof BILLING_PLANS[number];

export type BillingOffer = {
  plan: BillingPlan;
  amountCents: number;
  currency: 'BRL';
  billingPeriod: 'month' | 'year' | 'once';
  enabled: boolean;
};

export type CheckoutResult = { url: string; verificationId: string };
export type CheckoutVerification = { confirmed: boolean; plan: BillingPlan | null; status: string | null };
export type CancelResult = { canceled: boolean; periodEnd: string | null };

export interface BillingProvider {
  readonly name: 'cakto' | 'stripe';
  isConfigured(): boolean;
  getOfferCatalog(): BillingOffer[];
  createCheckoutSession(userId: string, email: string | undefined, plan: BillingPlan, attemptKey: string): Promise<CheckoutResult>;
  verifyCheckoutSession(userId: string, verificationId: string): Promise<CheckoutVerification>;
  createPortalSession?(userId: string): Promise<string>;
  cancelSubscription?(userId: string): Promise<CancelResult>;
}

class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe' as const;
  constructor(private readonly stripe: StripeService, private readonly configured: boolean) {}
  isConfigured() { return this.configured; }
  getOfferCatalog() { return this.stripe.getOfferCatalog(); }
  async createCheckoutSession(userId: string, email: string | undefined, plan: BillingPlan, attemptKey: string) {
    const url = await this.stripe.createCheckoutSession(userId, email, plan, attemptKey);
    const sessionId = new URL(url).searchParams.get('session_id') ?? `stripe:${attemptKey}`;
    return { url, verificationId: sessionId };
  }
  verifyCheckoutSession(userId: string, verificationId: string) {
    const sessionId = verificationId.startsWith('stripe:') ? verificationId.slice(7) : verificationId;
    return this.stripe.verifyCheckoutSession(userId, sessionId);
  }
  createPortalSession(userId: string) { return this.stripe.createPortalSession(userId); }
}

class UnavailableBillingProvider implements BillingProvider {
  constructor(readonly name: 'cakto' | 'stripe') {}
  isConfigured() { return false; }
  getOfferCatalog(): BillingOffer[] { return []; }
  async createCheckoutSession(): Promise<CheckoutResult> { throw new Error('billing_unavailable'); }
  async verifyCheckoutSession(): Promise<CheckoutVerification> { throw new Error('billing_unavailable'); }
}

export function createBillingProviderFromEnv(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: { cakto?: CaktoService; stripe?: StripeService } = {},
): BillingProvider {
  const selected = env.BILLING_PROVIDER?.trim().toLowerCase() || 'cakto';
  if (selected === 'stripe') {
    const service = dependencies.stripe ?? createStripeServiceFromEnv(prisma, env);
    const configured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);
    return configured ? new StripeBillingProvider(service, true) : new UnavailableBillingProvider('stripe');
  }
  if (selected !== 'cakto') return new UnavailableBillingProvider('cakto');
  const service = dependencies.cakto ?? createCaktoServiceFromEnv(prisma, env);
  return service.isConfigured() ? service : new UnavailableBillingProvider('cakto');
}

export function stripeBillingProvider(service: StripeService, configured = true): BillingProvider {
  return new StripeBillingProvider(service, configured);
}
