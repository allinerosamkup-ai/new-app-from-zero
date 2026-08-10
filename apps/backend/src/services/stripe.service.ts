import Stripe from 'stripe';
import type { PrismaClient } from '@app/database';

import { sendSubscribeEvent } from './meta-capi.service';

export const BILLING_PLANS = ['monthly', 'annual', 'lifetime'] as const;
export type BillingPlan = typeof BILLING_PLANS[number];

export type StripeServiceConfig = {
  appUrl: string;
  webhookSecret?: string;
  priceIds: Record<BillingPlan, string | undefined>;
  lifetimeEnabled: boolean;
};

export type BillingOffer = {
  plan: BillingPlan;
  amountCents: number;
  currency: 'BRL';
  billingPeriod: 'month' | 'year' | 'once';
  enabled: boolean;
};

type StripeServiceDependencies = {
  prisma: PrismaClient;
  stripe: any | null;
  config: StripeServiceConfig;
};

type CheckoutVerification = {
  confirmed: boolean;
  plan: BillingPlan | null;
  status: string | null;
};

function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === 'string' && BILLING_PLANS.includes(value as BillingPlan);
}

function stripeId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return null;
}

function unixDate(value: unknown): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

export class StripeService {
  private readonly prisma: PrismaClient;
  private readonly stripe: any | null;
  private readonly config: StripeServiceConfig;

  constructor({ prisma, stripe, config }: StripeServiceDependencies) {
    this.prisma = prisma;
    this.stripe = stripe;
    this.config = {
      ...config,
      appUrl: config.appUrl.replace(/\/$/, ''),
    };
  }

  private requireStripe(): any {
    if (!this.stripe) throw new Error('billing_unavailable');
    return this.stripe;
  }

  private priceIdFor(plan: BillingPlan): string {
    if (plan === 'lifetime' && !this.config.lifetimeEnabled) {
      throw new Error('lifetime_offer_unavailable');
    }
    const priceId = this.config.priceIds[plan];
    if (!priceId) throw new Error('billing_plan_unavailable');
    return priceId;
  }

  private planForPrice(priceId: string | null): BillingPlan | null {
    if (!priceId) return null;
    return BILLING_PLANS.find((plan) => this.config.priceIds[plan] === priceId) ?? null;
  }

  getOfferCatalog(): BillingOffer[] {
    return [
      {
        plan: 'monthly',
        amountCents: 2990,
        currency: 'BRL',
        billingPeriod: 'month',
        enabled: Boolean(this.config.priceIds.monthly),
      },
      {
        plan: 'annual',
        amountCents: 24900,
        currency: 'BRL',
        billingPeriod: 'year',
        enabled: Boolean(this.config.priceIds.annual),
      },
      {
        plan: 'lifetime',
        amountCents: 9900,
        currency: 'BRL',
        billingPeriod: 'once',
        enabled: this.config.lifetimeEnabled && Boolean(this.config.priceIds.lifetime),
      },
    ];
  }

