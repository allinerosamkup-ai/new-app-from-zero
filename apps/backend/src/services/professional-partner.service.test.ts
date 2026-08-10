import assert from 'node:assert/strict';

import { ProfessionalPartnerService } from './professional-partner.service';

async function run() {
  const rows: any[] = [{
    id: 'collision',
    userId: 'someone-else',
    professionalName: 'Outra',
    crpRegion: '01',
    crpNumber: '9999',
    referralCode: 'AIRIA-COLLIDE',
    verificationStatus: 'verified',
    active: true,
  }];
  const prisma: any = {
    professionalPartner: {
      findUnique: async ({ where }: any) => {
        if (where.userId) return rows.find((row) => row.userId === where.userId) ?? null;
        if (where.referralCode) return rows.find((row) => row.referralCode === where.referralCode) ?? null;
        return null;
      },
      findFirst: async ({ where }: any) => rows.find((row) => (
        row.crpRegion === where.crpRegion
        && row.crpNumber === where.crpNumber
        && row.userId !== where.userId?.not
      )) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `partner-${rows.length}`, ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
  const generated = ['AIRIA-COLLIDE', 'AIRIA-UNIQUE'];
  const service = new ProfessionalPartnerService(prisma, {
    generateReferralCode: () => generated.shift() ?? 'AIRIA-FALLBACK',
  });

  const created = await service.apply('professional-user', {
    professionalName: 'Dra. Ana Lima',
    crpRegion: '06',
    crpNumber: '123456',
  });
  assert.equal(created.referralCode, 'AIRIA-UNIQUE', 'codes must retry collisions');
  assert.equal(created.verificationStatus, 'pending');
  assert.equal(created.active, true);

  await assert.rejects(
    () => service.apply('another-user', {
      professionalName: 'Nome Duplicado',
      crpRegion: '06',
      crpNumber: '123456',
    }),
    /professional_crp_already_registered/,
  );

  const verifiedAt = new Date('2026-08-10T15:00:00.000Z');
  const verified = await service.verify(created.id, { status: 'verified', note: null }, verifiedAt);
  assert.equal(verified.verificationStatus, 'verified');
  assert.equal(verified.verifiedAt?.toISOString(), verifiedAt.toISOString());
  assert.equal(verified.lastVerifiedAt?.toISOString(), verifiedAt.toISOString());

  const rejectedAt = new Date('2026-08-11T15:00:00.000Z');
  const rejected = await service.verify(created.id, {
    status: 'rejected',
    note: 'Inscrição não localizada.',
  }, rejectedAt);
  assert.equal(rejected.verificationStatus, 'rejected');
  assert.equal(rejected.verificationNote, 'Inscrição não localizada.');
  assert.equal(rejected.lastVerifiedAt?.toISOString(), rejectedAt.toISOString());
}

run().then(() => console.log('professional-partner.service tests passed'));
