import { z } from 'zod';

export const OnboardingAiOutputSchema = z.object({
  profileSummary: z.string().min(20),
  routineSummaryNormalized: z.string().min(20),
  initialStateSummary: z.string().min(20),
  topThemes: z.array(z.string().min(2)).min(2).max(5),
  initialSuggestions: z.array(z.string().min(5)).min(3).max(5),
});

export type OnboardingAiOutput = z.infer<typeof OnboardingAiOutputSchema>;
