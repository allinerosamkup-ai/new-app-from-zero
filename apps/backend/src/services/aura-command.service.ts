import OpenAI from 'openai';

import {
  AuraCommandResponseSchema,
  type AuraCommandHistoryMessage,
  type AuraCommandResponse,
} from '../contracts/aura-command.contract';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';
import '../lib/load-env';

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
  private static readonly MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  static async interpretCommand(
    input: {
      message: string;
      history?: AuraCommandHistoryMessage[];
      userName?: string | null;
      profileSummary?: string | null;
      moodCycleContext?: string | null;
    },
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<AuraCommandResponse> {
    const historyBlock = (input.history ?? [])
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'Usuário' : 'Aura'}: ${message.content}`)
      .join('\n');

    const prompt = `Interprete o pedido operacional da pessoa e devolva uma resposta estruturada para a Aura.

PEDIDO ATUAL:
"${input.message}"

${historyBlock ? `HISTÓRICO RECENTE:\n${historyBlock}\n` : 'HISTÓRICO RECENTE: sem contexto anterior relevante.\n'}
INTENTS PERMITIDOS:
- planner_task
- checklist
- goal_project
- agenda_plan
- clarify
- reflective_handoff

ACTIONS PERMITIDAS:
- create_task
- create_checklist
- create_goal
- create_agenda
- ask_clarification
- handoff_to_journal

REGRAS:
- Se o pedido já estiver claro e executável, escolha a ação direta.
- Se houver vários passos implícitos, prefira checklist ou meta/projeto.
- Se a pessoa estiver pedindo processamento emocional ou desabafo, use reflective_handoff.
- Se faltar um dado crítico, use ask_clarification e faça apenas uma pergunta curta.
- assistantMessage deve ser curta, clara e em português do Brasil.
- payload deve conter apenas os campos úteis para a ação escolhida.
- Retorne APENAS JSON no formato:
{
  "assistantMessage": "string",
  "intent": "planner_task|checklist|goal_project|agenda_plan|clarify|reflective_handoff",
  "action": "create_task|create_checklist|create_goal|create_agenda|ask_clarification|handoff_to_journal",
  "payload": {},
  "needsClarification": true,
  "clarifyingQuestion": "string|null"
}`;

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
      response_format: { type: 'json_object' },
    } as any);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Falha ao interpretar o comando da Aura');
    }

    return AuraCommandResponseSchema.parse(JSON.parse(content));
  }
}
