import { z } from 'zod';
import { RiskSafetySchema } from './risk-safety.contract';

const LONG_TEXT_LIMIT = 30000;

export const AuraCommandRoleSchema = z.enum(['user', 'assistant']);

export const AuraCommandHistoryMessageSchema = z.object({
  role: AuraCommandRoleSchema,
  content: z.string().trim().min(1).max(LONG_TEXT_LIMIT),
});

export const AuraCommandIntentSchema = z.enum([
  'conversation',
  'planner_task',
  'checklist',
  'goal_project',
  'agenda_plan',
  'routine_builder',
  'clarify',
  'reflective_handoff',
  'reschedule',
  'delete_task',
  'complete_items',
  // A Airia é o centro de comando: o que dá para fazer numa tela do app tem que
  // dar para pedir falando com ela.
  'capture',
  'checkin',
  'habit',
  'calendar_event',
  'postpone',
  'start_task',
  'adapt_agenda',
  'navigate',
]);

export const AuraCommandActionSchema = z.enum([
  'respond',
  'create_task',
  'create_checklist',
  'create_goal',
  'create_agenda',
  'ask_clarification',
  'handoff_to_journal',
  'update_task',
  'delete_task',
  'complete_items',
  /** Registra humor, energia, foco e sono a partir do que a pessoa contou. */
  'log_checkin',
  'create_checkin',
  'record_checkin',
  'create_capture',
  'create_calendar_event',
  'create_habit',
  /** Empurra um bloco existente para outro dia. */
  'postpone_task',
  /** Marca que começou agora — é o gatilho do motor de execução. */
  'start_task',
  /** Roda a adaptação da agenda do dia. */
  'adapt_agenda',
  /** Leva a pessoa para a tela certa quando ela pede para ver algo. */
  'open_screen',
]);

export const AuraCommandPayloadSchema = z.object({}).catchall(z.unknown());

/**
 * Uma ação executável. A Airia é um agente: uma fala pode conter mais de uma
 * coisa a fazer ("marquei consulta quinta e já lavei a louça" são duas), e
 * obrigar a escolher uma faria a outra ser perdida.
 */
export const AuraCommandStepSchema = z.object({
  action: AuraCommandActionSchema,
  payload: AuraCommandPayloadSchema.default({}),
});

export const AuraCommandResponseSchema = z.object({
  assistantMessage: z.string().trim().min(1),
  intent: AuraCommandIntentSchema,
  action: AuraCommandActionSchema,
  payload: AuraCommandPayloadSchema.default({}),
  /** Ações adicionais da mesma fala. A primeira continua em `action`/`payload`
   *  para quem só sabe ler uma — cliente antigo não quebra. */
  actions: z.array(AuraCommandStepSchema).max(8).optional(),
  needsConfirmation: z.boolean().default(false),
  needsClarification: z.boolean().default(false),
  clarifyingQuestion: z.string().trim().min(1).nullable().default(null),
  riskSafety: RiskSafetySchema.optional(),
});

export const AuraCommandStartSchema = z.object({
  userId: z.string().uuid(),
  moodCycleContext: z.string().optional().nullable(),
  locale: z.string().trim().min(2).max(20).optional().default('pt-BR'),
  timezone: z.string().trim().min(1).max(100).optional().default('America/Sao_Paulo'),
});

export const AuraCommandMessageStreamSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(LONG_TEXT_LIMIT),
  history: z.array(AuraCommandHistoryMessageSchema).max(20).optional().default([]),
  moodCycleContext: z.string().optional().nullable(),
  mode: z.enum(['conversation', 'executor']).optional().default('executor'),
  locale: z.string().trim().min(2).max(20).optional().default('pt-BR'),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export type AuraCommandHistoryMessage = z.infer<typeof AuraCommandHistoryMessageSchema>;
export type AuraCommandIntent = z.infer<typeof AuraCommandIntentSchema>;
export type AuraCommandAction = z.infer<typeof AuraCommandActionSchema>;
export type AuraCommandStep = z.infer<typeof AuraCommandStepSchema>;
export type AuraCommandResponse = z.infer<typeof AuraCommandResponseSchema>;
export type AuraCommandStartInput = z.infer<typeof AuraCommandStartSchema>;
export type AuraCommandMessageStreamInput = z.infer<typeof AuraCommandMessageStreamSchema>;
