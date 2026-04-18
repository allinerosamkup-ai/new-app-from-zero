import OpenAI from 'openai';

import {
  AuraCommandActionSchema,
  AuraCommandIntentSchema,
  AuraCommandResponseSchema,
  type AuraCommandAction,
  type AuraCommandHistoryMessage,
  type AuraCommandIntent,
  type AuraCommandResponse,
} from '../contracts/aura-command.contract';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';
import { extractJsonValue } from '../lib/extract-json';
import { getOpenAiMaxCompletionTokens, getOpenAiModel } from '../lib/openai-config';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set in environment variables');
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as any)[prop];
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isValidIntent(value: unknown): value is AuraCommandIntent {
  return AuraCommandIntentSchema.safeParse(value).success;
}

function isValidAction(value: unknown): value is AuraCommandAction {
  return AuraCommandActionSchema.safeParse(value).success;
}

function inferIntentFromAction(action: AuraCommandAction | null): AuraCommandIntent | null {
  switch (action) {
    case 'create_task':
      return 'planner_task';
    case 'create_checklist':
      return 'checklist';
    case 'create_goal':
      return 'goal_project';
    case 'create_agenda':
      return 'agenda_plan';
    case 'ask_clarification':
      return 'clarify';
    case 'handoff_to_journal':
      return 'reflective_handoff';
    case 'update_task':
      return 'reschedule';
    case 'delete_task':
      return 'delete_task';
    default:
      return null;
  }
}

function inferActionFromIntent(intent: AuraCommandIntent | null): AuraCommandAction | null {
  switch (intent) {
    case 'planner_task':
      return 'create_task';
    case 'checklist':
      return 'create_checklist';
    case 'goal_project':
      return 'create_goal';
    case 'agenda_plan':
      return 'create_agenda';
    case 'clarify':
      return 'ask_clarification';
    case 'reflective_handoff':
      return 'handoff_to_journal';
    case 'reschedule':
      return 'update_task';
    case 'delete_task':
      return 'delete_task';
    default:
      return null;
  }
}

function inferActionFromPayload(payload: Record<string, unknown>): AuraCommandAction | null {
  if (Array.isArray(payload.blocks) || isRecord(payload.recurrence)) return 'create_agenda';
  if (asString(payload.taskId) && (asString(payload.newDate) || asString(payload.newStartTime))) return 'update_task';
  if (asString(payload.taskId)) return 'delete_task';
  if (asString(payload.date) || asString(payload.startTime) || asString(payload.time)) return 'create_task';
  if (Array.isArray(payload.items) || Array.isArray(payload.steps) || Array.isArray(payload.checklist)) return 'create_checklist';
  if (Array.isArray(payload.subgoals) || Array.isArray(payload.subtasks) || asString(payload.goalTitle)) return 'create_goal';
  return null;
}

function shouldTreatAsJournal(message: string): boolean {
  return /\b(desabafar|di[aá]rio|senti|sinto|sentindo|ansios|triste|raiva|medo|culpa|chorei|mexida)\b/i.test(message);
}

function buildPayloadFromRoot(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { blocks: value };
  }

  const root = asObject(value);
  const explicitPayload = asObject(root.payload);

  if (Object.keys(explicitPayload).length > 0) {
    return explicitPayload;
  }

  const payload: Record<string, unknown> = {};
  for (const key of ['title', 'date', 'startTime', 'time', 'category', 'blocks', 'items', 'steps', 'checklist', 'subgoals', 'subtasks', 'recurrence', 'taskId', 'newDate', 'newStartTime']) {
    if (key in root) {
      payload[key] = root[key];
    }
  }

  return payload;
}

export function parseAuraCommandResponse(content: string, originalMessage = ''): AuraCommandResponse {
  const parsed = extractJsonValue(content);
  const root = asObject(parsed);
  const payload = buildPayloadFromRoot(parsed);
  const rawAction = root.action;
  const rawIntent = root.intent;
  const payloadAction = inferActionFromPayload(payload);

  let action: AuraCommandAction | null = isValidAction(rawAction) ? rawAction : payloadAction;
  let intent: AuraCommandIntent | null = isValidIntent(rawIntent) ? rawIntent : inferIntentFromAction(action);

  if (!action && intent) {
    action = inferActionFromIntent(intent);
  }

  if (!action || !intent) {
    if (shouldTreatAsJournal(originalMessage)) {
      action = 'handoff_to_journal';
      intent = 'reflective_handoff';
    } else {
      action = 'ask_clarification';
      intent = 'clarify';
    }
  }

  const needsClarification = asBoolean(root.needsClarification, intent === 'clarify' || action === 'ask_clarification');
  const assistantMessage =
    asString(root.assistantMessage) ??
    asString(root.message) ??
    (needsClarification
      ? 'Recebi bastante coisa de uma vez. Posso transformar isso em tarefa, checklist, agenda ou só organizar a ideia?'
      : 'Recebi seu texto e já organizei a próxima ação.');

  const normalized = {
    assistantMessage,
    intent,
    action,
    payload,
    needsConfirmation: asBoolean(root.needsConfirmation, false),
    needsClarification,
    clarifyingQuestion:
      asString(root.clarifyingQuestion) ??
      (needsClarification ? 'Você quer que eu transforme isso em tarefa, checklist, agenda ou só organize a ideia?' : null),
  };

  return AuraCommandResponseSchema.parse(normalized);
}

