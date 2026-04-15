import OpenAI from 'openai';

import {
  AuraCommandResponseSchema,
  type AuraCommandHistoryMessage,
  type AuraCommandResponse,
} from '../contracts/aura-command.contract';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';
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

    return AuraCommandResponseSchema.parse(JSON.parse(content));
  }
}
