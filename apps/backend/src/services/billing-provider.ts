import type { PrismaClient } from '@app/database';

import { CaktoService, createCaktoServiceFromEnv } from './cakto.service';

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
  readonly name: 'cakto';
  isConfigured(): boolean;
  getOfferCatalog(): BillingOffer[];
  createCheckoutSession(userId: string, email: string | undefined, plan: BillingPlan, attemptKey: string): Promise<CheckoutResult>;
  verifyCheckoutSession(userId: string, verificationId: string): Promise<CheckoutVerification>;
  createPortalSession?(userId: string): Promise<string>;
  cancelSubscription?(userId: string): Promise<CancelResult>;
}

class UnavailableBillingProvider implements BillingProvider {
  readonly name = 'cakto' as const;
  isConfigured() { return false; }
  getOfferCatalog(): BillingOffer[] { return []; }
  async createCheckoutSession(): Promise<CheckoutResult> { throw new Error('billing_unavailable'); }
  async verifyCheckoutSession(): Promise<CheckoutVerification> { throw new Error('billing_unavailable'); }
}

export function createBillingProviderFromEnv(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: { cakto?: CaktoService } = {},
): BillingProvider {
  const service = dependencies.cakto ?? createCaktoServiceFromEnv(prisma, env);
  return service.isConfigured() ? service : new UnavailableBillingProvider();
}
