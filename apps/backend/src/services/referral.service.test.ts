import assert from 'node:assert/strict';

import { ReferralService } from './referral.service';

function createFixture() {
  const partners = [
    { id: 'verified', userId: 'professional-user', professionalName: 'Dra. Ana', referralCode: 'AIRIA-VALID1', verificationStatus: 'verified', active: true, crpNumber: 'private' },
    { id: 'pending', userId: 'pending-user', professionalName: 'Dra. Bia', referralCode: 'AIRIA-PEND01', verificationStatus: 'pending', active: true },
    { id: 'inactive', userId: 'inactive-user', professionalName: 'Dra. Lia', referralCode: 'AIRIA-INACT1', verificationStatus: 'verified', active: false },
    { id: 'second', userId: 'second-user', professionalName: 'Dra. Eva', referralCode: 'AIRIA-SECOND', verificationStatus: 'verified', active: true },
  ];
  const referrals = new Map<string, any>();
  const billing = new Map<string, any>();
  const client: any = {
    professionalPartner: {
      findUnique: async ({ where }: any) => partners.find((row) => row.referralCode === where.referralCode) ?? null,
    },
    referralAttribution: {
      findUnique: async ({ where }: any) => referrals.get(where.referredUserId) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `referral-${referrals.size + 1}`, claimedAt: new Date(), ...data };
        referrals.set(data.referredUserId, row);
        return row;
      },
    },
    billingAccount: {
      findUnique: async ({ where }: any) => billing.get(where.userId) ?? null,
    },
  };
  client.$transaction = async (work: (tx: any) => Promise<unknown>) => work(client);
  return { client, referrals, billing };
}

async function run() {
  const fixture = createFixture();
  const service = new ReferralService(fixture.client);

  const claimed = await service.claim('new-user', ' airia-valid1 ');
  assert.deepEqual(claimed, {
    code: 'AIRIA-VALID1',
    benefitDays: 14,
    benefitApplied: true,
    professional: { professionalName: 'Dra. Ana' },
  });
  assert.equal('crpNumber' in claimed.professional, false, 'private CRP fields must not be exposed');

  await assert.rejects(() => service.claim('professional-user', 'AIRIA-VALID1'), /referral_self_claim/);
  await assert.rejects(() => service.claim('other-user', 'AIRIA-PEND01'), /referral_invalid_or_inactive/);
  await assert.rejects(() => service.claim('other-user', 'AIRIA-INACT1'), /referral_invalid_or_inactive/);
  await assert.rejects(() => service.claim('other-user', 'AIRIA-MISSING'), /referral_invalid_or_inactive/);

  const same = await service.claim('new-user', 'AIRIA-VALID1');
  assert.equal(same.code, 'AIRIA-VALID1', 'repeating the same claim is idempotent');
  await assert.rejects(() => service.claim('new-user', 'AIRIA-SECOND'), /referral_already_claimed/);

  const expiredEnd = new Date('2026-08-01T00:00:00.000Z');
  fixture.billing.set('trial-user', {
    trialStartedAt: new Date('2026-07-25T00:00:00.000Z'),
    trialEndsAt: expiredEnd,
  });
  const lateClaim = await service.claim('trial-user', 'AIRIA-VALID1');
  assert.equal(lateClaim.benefitApplied, false);
  assert.equal(fixture.billing.get('trial-user').trialEndsAt, expiredEnd, 'claiming later must not restart or extend a trial');
}

run().then(() => console.log('referral.service tests passed'));
