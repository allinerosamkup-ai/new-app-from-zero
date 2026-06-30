import { z } from 'zod';
import { RiskSafetySchema } from './risk-safety.contract';

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
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currentHour: z.number().int().min(0).max(23).optional(),
  currentMinute: z.number().int().min(0).max(59).optional(),
  phase: z.string().optional().nullable(),
  warningFlags: z.array(z.string()).optional(),
  forecast7dSummary: z.string().optional().nullable(),
  taskMomentum7d: z.number().optional().nullable(),
});

// Para integrações externas (sem SSE): registra uma mensagem no diário.
export const JournalExternalMessageSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(LONG_TEXT_LIMIT),
  // Opcional: força criar/retomar sessão com referência em uma data específica (YYYY-MM-DD).
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const JournalAssistantCompletedSchema = z.object({
  type: z.literal('assistant.completed'),
  message: z.string().trim().min(1),
  riskSafety: RiskSafetySchema,
}).catchall(z.unknown());

export type JournalStartInput = z.infer<typeof JournalStartSchema>;
export type JournalMessageStreamInput = z.infer<typeof JournalMessageStreamSchema>;
export type JournalExternalMessageInput = z.infer<typeof JournalExternalMessageSchema>;
export type JournalAssistantCompleted = z.infer<typeof JournalAssistantCompletedSchema>;
