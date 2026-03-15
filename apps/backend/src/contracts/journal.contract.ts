import { z } from 'zod';

export const JournalRoleSchema = z.enum(['user', 'assistant']);

export const JournalStartSchema = z.object({
  userId: z.string().uuid(),
});

export const JournalMessageStreamSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

export type JournalStartInput = z.infer<typeof JournalStartSchema>;
export type JournalMessageStreamInput = z.infer<typeof JournalMessageStreamSchema>;