export class AuraCommandService {
  private static readonly MODEL = getOpenAiModel();

  static async interpretCommand(
    input: {
      message: string;
      history?: AuraCommandHistoryMessage[];
      userName?: string | null;
      profileSummary?: string | null;
      moodCycleContext?: string | null;
      ragContext?: string | null;
      plannerContext?: string | null;
    },
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<AuraCommandResponse> {
    const historyBlock = (input.history ?? [])
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'Usuário' : 'Aura'}: ${message.content}`)
      .join('\n');

    const prompt = `Interprete o pedido operacional da pessoa e devolva uma resposta estruturada para a Airia.

PEDIDO ATUAL:
"${input.message}"

${historyBlock ? `HISTÓRICO RECENTE:\n${historyBlock}\n` : 'HISTÓRICO RECENTE: sem contexto anterior relevante.\n'}
${input.ragContext ? `MEMÓRIAS RELEVANTES:\n${input.ragContext}\n` : ''}
${input.plannerContext ? `${input.plannerContext}\n` : ''}
INTENTS PERMITIDOS:
- planner_task
- checklist
- goal_project
- agenda_plan
- clarify
- reflective_handoff
- reschedule (para mover/reagendar uma tarefa existente)
- delete_task (para remover uma tarefa existente)

ACTIONS PERMITIDAS:
- create_task
- create_checklist
- create_goal
- create_agenda
- ask_clarification
- handoff_to_journal
- update_task (para alterar horário, data ou título de tarefa existente)
- delete_task (para remover tarefa existente)

REGRAS GERAIS:
- Se o pedido já estiver claro e executável, escolha a ação direta.
- Se for compromisso/agendamento com data ou horário (ex: "amanhã", "quarta", "às 14h"), use create_task e marque "needsConfirmation": true.
- Se for uma sequência de tarefas para o dia (ex: "organize meu dia", "planeje minha manhã"), use create_agenda.
- Se o pedido for recorrente ou cobrir um intervalo de datas (ex: "3 vezes por semana em abril", "toda segunda", "de 01/04 até 30/04"), use create_agenda e marque "needsConfirmation": true.
- Para pedidos recorrentes, NUNCA invente dias/horários ausentes. Se faltar detalhe suficiente para transformar em datas reais, use ask_clarification.
- Se for tarefa simples ou meta clara (ex: "lembrar de beber água"), "needsConfirmation" deve ser false.
- Se houver vários passos implícitos, prefira create_checklist ou create_goal.
- assistantMessage deve ser curta. Se "needsConfirmation" for true, diga que a proposta está pronta para revisão e NUNCA diga que já salvou no planner.
- payload para create_task DEVE conter: { "title": string, "date": "YYYY-MM-DD", "startTime": "HH:MM", "category": string }.
- payload para create_agenda DEVE conter OU { "blocks": [ { "title": string, "date": "YYYY-MM-DD", "startTime": "HH:MM", "category": string } ] } OU { "title": string, "category": string, "recurrence": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "weekdays": ["seg","ter","qua","qui","sex","sab","dom"], "startTime": "HH:MM" } }.

REGRAS PARA TAREFAS EXISTENTES (update_task / delete_task):
- Quando o pedido mencionar mover, reagendar, adiar, cancelar ou excluir uma tarefa, consulte a lista "TAREFAS DE HOJE" fornecida acima.
- Identifique a tarefa pelo horário, título ou contexto. Se apenas uma tarefa corresponder, aja diretamente. Se houver ambiguidade, use ask_clarification listando as opções.
- Para update_task, payload DEVE conter: { "taskId": string, "newDate": "YYYY-MM-DD", "newStartTime": "HH:MM" }. O endTime é calculado automaticamente mantendo a duração original.
- Para delete_task, payload DEVE conter: { "taskId": string }.
- assistantMessage deve confirmar qual tarefa foi identificada e o que foi feito. Ex: "Encontrei 'Reunião com João' às 19:00. Remarcado para amanhã às 05:00."
- Retorne APENAS JSON.
`;

    const response = await client.chat.completions.create({
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: input.userName,
            profileSummary: input.profileSummary,
            moodCycleContext: input.moodCycleContext,
            domain: 'aura-command',
          }),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' } as any,
      max_completion_tokens: getOpenAiMaxCompletionTokens(1200),
    } as any);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Falha ao interpretar o comando da Airia');
    }

    return parseAuraCommandResponse(content, input.message);
  }
}
