import { z } from 'zod';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const ProfessionalApplicationSchema = z.object({
  professionalName: z.string().trim().min(3).max(120),
  crpRegion: z.string().transform(digitsOnly).pipe(z.string().regex(/^\d{2}$/)),
  crpNumber: z.string().transform(digitsOnly).pipe(z.string().regex(/^\d{4,8}$/)),
});

export const ProfessionalVerificationSchema = z.object({
  status: z.enum(['verified', 'rejected', 'review_required']),
  note: z.string().trim().max(240).nullable().optional().default(null),
});

export const ReferralClaimSchema = z.object({
  code: z.string()
    .trim()
    .toUpperCase()
    .regex(/^AIRIA-[A-Z0-9]{6,20}$/),
});

export type ProfessionalApplication = z.infer<typeof ProfessionalApplicationSchema>;
export type ProfessionalVerification = z.infer<typeof ProfessionalVerificationSchema>;
