import assert from 'node:assert/strict';

import { BillingAccessService, resolveAccess } from './billing-access.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-10T12:00:00.000Z');

type BillingRow = {
  userId: string;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  currentPeriodEnd: Date | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialSource: string | null;
};

function createPrismaMock(options: {
  billing?: BillingRow[];
  referrals?: Record<string, { benefitDays: number; verified: boolean; active: boolean }>;
  professionals?: Record<string, { verified: boolean; active: boolean }>;
} = {}) {
  const billing = new Map((options.billing ?? []).map((row) => [row.userId, row]));

  const client: any = {
    billingAccount: {
      findUnique: async ({ where }: any) => billing.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const current = billing.get(where.userId);
        if (current) {
          const next = { ...current, ...update };
          billing.set(where.userId, next);
          return next;
        }
        const next: BillingRow = {
          subscriptionStatus: null,
          subscriptionPlan: null,
          currentPeriodEnd: null,
          trialStartedAt: null,
          trialEndsAt: null,
          trialSource: null,
          ...create,
        };
        billing.set(where.userId, next);
        return next;
      },
    },
    referralAttribution: {
      findUnique: async ({ where }: any) => {
        const referral = options.referrals?.[where.referredUserId];
        if (!referral) return null;
        return {
          benefitDays: referral.benefitDays,
          professionalPartner: {
            verificationStatus: referral.verified ? 'verified' : 'pending',
            active: referral.active,
          },
        };
      },
    },
    professionalPartner: {
      findUnique: async ({ where }: any) => {
        const professional = options.professionals?.[where.userId];
        if (!professional) return null;
        return {
          verificationStatus: professional.verified ? 'verified' : 'pending',
          active: professional.active,
        };
      },
    },
  };
  client.$transaction = async (work: (tx: any) => Promise<unknown>) => work(client);

  return { client, billing };
}

async function run() {
  assert.equal(resolveAccess({ subscriptionStatus: 'active' }, NOW).source, 'paid');
  assert.equal(
    resolveAccess({ subscriptionStatus: 'active', subscriptionPlan: 'lifetime' }, NOW).plan,
    'lifetime',
  );
  assert.equal(resolveAccess({ professionalVerified: true }, NOW).source, 'professional');
  assert.equal(resolveAccess({ trialEndsAt: new Date(NOW.getTime() + DAY_MS) }, NOW).source, 'trial');
  assert.equal(resolveAccess({ trialEndsAt: new Date(NOW.getTime() - DAY_MS) }, NOW).source, 'free');
  assert.equal(
    resolveAccess({ subscriptionStatus: 'past_due', trialEndsAt: new Date(NOW.getTime() - DAY_MS) }, NOW).access,
    'free',
  );
  const canceledPaidPeriod = resolveAccess({
    subscriptionStatus: 'canceled',
    subscriptionPlan: 'monthly',
    currentPeriodEnd: new Date(NOW.getTime() + DAY_MS),
  }, NOW);
  assert.equal(canceledPaidPeriod.source, 'paid', 'canceled renewal keeps access through the paid period');
  assert.equal(resolveAccess({
    subscriptionStatus: 'canceled', currentPeriodEnd: new Date(NOW.getTime() - DAY_MS),
  }, NOW).source, 'free');
  assert.equal(resolveAccess({ subscriptionStatus: 'active', subscriptionPlan: 'lifetime' }, NOW).source, 'paid');

  const standard = createPrismaMock();
  const standardService = new BillingAccessService(standard.client);
  const first = await standardService.grantInitialTrial('standard-user', NOW);
  assert.equal(first.source, 'trial');
  assert.equal(first.daysRemaining, 7);
  assert.equal(first.trialEndsAt, new Date(NOW.getTime() + (7 * DAY_MS)).toISOString());

  const repeated = await standardService.grantInitialTrial(
    'standard-user',
    new Date(NOW.getTime() + (2 * DAY_MS)),
  );
  assert.equal(repeated.trialEndsAt, first.trialEndsAt, 'redo must preserve the original trial end');
  assert.equal(standard.billing.get('standard-user')?.trialStartedAt?.toISOString(), NOW.toISOString());

  const referred = createPrismaMock({
    referrals: {
      'referred-user': { benefitDays: 14, verified: true, active: true },
      'pending-referral': { benefitDays: 14, verified: false, active: true },
    },
  });
  const referredService = new BillingAccessService(referred.client);
  const referredSummary = await referredService.grantInitialTrial('referred-user', NOW);
  assert.equal(referredSummary.daysRemaining, 14);
  assert.equal(referred.billing.get('referred-user')?.trialSource, 'professional_referral');
  const pendingSummary = await referredService.grantInitialTrial('pending-referral', NOW);
  assert.equal(pendingSummary.daysRemaining, 7, 'an unverified CRP cannot grant the extended benefit');

  const expiredStart = new Date(NOW.getTime() - (20 * DAY_MS));
  const expiredEnd = new Date(NOW.getTime() - (13 * DAY_MS));
  const expired = createPrismaMock({
    billing: [{
      userId: 'expired-user',
      subscriptionStatus: null,
      subscriptionPlan: null,
      currentPeriodEnd: null,
      trialStartedAt: expiredStart,
      trialEndsAt: expiredEnd,
      trialSource: 'standard',
    }],
  });
  const expiredSummary = await new BillingAccessService(expired.client).grantInitialTrial('expired-user', NOW);
  assert.equal(expiredSummary.source, 'free');
  assert.equal(expired.billing.get('expired-user')?.trialEndsAt?.toISOString(), expiredEnd.toISOString());

  const privileged = createPrismaMock({
    billing: [{
      userId: 'paid-user',
      subscriptionStatus: 'active',
      subscriptionPlan: 'annual',
      currentPeriodEnd: new Date(NOW.getTime() + (300 * DAY_MS)),
      trialStartedAt: null,
      trialEndsAt: null,
      trialSource: null,
    }],
    professionals: {
      'professional-user': { verified: true, active: true },
    },
  });
  const privilegedService = new BillingAccessService(privileged.client, { checkoutAvailable: false });
  const paid = await privilegedService.grantInitialTrial('paid-user', NOW);
  assert.equal(paid.source, 'paid');
  assert.equal(paid.plan, 'annual');
  assert.equal(paid.checkoutAvailable, false);
  const professional = await privilegedService.grantInitialTrial('professional-user', NOW);
  assert.equal(professional.source, 'professional');
  assert.equal(professional.access, 'pro');
}

run().then(() => {
  console.log('billing-access.service tests passed');
});
