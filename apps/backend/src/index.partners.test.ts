import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const FORGED_ID = '00000000-0000-0000-0000-000000000999';

async function run() {
  const previousAdminSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'partner-admin-test';
  const applications: any[] = [];
  const claims: any[] = [];
  const verifications: any[] = [];
  const partnerRow = {
    id: 'partner-1',
    userId: USER_ID,
    professionalName: 'Dra. Ana',
    crpRegion: '06',
    crpNumber: '123456',
    verificationStatus: 'pending',
    verificationNote: null,
    referralCode: 'AIRIA-PRIVATE1',
    active: true,
    verifiedAt: null,
    lastVerifiedAt: null,
  };
  const professionalPartnerService = {
    apply: async (userId: string, input: any) => {
      applications.push({ userId, input });
      return partnerRow;
    },
    getMe: async () => partnerRow,
    verify: async (partnerId: string, input: any) => {
      verifications.push({ partnerId, input });
      return {
        ...partnerRow,
        verificationStatus: input.status,
        verificationNote: input.note,
        referralCode: 'AIRIA-PRIVATE1',
        verifiedAt: new Date('2026-08-10T16:00:00.000Z'),
        lastVerifiedAt: new Date('2026-08-10T16:00:00.000Z'),
      };
    },
  };
  const referralSummary = {
    code: 'AIRIA-VALID1',
    benefitDays: 14,
    benefitApplied: true,
    professional: { professionalName: 'Dra. Ana' },
  };
  const referralService = {
    claim: async (userId: string, code: string) => {
      claims.push({ userId, code });
      return referralSummary;
    },
    getMine: async () => referralSummary,
  };

  const app = createApp({
    prisma: { $queryRaw: async () => [], $executeRaw: async () => ({}) } as any,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = USER_ID;
      next();
    },
    professionalPartnerService: professionalPartnerService as any,
    referralService: referralService as any,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to open test server');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const applyResponse = await fetch(`${baseUrl}/api/professional-partners/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: FORGED_ID,
        professionalName: ' Dra. Ana ',
        crpRegion: 'CRP 06',
        crpNumber: '123.456',
      }),
    });
    assert.equal(applyResponse.status, 201);
    assert.deepEqual(applications[0], {
      userId: USER_ID,
      input: { professionalName: 'Dra. Ana', crpRegion: '06', crpNumber: '123456' },
    });
    const applyBody = await applyResponse.json();
    assert.equal(applyBody.partner.referralCode, null, 'pending applications cannot distribute a code');

    const meResponse = await fetch(`${baseUrl}/api/professional-partners/me`);
    assert.equal(meResponse.status, 200);
    const meBody = await meResponse.json();
    assert.equal(meBody.partner.verificationStatus, 'pending');
    assert.equal(meBody.partner.referralCode, null);
    assert.equal('referrals' in meBody.partner, false);

    const claimResponse = await fetch(`${baseUrl}/api/referrals/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: FORGED_ID, code: 'airia-valid1' }),
    });
    assert.equal(claimResponse.status, 200);
    assert.deepEqual(claims[0], { userId: USER_ID, code: 'AIRIA-VALID1' });
    const referralMe = await (await fetch(`${baseUrl}/api/referrals/me`)).json();
    assert.deepEqual(referralMe.referral, referralSummary);
    assert.equal(JSON.stringify(referralMe).includes('crpNumber'), false);

    const noAdmin = await fetch(`${baseUrl}/api/admin/professional-partners/partner-1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    });
    assert.equal(noAdmin.status, 401);
    const wrongAdmin = await fetch(`${baseUrl}/api/admin/professional-partners/partner-1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'wrong' },
      body: JSON.stringify({ status: 'verified' }),
    });
    assert.equal(wrongAdmin.status, 401);
    assert.equal(verifications.length, 0);

    const approved = await fetch(`${baseUrl}/api/admin/professional-partners/partner-1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'partner-admin-test' },
      body: JSON.stringify({ status: 'verified' }),
    });
    assert.equal(approved.status, 200);
    assert.deepEqual(verifications[0], {
      partnerId: 'partner-1',
      input: { status: 'verified', note: null },
    });
    const approvedBody = await approved.json();
    assert.equal(approvedBody.partner.referralCode, 'AIRIA-PRIVATE1');
    assert.ok(approvedBody.partner.verifiedAt);
    assert.ok(approvedBody.partner.lastVerifiedAt);

    const forbiddenPatientList = await fetch(`${baseUrl}/api/professional-partners/referrals`);
    assert.equal(forbiddenPatientList.status, 404, 'no route may expose a referred-user list');
  } finally {
    process.env.ADMIN_SECRET = previousAdminSecret;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

run()
  .then(() => console.log('index.partners tests passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
