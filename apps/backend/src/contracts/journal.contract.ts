import { z } from 'zod';

const LONG_TEXT_LIMIT = 30000;

export const JournalRoleSchema = z.enum(['user', 'assistant']);

export const JournalStartSchema = z.object({
  userId: z.string().uuid(),
  moodCycleContext: z.string().optional().nullable(),
});

export const JournalMessageStreamSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(LONG_TEXT_LIMIT),
  moodCycleContext: z.string().optional().nullable(),
});

export type JournalStartInput = z.infer<typeof JournalStartSchema>;
export type JournalMessageStreamInput = z.infer<typeof JournalMessageStreamSchema>;