  async getOrCreateCustomer(userId: string, email?: string): Promise<string> {
    const existing = await this.prisma.billingAccount.findUnique({ where: { userId } });
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await this.requireStripe().customers.create({
      ...(email ? { email } : {}),
      metadata: { userId },
    }, {
      idempotencyKey: `airia:customer:${userId}`,
    });

    await this.prisma.billingAccount.upsert({
      where: { userId },
      create: { userId, stripeCustomerId: customer.id },
      update: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  async createCheckoutSession(
    userId: string,
    email: string | undefined,
    planInput: BillingPlan,
    attemptKey: string,
  ): Promise<string> {
    if (!isBillingPlan(planInput)) throw new Error('invalid_plan');
    const stripe = this.requireStripe();
    const priceId = this.priceIdFor(planInput);
    const customerId = await this.getOrCreateCustomer(userId, email);
    const metadata = { userId, plan: planInput };
    const mode = planInput === 'lifetime' ? 'payment' : 'subscription';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.config.appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.appUrl}/billing?status=canceled`,
      metadata,
      ...(mode === 'subscription'
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
    }, {
      idempotencyKey: `airia:checkout:${userId}:${planInput}:${attemptKey}`,
    });

    if (!session.url) throw new Error('checkout_failed');
    return session.url;
  }

  async verifyCheckoutSession(userId: string, sessionId: string): Promise<CheckoutVerification> {
    const session = await this.requireStripe().checkout.sessions.retrieve(sessionId);
    const ownerId = session.client_reference_id ?? session.metadata?.userId;
    if (ownerId !== userId) throw new Error('checkout_session_forbidden');

    const plan = isBillingPlan(session.metadata?.plan) ? session.metadata.plan : null;
    if (!plan) return { confirmed: false, plan: null, status: session.status ?? null };

    if (plan === 'lifetime') {
      const confirmed = session.status === 'complete' && session.payment_status === 'paid';
      if (confirmed) {
        await this.prisma.billingAccount.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: stripeId(session.customer),
            subscriptionStatus: 'active',
            subscriptionPlan: 'lifetime',
            priceId: this.config.priceIds.lifetime ?? null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          update: {
            stripeCustomerId: stripeId(session.customer) ?? undefined,
            subscriptionStatus: 'active',
            subscriptionPlan: 'lifetime',
            priceId: this.config.priceIds.lifetime ?? null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
        });
      }
      return { confirmed, plan, status: session.payment_status ?? session.status ?? null };
    }

    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) {
      return { confirmed: false, plan, status: session.status ?? null };
    }
    const subscription = await this.requireStripe().subscriptions.retrieve(subscriptionId);
    await this.syncSubscription(this.prisma, subscription as any);
    return {
      confirmed: subscription.status === 'active' || subscription.status === 'trialing',
      plan,
      status: subscription.status,
    };
  }

  async createPortalSession(userId: string): Promise<string> {
    const account = await this.prisma.billingAccount.findUnique({ where: { userId } });
    if (!account?.stripeCustomerId) throw new Error('no_stripe_customer');
    const session = await this.requireStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${this.config.appUrl}/billing`,
    });
    return session.url;
  }

