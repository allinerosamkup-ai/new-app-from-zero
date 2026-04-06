import { z } from 'zod';

export const AuraCommandRoleSchema = z.enum(['user', 'assistant']);

export const AuraCommandHistoryMessageSchema = z.object({
  role: AuraCommandRoleSchema,
  content: z.string().trim().min(1).max(4000),
});

export const AuraCommandIntentSchema = z.enum([
  'planner_task',
  'checklist',
  'goal_project',
  'agenda_plan',
  'clarify',
  'reflective_handoff',
]);

export const AuraCommandActionSchema = z.enum([
  'create_task',
  'create_checklist',
  'create_goal',
  'create_agenda',
  'ask_clarification',
  'handoff_to_journal',
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
});

export const AuraCommandStartSchema = z.object({
  userId: z.string().uuid(),
  moodCycleContext: z.string().optional().nullable(),
});

export const AuraCommandMessageStreamSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  history: z.array(AuraCommandHistoryMessageSchema).max(20).optional().default([]),
  moodCycleContext: z.string().optional().nullable(),
});

export type AuraCommandHistoryMessage = z.infer<typeof AuraCommandHistoryMessageSchema>;
export type AuraCommandIntent = z.infer<typeof AuraCommandIntentSchema>;
export type AuraCommandAction = z.infer<typeof AuraCommandActionSchema>;
export type AuraCommandResponse = z.infer<typeof AuraCommandResponseSchema>;
export type AuraCommandStartInput = z.infer<typeof AuraCommandStartSchema>;
export type AuraCommandMessageStreamInput = z.infer<typeof AuraCommandMessageStreamSchema>;
