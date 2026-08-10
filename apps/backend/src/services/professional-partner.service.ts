import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@app/database';

import type {
  ProfessionalApplication,
  ProfessionalVerification,
} from '../contracts/professional-partner.contract';

const MAX_CODE_ATTEMPTS = 8;

function defaultReferralCode(): string {
  return `AIRIA-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export class ProfessionalPartnerService {
  private readonly generateReferralCode: () => string;

  constructor(
    private readonly prisma: PrismaClient,
    options: { generateReferralCode?: () => string } = {},
  ) {
    this.generateReferralCode = options.generateReferralCode ?? defaultReferralCode;
  }

  private async uniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const candidate = this.generateReferralCode().trim().toUpperCase();
      const collision = await this.prisma.professionalPartner.findUnique({
        where: { referralCode: candidate },
        select: { id: true },
      });
      if (!collision) return candidate;
    }
    throw new Error('professional_referral_code_unavailable');
  }

  async apply(userId: string, input: ProfessionalApplication) {
    const duplicate = await this.prisma.professionalPartner.findFirst({
      where: {
        crpRegion: input.crpRegion,
        crpNumber: input.crpNumber,
        userId: { not: userId },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error('professional_crp_already_registered');

    const existing = await this.prisma.professionalPartner.findUnique({ where: { userId } });
    if (existing) {
      const identityChanged = existing.crpRegion !== input.crpRegion || existing.crpNumber !== input.crpNumber;
      return this.prisma.professionalPartner.update({
        where: { id: existing.id },
        data: {
          professionalName: input.professionalName,
          crpRegion: input.crpRegion,
          crpNumber: input.crpNumber,
          ...(identityChanged ? {
            verificationStatus: 'pending',
            verificationNote: null,
            verifiedAt: null,
            active: true,
          } : {}),
        },
      });
    }

    return this.prisma.professionalPartner.create({
      data: {
        userId,
        professionalName: input.professionalName,
        crpRegion: input.crpRegion,
        crpNumber: input.crpNumber,
        verificationStatus: 'pending',
        referralCode: await this.uniqueReferralCode(),
        active: true,
      },
    });
  }

  async getMe(userId: string) {
    return this.prisma.professionalPartner.findUnique({ where: { userId } });
  }

  async verify(partnerId: string, input: ProfessionalVerification, now = new Date()) {
    return this.prisma.professionalPartner.update({
      where: { id: partnerId },
      data: {
        verificationStatus: input.status,
        verificationNote: input.note,
        lastVerifiedAt: now,
        ...(input.status === 'verified' ? { verifiedAt: now, active: true } : {}),
        ...(input.status === 'rejected' ? { active: false } : {}),
      },
    });
  }
}
