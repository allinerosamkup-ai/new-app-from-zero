import { z } from 'zod';

export const RiskSafetySchema = z.object({
  riskLevel: z.enum(['none', 'low', 'moderate', 'high', 'crisis']),
  signals: z.array(z.string()).default([]),
  route: z.enum(['self_support', 'adapt_day', 'human_support', 'crisis_protocol']),
  message: z.string(),
});

export type RiskSafetyContract = z.infer<typeof RiskSafetySchema>;
