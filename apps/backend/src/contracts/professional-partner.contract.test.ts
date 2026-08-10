import assert from 'node:assert/strict';

import {
  ProfessionalApplicationSchema,
  ProfessionalVerificationSchema,
  ReferralClaimSchema,
} from './professional-partner.contract';

const application = ProfessionalApplicationSchema.parse({
  professionalName: '  Dra. Ana Lima  ',
  crpRegion: 'CRP 06',
  crpNumber: '123.456',
});
assert.deepEqual(application, {
  professionalName: 'Dra. Ana Lima',
  crpRegion: '06',
  crpNumber: '123456',
});
assert.equal(ProfessionalApplicationSchema.safeParse({
  professionalName: 'Ana',
  crpRegion: '6',
  crpNumber: '123',
}).success, false);
assert.deepEqual(ReferralClaimSchema.parse({ code: ' airia-ab12cd ' }), { code: 'AIRIA-AB12CD' });
assert.equal(ReferralClaimSchema.safeParse({ code: 'x' }).success, false);
assert.deepEqual(ProfessionalVerificationSchema.parse({
  status: 'rejected',
  note: '  Inscrição não localizada.  ',
}), {
  status: 'rejected',
  note: 'Inscrição não localizada.',
});

console.log('professional-partner.contract tests passed');
