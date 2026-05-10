import { z } from 'zod';
import { RiskSafetySchema } from './risk-safety.contract';

const LONG_TEXT_LIMIT = 30000;

export const AuraCommandRoleSchema = z.enum(['user', 'assistant']);

export const AuraCommandHistoryMessageSchema = z.object({
  role: AuraCommandRoleSchema,
  content: z.string().trim().min(1).max(LONG_TEXT_LIMIT),
});

export const AuraCommandIntentSchema = z.enum([
  'planner_task',
  'checklist',
  'goal_project',
  'agenda_plan',
  'clarify',
  'reflective_handoff',
  'reschedule',
  'delete_task',
]);

export const AuraCommandActionSchema = z.enum([
  'create_task',
  'create_checklist',
  'create_goal',
  'create_agenda',
  'ask_clarification',
  'handoff_to_journal',
  'update_task',
  'delete_task',
]);

export const AuraCommandPayloadSchema = z.object({}).catchall(z.unknown());

export const AuraCommandResponseSchema = z.object({
  assistantMessage: z.string().trim().min(1),
  intent: AuraCommandIntentSchema,
  action: AuraCommandActionSchema,
  payload: AuraCommandPayloadSchema.default({}),
  needsConfirmation: z.boolean().default(false),
  needsClarification: z.boolean().default(false),
  clarifyingQuestion: z.string().trim().min(1).nullable().default(null),
  riskSafety: RiskSafetySchema.optional(),
});

export const AuraCommandStartSchema = z.object({
  userId: z.string().uuid(),
  moodCycleContext: z.string().optional().nullable(),
});

export const AuraCommandMessageStreamSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(LONG_TEXT_LIMIT),
  history: z.array(AuraCommandHistoryMessageSchema).max(20).optional().default([]),
  moodCycleContext: z.string().optional().nullable(),
  mode: z.enum(['conversation', 'executor']).optional().default('executor'),
});

export type AuraCommandHistoryMessage = z.infer<typeof AuraCommandHistoryMessageSchema>;
export type AuraCommandIntent = z.infer<typeof AuraCommandIntentSchema>;
export type AuraCommandAction = z.infer<typeof AuraCommandActionSchema>;
export type AuraCommandResponse = z.infer<typeof AuraCommandResponseSchema>;
export type AuraCommandStartInput = z.infer<typeof AuraCommandStartSchema>;
export type AuraCommandMessageStreamInput = z.infer<typeof AuraCommandMessageStreamSchema>;