  private async syncSubscription(client: any, subscription: any): Promise<string | null> {
    const customerId = stripeId(subscription.customer);
    const subscriptionId = stripeId(subscription);
    const item = subscription.items?.data?.[0];
    const priceId = stripeId(item?.price);
    const plan = this.planForPrice(priceId);
    const metadataUserId = typeof subscription.metadata?.userId === 'string'
      ? subscription.metadata.userId
      : null;
    const account = customerId
      ? await client.billingAccount.findUnique({ where: { stripeCustomerId: customerId } })
      : subscriptionId
        ? await client.billingAccount.findUnique({ where: { stripeSubscriptionId: subscriptionId } })
        : null;
    const userId = account?.userId ?? metadataUserId;
    if (!userId || !plan) return null;

    const currentPeriodEnd = unixDate(
      subscription.current_period_end ?? item?.current_period_end,
    );
    await client.billingAccount.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: subscription.status,
        subscriptionPlan: plan,
        priceId,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      },
      update: {
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId ?? undefined,
        subscriptionStatus: subscription.status,
        subscriptionPlan: plan,
        priceId,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      },
    });
    return userId;
  }

  private async syncLifetimeCheckout(client: any, session: any): Promise<string | null> {
    const userId = session.client_reference_id ?? session.metadata?.userId;
    if (
      typeof userId !== 'string'
      || session.metadata?.plan !== 'lifetime'
      || session.status !== 'complete'
      || session.payment_status !== 'paid'
    ) return null;

    await client.billingAccount.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: stripeId(session.customer),
        subscriptionStatus: 'active',
        subscriptionPlan: 'lifetime',
        priceId: this.config.priceIds.lifetime ?? null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      update: {
        stripeCustomerId: stripeId(session.customer) ?? undefined,
        subscriptionStatus: 'active',
        subscriptionPlan: 'lifetime',
        priceId: this.config.priceIds.lifetime ?? null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
    return userId;
  }

  private async markInvoiceStatus(client: any, invoice: any, status: string): Promise<string | null> {
    const subscriptionId = stripeId(invoice.subscription)
      ?? stripeId(invoice.parent?.subscription_details?.subscription);
    const customerId = stripeId(invoice.customer);
    const account = subscriptionId
      ? await client.billingAccount.findUnique({ where: { stripeSubscriptionId: subscriptionId } })
      : customerId
        ? await client.billingAccount.findUnique({ where: { stripeCustomerId: customerId } })
        : null;
    if (!account) return null;
    await client.billingAccount.update({
      where: { userId: account.userId },
      data: { subscriptionStatus: status },
    });
    return account.userId;
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ duplicate: boolean; result: string }> {
    const stripe = this.requireStripe();
    if (!this.config.webhookSecret) throw new Error('billing_unavailable');

    // Signature validation must happen before any read or write with side effects.
    const event = stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing) return { duplicate: true, result: existing.result ?? 'duplicate' };

    let result = 'ignored';
    let subscriptionForCapi: any = null;
    let duplicateInTransaction = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.stripeWebhookEvent.findUnique({
          where: { stripeEventId: event.id },
        });
        if (duplicate) {
          duplicateInTransaction = true;
          result = duplicate.result ?? 'duplicate';
          return;
        }

        const object = event.data.object as any;
        if (event.type === 'checkout.session.completed') {
          result = await this.syncLifetimeCheckout(tx, object) ? 'lifetime_activated' : 'checkout_ignored';
        } else if (
          event.type === 'customer.subscription.created'
          || event.type === 'customer.subscription.updated'
          || event.type === 'customer.subscription.deleted'
        ) {
          result = await this.syncSubscription(tx, object) ? 'subscription_synced' : 'subscription_unmatched';
          if (
            event.type === 'customer.subscription.created'
            && (object.status === 'active' || object.status === 'trialing')
          ) subscriptionForCapi = object;
        } else if (event.type === 'invoice.paid') {
          result = await this.markInvoiceStatus(tx, object, 'active') ? 'invoice_paid' : 'invoice_unmatched';
        } else if (event.type === 'invoice.payment_failed') {
          result = await this.markInvoiceStatus(tx, object, 'past_due') ? 'invoice_failed' : 'invoice_unmatched';
        }

        await tx.stripeWebhookEvent.create({
          data: {
            stripeEventId: event.id,
            eventType: event.type,
            livemode: event.livemode,
            result,
          },
        });
      });
    } catch (error: any) {
      if (error?.code === 'P2002') return { duplicate: true, result: 'duplicate' };
      throw error;
    }

    if (duplicateInTransaction) return { duplicate: true, result };
    if (subscriptionForCapi && result === 'subscription_synced') {
      await this.sendSubscriptionToMeta(subscriptionForCapi);
    }
    return { duplicate: false, result };
  }

  private async sendSubscriptionToMeta(subscription: any): Promise<void> {
    try {
      const customerId = stripeId(subscription.customer);
      const item = subscription.items?.data?.[0];
      let email: string | undefined;
      if (customerId) {
        try {
          const customer = await this.requireStripe().customers.retrieve(customerId);
          if (!('deleted' in customer) || !customer.deleted) email = customer.email ?? undefined;
        } catch {
          // Meta attribution is best effort and cannot invalidate paid access.
        }
      }
      await sendSubscribeEvent({
        email,
        value: (item?.price?.unit_amount ?? 0) / 100,
        currency: (item?.price?.currency ?? 'brl').toUpperCase(),
        eventId: subscription.id,
        eventTime: typeof subscription.created === 'number' ? subscription.created : undefined,
        eventSourceUrl: `${this.config.appUrl}/billing`,
      });
    } catch (error: any) {
      console.error('[stripe/webhook] Meta Subscribe failed:', error?.message);
    }
  }
}

export function createStripeServiceFromEnv(prisma: PrismaClient): StripeService {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const lifetimePriceId = process.env.STRIPE_PRICE_ID_LIFETIME;
  return new StripeService({
    prisma,
    stripe: secretKey ? new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' }) : null,
    config: {
      appUrl: process.env.APP_URL || 'https://airia.pro',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      priceIds: {
        monthly: process.env.STRIPE_PRICE_ID,
        annual: process.env.STRIPE_PRICE_ID_ANNUAL,
        lifetime: lifetimePriceId,
      },
      lifetimeEnabled: process.env.STRIPE_LIFETIME_ENABLED !== 'false' && Boolean(lifetimePriceId),
    },
  });
}
