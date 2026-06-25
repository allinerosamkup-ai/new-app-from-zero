import Stripe from 'stripe';
import { PrismaClient } from '@app/database';

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
});

const PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID!;
const PRICE_ID_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL || process.env.STRIPE_PRICE_ID!;
const APP_URL = process.env.APP_URL || 'https://airia.pro';

export class StripeService {
  static async getOrCreateCustomer(userId: string, email?: string): Promise<string> {
    const onboarding = await prisma.onboardingResponse.findUnique({ where: { userId } });

    if (onboarding?.stripeCustomerId) {
      return onboarding.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      ...(email ? { email } : {}),
      metadata: { userId },
    });

    await prisma.onboardingResponse.update({
      where: { userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  static async createCheckoutSession(
    userId: string,
    email?: string,
    plan: 'monthly' | 'annual' = 'monthly',
  ): Promise<string> {
    const customerId = await StripeService.getOrCreateCustomer(userId, email);
    const priceId = plan === 'annual' ? PRICE_ID_ANNUAL : PRICE_ID_MONTHLY;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing?status=success`,
      cancel_url: `${APP_URL}/billing?status=canceled`,
      metadata: { userId, plan },
    });

    return session.url!;
  }

  static async createPortalSession(userId: string): Promise<string> {
    const onboarding = await prisma.onboardingResponse.findUnique({ where: { userId } });
    if (!onboarding?.stripeCustomerId) throw new Error('no_stripe_customer');

    const session = await stripe.billingPortal.sessions.create({
      customer: onboarding.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    return session.url;
  }

  static async getSubscriptionStatus(userId: string) {
    const onboarding = await prisma.onboardingResponse.findUnique({ where: { userId } });
    return {
      status: onboarding?.subscriptionStatus ?? null,
      plan: onboarding?.subscriptionPlan ?? null,
      periodEnd: onboarding?.subscriptionPeriodEnd ?? null,
    };
  }

  static async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as any;
      const customerId: string = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

      const onboarding = await prisma.onboardingResponse.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!onboarding) return;

      const item = sub.items.data[0];
      const interval = item?.price?.recurring?.interval;
      const periodEnd = (sub as any).current_period_end as number | undefined;

      await prisma.onboardingResponse.update({
        where: { userId: onboarding.userId },
        data: {
          subscriptionStatus: sub.status,
          subscriptionPlan: interval === 'year' ? 'annual' : 'monthly',
          subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
    }
  }
}
