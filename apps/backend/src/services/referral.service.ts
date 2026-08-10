import type { PrismaClient } from '@app/database';

import { ReferralClaimSchema } from '../contracts/professional-partner.contract';

export type ReferralSummary = {
  code: string;
  benefitDays: number;
  benefitApplied: boolean;
  professional: { professionalName: string };
};

export class ReferralService {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(userId: string, rawCode: string): Promise<ReferralSummary> {
    const { code } = ReferralClaimSchema.parse({ code: rawCode });

    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.professionalPartner.findUnique({ where: { referralCode: code } });
      if (!partner || partner.verificationStatus !== 'verified' || !partner.active) {
        throw new Error('referral_invalid_or_inactive');
      }
      if (partner.userId === userId) throw new Error('referral_self_claim');

      const existing = await tx.referralAttribution.findUnique({ where: { referredUserId: userId } });
      if (existing) {
        if (existing.referralCode !== code) throw new Error('referral_already_claimed');
        const billing = await tx.billingAccount.findUnique({ where: { userId } });
        return this.summary(partner.professionalName, code, !billing?.trialStartedAt && !billing?.trialEndsAt);
      }

      const billing = await tx.billingAccount.findUnique({ where: { userId } });
      const benefitApplied = !billing?.trialStartedAt && !billing?.trialEndsAt;
      await tx.referralAttribution.create({
        data: {
          referredUserId: userId,
          professionalPartnerId: partner.id,
          referralCode: code,
          benefitDays: 14,
        },
      });
      return this.summary(partner.professionalName, code, benefitApplied);
    });
  }

  async getMine(userId: string): Promise<ReferralSummary | null> {
    const attribution = await this.prisma.referralAttribution.findUnique({
      where: { referredUserId: userId },
      include: { professionalPartner: true },
    });
    if (!attribution || attribution.professionalPartner.verificationStatus !== 'verified') return null;
    const billing = await this.prisma.billingAccount.findUnique({ where: { userId } });
    return this.summary(
      attribution.professionalPartner.professionalName,
      attribution.referralCode,
      billing?.trialSource === 'professional_referral',
    );
  }

  private summary(professionalName: string, code: string, benefitApplied: boolean): ReferralSummary {
    return {
      code,
      benefitDays: 14,
      benefitApplied,
      professional: { professionalName },
    };
  }
}
