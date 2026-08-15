import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { PrismaClient } from '@app/database';

import {
  type BillingOffer,
  type BillingPlan,
  type BillingProvider,
  type CancelResult,
  type CheckoutResult,
  type CheckoutVerification,
} from './billing-provider';

const CAKTO_BILLING_PLANS: BillingPlan[] = ['monthly', 'annual', 'lifetime'];

type OfferConfig = { offerId?: string; productId?: string; amountCents: number };
export type CaktoServiceConfig = {
  baseUrl: string;
  checkoutBaseUrl: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  offers: Record<BillingPlan, OfferConfig>;
};

type CaktoDependencies = {
  prisma: PrismaClient;
  config: CaktoServiceConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type WebhookPayload = {
  event: string;
  secret: string;
  data: {
    id: string;
    sck?: string | null;
    status?: string | null;
    amount?: number | string | null;
    offer?: { id?: string | null; price?: number | string | null } | null;
    product?: { id?: string | null; type?: string | null } | null;
    subscription?: Record<string, any> | null;
  };
};

const POSITIVE_EVENTS = new Set(['purchase_approved', 'subscription_created', 'subscription_renewed']);
const NEGATIVE_EVENTS = new Set(['refund', 'chargeback']);
const REFUSED_EVENTS = new Set(['purchase_refused', 'subscription_renewal_refused']);

function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === 'string' && CAKTO_BILLING_PLANS.includes(value as BillingPlan);
}

