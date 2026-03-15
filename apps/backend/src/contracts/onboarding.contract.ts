import { z } from 'zod';

export const OnboardingProcessSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  age: z.number().int().min(13).max(120).nullable(),
  currentFeeling: z.string().trim().min(2).max(1000),
  sleepQualityNote: z.string().trim().min(2).max(1000),
  wakeTime: z.string().trim().min(1).max(10),
  sleepTime: z.string().trim().min(1).max(10),
  routineText: z.string().trim().min(2).max(2000),
  mainEnergyPressure: z.string().trim().min(2).max(2000),
  primaryGoal: z.string().trim().min(2).max(1000),
  supportGoals: z.array(z.string().trim().min(1)).max(6).default([]),
});

export type OnboardingProcessInput = z.infer<typeof OnboardingProcessSchema>;
