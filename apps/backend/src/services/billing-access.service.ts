import type { PrismaClient } from '@app/database';

const DAY_MS = 24 * 60 * 60 * 1000;
const STANDARD_TRIAL_DAYS = 7;
const REFERRED_TRIAL_DAYS = 14;
const PAID_STATUSES = new Set(['active', 'trialing']);

export type BillingAccessSummary = {
  access: 'pro' | 'free';
  source: 'paid' | 'professional' | 'trial' | 'free';
  subscriptionStatus: string | null;
  plan: 'monthly' | 'annual' | null;
  periodEnd: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  checkoutAvailable: boolean;
};

export type BillingAccessState = {
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
  currentPeriodEnd?: Date | string | null;
  professionalVerified?: boolean;
  trialEndsAt?: Date | string | null;
  checkoutAvailable?: boolean;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value: Date | string | null | undefined): string | null {
  return toDate(value)?.toISOString() ?? null;
}

export function resolveAccess(
  state: BillingAccessState,
  now = new Date(),
): BillingAccessSummary {
  const subscriptionStatus = state.subscriptionStatus ?? null;
  const paid = PAID_STATUSES.has(subscriptionStatus ?? '');
  const trialEndsAt = toDate(state.trialEndsAt);
  const trialActive = !!trialEndsAt && trialEndsAt.getTime() > now.getTime();
  const professional = state.professionalVerified === true;
  const source = paid
    ? 'paid'
    : professional
      ? 'professional'
      : trialActive
        ? 'trial'
        : 'free';

  const rawPlan = state.subscriptionPlan;
  const plan = rawPlan === 'monthly' || rawPlan === 'annual' ? rawPlan : null;
  const daysRemaining = trialActive && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS))
    : 0;

  return {
    access: source === 'free' ? 'free' : 'pro',
    source,
    subscriptionStatus,
    plan,
    periodEnd: toIso(state.currentPeriodEnd),
    trialEndsAt: toIso(trialEndsAt),
    daysRemaining,
    checkoutAvailable: state.checkoutAvailable ?? true,
  };
}

export class BillingAccessService {
  private readonly checkoutAvailable: boolean;

  constructor(
    private readonly prisma: PrismaClient,
    options: { checkoutAvailable?: boolean } = {},
  ) {
    this.checkoutAvailable = options.checkoutAvailable ?? true;
  }

  async grantInitialTrial(userId: string, now = new Date()): Promise<BillingAccessSummary> {
    await this.prisma.$transaction(async (tx) => {
      const [existing, referral] = await Promise.all([
        tx.billingAccount.findUnique({ where: { userId } }),
        tx.referralAttribution.findUnique({
          where: { referredUserId: userId },
          include: { professionalPartner: true },
        }),
      ]);

      const alreadyGranted = !!existing?.trialStartedAt || !!existing?.trialEndsAt;
      const validReferral = referral?.professionalPartner.verificationStatus === 'verified'
        && referral.professionalPartner.active;
      const requestedReferralDays = Number(referral?.benefitDays ?? REFERRED_TRIAL_DAYS);
      const referralDays = Number.isFinite(requestedReferralDays)
        ? Math.min(REFERRED_TRIAL_DAYS, Math.max(STANDARD_TRIAL_DAYS, Math.floor(requestedReferralDays)))
        : REFERRED_TRIAL_DAYS;
      const trialDays = validReferral ? referralDays : STANDARD_TRIAL_DAYS;
      const trialData = {
        trialStartedAt: now,
        trialEndsAt: new Date(now.getTime() + (trialDays * DAY_MS)),
        trialSource: validReferral ? 'professional_referral' : 'standard',
      };

      await tx.billingAccount.upsert({
        where: { userId },
        create: {
          userId,
          ...trialData,
        },
        update: alreadyGranted ? {} : trialData,
      });
    });

    return this.getSummary(userId, now);
  }

  async getSummary(userId: string, now = new Date()): Promise<BillingAccessSummary> {
    const [billing, professional] = await Promise.all([
      this.prisma.billingAccount.findUnique({ where: { userId } }),
      this.prisma.professionalPartner.findUnique({ where: { userId } }),
    ]);

    return resolveAccess({
      subscriptionStatus: billing?.subscriptionStatus,
      subscriptionPlan: billing?.subscriptionPlan,
      currentPeriodEnd: billing?.currentPeriodEnd,
      trialEndsAt: billing?.trialEndsAt,
      professionalVerified: professional?.verificationStatus === 'verified' && professional.active,
      checkoutAvailable: this.checkoutAvailable,
    }, now);
  }
}