function sameSecret(actual: unknown, expected: string | undefined): boolean {
  if (typeof actual !== 'string' || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function valueMatchesCents(value: unknown, expectedCents: number): boolean {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number)
    && (Math.round(number) === expectedCents || Math.round(number * 100) === expectedCents);
}

function dateFrom(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function subscriptionPeriodEnd(subscription: Record<string, any> | null | undefined): Date | null {
  if (!subscription) return null;
  return dateFrom(subscription.next_payment_date);
}

function checkoutOfferId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean);
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

function webhookEventId(payload: WebhookPayload): string {
  const subscription = payload.data.subscription;
  const period = subscription?.current_period?.end
    ?? subscription?.current_period?.end_date
    ?? subscription?.current_period
    ?? subscription?.next_payment_date
    ?? payload.data.status
    ?? 'none';
  return `${payload.event}:${payload.data.id}:${String(period)}`;
}

function isStrictlyNewerAttempt(attempt: any, account: any): boolean {
  const attemptCreatedAt = dateFrom(attempt?.createdAt);
  const accountUpdatedAt = dateFrom(account?.updatedAt);
  return Boolean(attemptCreatedAt && accountUpdatedAt
    && attemptCreatedAt.getTime() > accountUpdatedAt.getTime());
}

function unwrapApiResponse(value: any): any {
  return value && typeof value === 'object' && value.data && typeof value.data === 'object' ? value.data : value;
}

export class CaktoService implements BillingProvider {
  readonly name = 'cakto' as const;
  private readonly prisma: PrismaClient;
  private readonly config: CaktoServiceConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor({ prisma, config, fetchImpl = fetch, now = () => new Date() }: CaktoDependencies) {
    this.prisma = prisma;
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      checkoutBaseUrl: config.checkoutBaseUrl.replace(/\/$/, ''),
    };
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.clientId && this.config.clientSecret && this.config.webhookSecret
      && CAKTO_BILLING_PLANS.every((plan) => this.config.offers[plan].offerId && this.config.offers[plan].productId),
    );
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) throw new Error('billing_unavailable');
  }

  getOfferCatalog(): BillingOffer[] {
    return [
      { plan: 'monthly', amountCents: 2990, currency: 'BRL', billingPeriod: 'month', enabled: Boolean(this.config.offers.monthly.offerId) },
      { plan: 'annual', amountCents: 24900, currency: 'BRL', billingPeriod: 'year', enabled: Boolean(this.config.offers.annual.offerId) },
      { plan: 'lifetime', amountCents: 9900, currency: 'BRL', billingPeriod: 'once', enabled: Boolean(this.config.offers.lifetime.offerId) },
    ];
  }

  private offerFor(plan: BillingPlan): Required<OfferConfig> {
    if (!isBillingPlan(plan)) throw new Error('invalid_plan');
    const offer = this.config.offers[plan];
    if (!offer.offerId || !offer.productId) throw new Error('billing_plan_unavailable');
    return offer as Required<OfferConfig>;
  }

  async createCheckoutSession(
    userId: string,
    email: string | undefined,
    plan: BillingPlan,
    attemptKey: string,
  ): Promise<CheckoutResult> {
    this.requireConfigured();
    const offer = this.offerFor(plan);
    const attempt = await (this.prisma as any).billingCheckoutAttempt.upsert({
      where: { userId_provider_attemptKey: { userId, provider: 'cakto', attemptKey } },
      create: {
        publicToken: randomUUID(), userId, provider: 'cakto', plan,
        offerId: offer.offerId, attemptKey, status: 'pending',
        expiresAt: new Date(this.now().getTime() + (24 * 60 * 60 * 1000)),
      },
      update: {},
    });
    if (attempt.plan !== plan || attempt.offerId !== offer.offerId) {
      throw new Error('checkout_attempt_conflict');
    }
    const url = new URL(`${this.config.checkoutBaseUrl}/${offer.offerId}`);
    url.searchParams.set('sck', attempt.publicToken);
    if (email) url.searchParams.set('email', email);
    return { url: url.toString(), verificationId: attempt.id };
  }

  async verifyCheckoutSession(userId: string, verificationId: string): Promise<CheckoutVerification> {
    const attempt = await (this.prisma as any).billingCheckoutAttempt.findUnique({ where: { id: verificationId } });
    if (!attempt || attempt.userId !== userId) throw new Error('checkout_session_forbidden');
    return {
      confirmed: attempt.status === 'paid',
      plan: isBillingPlan(attempt.plan) ? attempt.plan : null,
      status: attempt.status ?? null,
    };
  }

  private async token(): Promise<string> {
    this.requireConfigured();
    if (this.accessToken && this.accessToken.expiresAt > this.now().getTime()) return this.accessToken.value;
    const body = new URLSearchParams({
      client_id: this.config.clientId!, client_secret: this.config.clientSecret!,
    });
    const response = await this.fetchImpl(`${this.config.baseUrl}/public_api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(1300),
    });
    if (!response.ok) throw new Error('cakto_auth_failed');
    const data = await response.json() as any;
    if (typeof data.access_token !== 'string') throw new Error('cakto_auth_failed');
    const lifetimeSeconds = Math.max(1, Number(data.expires_in) || 300);
    this.accessToken = {
      value: data.access_token,
      expiresAt: this.now().getTime() + (Math.max(1, lifetimeSeconds - 30) * 1000),
    };
    return data.access_token;
  }

  private async api(path: string, init: RequestInit = {}): Promise<any> {
    const token = await this.token();
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(1300),
    });
    if (!response.ok) throw new Error(`cakto_api_failed:${response.status}`);
    const text = await response.text();
    return text ? unwrapApiResponse(JSON.parse(text)) : null;
  }

  private validateOrder(order: any, payload: WebhookPayload, attempt: any): Required<OfferConfig> {
    const offer = this.offerFor(attempt.plan);
    if (!order || order.id !== payload.data.id || order.sck !== attempt.publicToken) throw new Error('order_mismatch');
    if (order.product?.id !== offer.productId || checkoutOfferId(order.checkoutUrl) !== offer.offerId) {
      throw new Error('order_mismatch');
    }
    if (!valueMatchesCents(order.baseAmount, offer.amountCents)) throw new Error('order_mismatch');
    const expectedType = attempt.plan === 'lifetime' ? 'unique' : 'subscription';
    if (order.type !== expectedType || order.offer_type !== 'main') throw new Error('order_mismatch');
    if (POSITIVE_EVENTS.has(payload.event) && order.status !== 'paid') throw new Error('order_not_paid');
    if (payload.event === 'refund' && order.status !== 'refunded') throw new Error('order_mismatch');
    if (payload.event === 'chargeback' && order.status !== 'chargedback') throw new Error('order_mismatch');
    if (REFUSED_EVENTS.has(payload.event) && !['refused', 'blocked', 'retrying'].includes(order.status)) {
      throw new Error('order_mismatch');
    }
    if (payload.data.offer?.id && payload.data.offer.id !== offer.offerId) throw new Error('order_mismatch');
    if (payload.data.product?.id && payload.data.product.id !== offer.productId) throw new Error('order_mismatch');
    return offer;
  }

  private async subscriptionForOrder(order: any, offer: Required<OfferConfig>): Promise<Record<string, any>> {
    const subscriptionId = typeof order.subscription === 'string'
      ? order.subscription
      : typeof order.subscription?.id === 'string'
        ? order.subscription.id
        : null;
    if (!subscriptionId) throw new Error('order_mismatch');
    const subscription = await this.api(`/public_api/subscriptions/${encodeURIComponent(subscriptionId)}/`);
    if (!subscription || subscription.id !== subscriptionId) throw new Error('order_mismatch');
    if (subscription.product?.id !== offer.productId || subscription.offer?.id !== offer.offerId) {
      throw new Error('order_mismatch');
    }
    return subscription;
  }

  async handleWebhook(input: unknown): Promise<{ duplicate: boolean; result: string }> {
    const payload = input as WebhookPayload;
    if (!payload || typeof payload !== 'object' || !sameSecret(payload.secret, this.config.webhookSecret)) {
      throw new Error('invalid_webhook_secret');
    }
    if (typeof payload.event !== 'string' || typeof payload.data?.id !== 'string' || typeof payload.data?.sck !== 'string') {
      throw new Error('invalid_webhook_payload');
    }
    const eventId = webhookEventId(payload);
    const existing = await (this.prisma as any).billingWebhookEvent.findUnique({
      where: { provider_eventId: { provider: 'cakto', eventId } },
    });
    if (existing) return { duplicate: true, result: existing.result ?? 'duplicate' };

    const attempt = await (this.prisma as any).billingCheckoutAttempt.findUnique({
      where: { publicToken: payload.data.sck },
    });
    if (!attempt || attempt.provider !== 'cakto') throw new Error('checkout_attempt_not_found');
    const order = await this.api(`/public_api/orders/${encodeURIComponent(payload.data.id)}/`);
    const offer = this.validateOrder(order, payload, attempt);
    const isPositive = POSITIVE_EVENTS.has(payload.event);
    const isNegative = NEGATIVE_EVENTS.has(payload.event);
    const isCanceled = payload.event === 'subscription_canceled';
    const isRenewalRefused = payload.event === 'subscription_renewal_refused';
    const isPurchaseRefused = payload.event === 'purchase_refused';
    const needsSubscription = attempt.plan !== 'lifetime' && (isPositive || isCanceled || isRenewalRefused);
    const subscription = needsSubscription ? await this.subscriptionForOrder(order, offer) : null;
    if (isPositive && subscription && !['active', 'trial'].includes(subscription.status)) {
      throw new Error('subscription_not_active');
    }
    const periodEnd = subscriptionPeriodEnd(subscription);
    let result = 'ignored';

    try {
      await (this.prisma as any).$transaction(async (tx: any) => {
        const duplicate = await tx.billingWebhookEvent.findUnique({
          where: { provider_eventId: { provider: 'cakto', eventId } },
        });
        if (duplicate) { result = duplicate.result ?? 'duplicate'; return; }

        if (isPositive) {
          const lifetime = attempt.plan === 'lifetime';
          const account = await tx.billingAccount.findUnique({ where: { userId: attempt.userId } });
          const sameCaktoPurchase = account?.billingProvider === 'cakto'
            && (lifetime
              ? account.externalOrderId === order.id
              : account.externalSubscriptionId === subscription?.id);
          const replacesCaktoPurchase = account?.billingProvider === 'cakto' && !sameCaktoPurchase;
          if (replacesCaktoPurchase && (payload.event === 'subscription_renewed'
            || account.subscriptionPlan === 'lifetime'
            || !isStrictlyNewerAttempt(attempt, account))) {
            result = payload.event === 'subscription_renewed'
              ? 'stale_subscription_ignored'
              : 'stale_purchase_ignored';
          } else {
            await tx.billingAccount.upsert({
              where: { userId: attempt.userId },
              create: {
                userId: attempt.userId, billingProvider: 'cakto', subscriptionStatus: 'active',
                subscriptionPlan: attempt.plan, priceId: offer.offerId,
                externalSubscriptionId: subscription?.id ?? null, externalOrderId: order.id,
                externalOfferId: offer.offerId, currentPeriodEnd: lifetime ? null : periodEnd,
                cancelAtPeriodEnd: false,
              },
              update: {
                billingProvider: 'cakto', subscriptionStatus: 'active', subscriptionPlan: attempt.plan,
                priceId: offer.offerId, externalSubscriptionId: subscription?.id ?? undefined,
                externalOrderId: order.id, externalOfferId: offer.offerId,
                currentPeriodEnd: lifetime ? null : periodEnd, cancelAtPeriodEnd: false,
              },
            });
            await tx.billingCheckoutAttempt.update({
              where: { id: attempt.id },
              data: { status: 'paid', orderId: order.id, consumedAt: this.now() },
            });
            result = lifetime ? 'lifetime_activated' : 'subscription_activated';
          }
        } else if (isNegative) {
          const account = await tx.billingAccount.findUnique({ where: { userId: attempt.userId } });
          if (account?.billingProvider === 'cakto' && account.externalOrderId === order.id) {
            await tx.billingAccount.update({
              where: { userId: attempt.userId },
              data: { subscriptionStatus: payload.event === 'refund' ? 'refunded' : 'chargedback', currentPeriodEnd: null },
            });
          }
          await tx.billingCheckoutAttempt.update({
            where: { id: attempt.id }, data: { status: payload.event, orderId: order.id },
          });
          result = `${payload.event}_recorded`;
        } else if (isCanceled) {
          const account = await tx.billingAccount.findUnique({ where: { userId: attempt.userId } });
          if (account?.billingProvider === 'cakto'
            && account.externalSubscriptionId === subscription?.id) {
            await tx.billingAccount.update({
              where: { userId: attempt.userId },
              data: { subscriptionStatus: 'canceled', currentPeriodEnd: periodEnd ?? account.currentPeriodEnd, cancelAtPeriodEnd: true },
            });
            result = 'subscription_canceled';
          } else {
            result = 'stale_subscription_ignored';
          }
        } else if (isRenewalRefused) {
          const account = await tx.billingAccount.findUnique({ where: { userId: attempt.userId } });
          if (account?.billingProvider === 'cakto'
            && account.externalSubscriptionId === subscription?.id) {
            await tx.billingAccount.update({
              where: { userId: attempt.userId },
              data: { subscriptionStatus: 'past_due', currentPeriodEnd: periodEnd ?? account.currentPeriodEnd },
            });
            result = 'subscription_past_due';
          } else {
            result = 'stale_subscription_ignored';
          }
        } else if (isPurchaseRefused) {
          await tx.billingCheckoutAttempt.update({
            where: { id: attempt.id }, data: { status: 'refused', orderId: order.id },
          });
          result = 'purchase_refused';
        }
        await tx.billingWebhookEvent.create({
          data: { provider: 'cakto', eventId, eventType: payload.event, result },
        });
      });
    } catch (error: any) {
      if (error?.code === 'P2002') return { duplicate: true, result: 'duplicate' };
      throw error;
    }
    return { duplicate: result === 'duplicate', result };
  }

  async cancelSubscription(userId: string): Promise<CancelResult> {
    this.requireConfigured();
    const account = await (this.prisma as any).billingAccount.findUnique({ where: { userId } });
    if (!account || account.billingProvider !== 'cakto' || !account.externalSubscriptionId) {
      throw new Error('no_subscription');
    }
    if (account.subscriptionPlan === 'lifetime') throw new Error('lifetime_cannot_cancel');
    const offer = this.offerFor(account.subscriptionPlan);
    const subscription = await this.api(
      `/public_api/subscriptions/${encodeURIComponent(account.externalSubscriptionId)}/`,
    );
    if (subscription?.id !== account.externalSubscriptionId
      || subscription.product?.id !== offer.productId
      || subscription.offer?.id !== offer.offerId) {
      throw new Error('subscription_mismatch');
    }
    const latest = await (this.prisma as any).billingAccount.findUnique({ where: { userId } });
    if (latest?.billingProvider !== 'cakto'
      || latest.externalSubscriptionId !== account.externalSubscriptionId) {
      throw new Error('subscription_changed');
    }
    await this.api(`/public_api/subscriptions/${encodeURIComponent(account.externalSubscriptionId)}/cancel/`, {
      method: 'POST',
    });
    const periodEnd = subscriptionPeriodEnd(subscription) ?? account.currentPeriodEnd;
    const updated = await (this.prisma as any).billingAccount.updateMany({
      where: {
        userId,
        billingProvider: 'cakto',
        externalSubscriptionId: account.externalSubscriptionId,
      },
      data: { subscriptionStatus: 'canceled', currentPeriodEnd: periodEnd, cancelAtPeriodEnd: true },
    });
    if (updated.count !== 1) throw new Error('subscription_changed_after_cancel');
    return { canceled: true, periodEnd: periodEnd?.toISOString?.() ?? periodEnd ?? null };
  }
}

export function createCaktoServiceFromEnv(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): CaktoService {
  return new CaktoService({
    prisma,
    config: {
      baseUrl: env.CAKTO_API_BASE_URL || 'https://api.cakto.com.br',
      checkoutBaseUrl: env.CAKTO_CHECKOUT_BASE_URL || 'https://pay.cakto.com.br',
      clientId: env.CAKTO_CLIENT_ID,
      clientSecret: env.CAKTO_CLIENT_SECRET,
      webhookSecret: env.CAKTO_WEBHOOK_SECRET,
      offers: {
        monthly: { offerId: env.CAKTO_MONTHLY_OFFER_ID, productId: env.CAKTO_SUBSCRIPTION_PRODUCT_ID, amountCents: 2990 },
        annual: { offerId: env.CAKTO_ANNUAL_OFFER_ID, productId: env.CAKTO_SUBSCRIPTION_PRODUCT_ID, amountCents: 24900 },
        lifetime: { offerId: env.CAKTO_LIFETIME_OFFER_ID, productId: env.CAKTO_LIFETIME_PRODUCT_ID, amountCents: 9900 },
      },
    },
  });
}
