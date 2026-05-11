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

export type AgendaCommand = {
  type: 'reschedule' | 'shrink' | 'pause' | 'summarize';
  targetTitle: string;
  targetTime?: string | null;
  reason: string;
};

function extractAgendaCommand(parsed: unknown): AgendaCommand | null {
  if (!isRecord(parsed)) return null;
  const raw = parsed.agendaCommand;
  if (!isRecord(raw)) return null;
  const type = asString(raw.type);
  const targetTitle = asString(raw.targetTitle);
  const reason = asString(raw.reason);
  if (!type || !targetTitle || !reason) return null;
  if (!['reschedule', 'shrink', 'pause', 'summarize'].includes(type)) return null;
  return {
    type: type as AgendaCommand['type'],
    targetTitle,
    targetTime: asString(raw.targetTime),
    reason,
  };
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

export type AuraCommandResponseWithAgenda = AuraCommandResponse & {
  agendaCommand?: AgendaCommand | null;
};

export class AuraCommandService {
  private static readonly MODEL = getOpenAiModel();

  static async interpretCommand(
    input: {
      message: string;
      history?: AuraCommandHistoryMessage[];
      userName?: string | null;
      profileSummary?: string | null;
      moodCycleContext?: string | null;
      recentSuggestionMemory?: string | null;
      activeGoalsContext?: string | null;
      ragContext?: string | null;
      plannerContext?: string | null;
      reasoningTraceContext?: string | null;
      dayPlanContext?: string | null;
      priorDiagnoses?: string[] | null;
      interactionMode?: 'conversation' | 'executor';
      currentHour?: number;
      currentMinute?: number;
      phase?: string | null;
      warningFlags?: string[] | null;
      forecast7dSummary?: string | null;
      taskMomentum7d?: number | null;
    },
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<AuraCommandResponseWithAgenda> {
    const interactionMode = input.interactionMode === 'conversation' ? 'conversation' : 'executor';
    const isPlannerConversation = interactionMode === 'conversation' && (
      /bot[aã]o\s+CONVERSAR/i.test(input.message) ||
      /tarefa\/meta/i.test(input.message) ||
      /pr[oó]xima a[cç][aã]o da meta/i.test(input.message) ||
      /entender melhor esta/i.test(input.message)
    );
    const historyBlock = (input.history ?? [])
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'Usuário' : 'Aura'}: ${message.content}`)
      .join('\n');

    const prompt = `Interprete o pedido operacional da pessoa e devolva uma resposta estruturada para a Airia.

PEDIDO ATUAL:
"${input.message}"

${historyBlock ? `HISTÓRICO RECENTE:\n${historyBlock}\n` : 'HISTÓRICO RECENTE: sem contexto anterior relevante.\n'}
${input.ragContext ? `MEMÓRIAS RELEVANTES:\n${input.ragContext}\n` : ''}
${input.recentSuggestionMemory ? `${input.recentSuggestionMemory}\n` : ''}
${input.plannerContext ? `${input.plannerContext}\n` : ''}
MODO DA INTERAÇÃO:
${interactionMode === 'conversation'
  ? isPlannerConversation
    ? 'CONVERSAR SOBRE META/PLANNER: a pessoa veio do botão CONVERSAR para entender uma tarefa, meta ou próxima ação. Explique em linguagem natural o sentido da ação, por que ela ajuda, como fazer na prática e dê ideias simples. Não faça triagem, não peça categoria e não devolva pergunta antes de explicar.'
    : 'CONVERSA ESTRATÉGICA: a pessoa quer pensar, destravar, entender um padrão ou conversar com a Aura. Use o padrão Airia: presença firme, leitura específica, custo concreto e manobra pequena quando houver material suficiente. Se o pedido atual virar comando operacional claro, execute como modo executor.'
  : 'EXECUTOR PURO: a pessoa quer que algo seja feito. Seja curta, direta e operacional. Não use análise profunda, não faça leitura emocional longa e não transforme comando em diário.'}

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
- Antes de responder em modo conversa, faça leitura total: pedido atual, histórico recente, humor atual, histórico de humor, RAG, planner, metas, hábitos/tarefas e ações recentes. Em modo executor, use essa leitura para escolher o menor comando correto.
- Se o contexto trouxer FRAME COGNITIVO DA AIRIA e PLANO DE RESPOSTA, eles têm prioridade sobre improviso: use memórias aceitas, ignore rejeitadas, respeite o modo/tom e não invente ação fora do movimento final permitido.
- Sempre que houver âncora suficiente, assistantMessage deve entregar próximo passo concreto, tarefa, compromisso, hábito, checklist, ajuste de agenda ou mensagem pronta. Se faltar âncora, faça uma única pergunta indispensável.
- Se o pedido já estiver claro e executável, escolha a ação direta.
- Em MODO EXECUTOR PURO, assistantMessage deve ser objetivo: ação preparada/feita, confirmação para revisar ou uma única pergunta indispensável. Proibido usar o modelo analítico de "padrão, custo, história" em comandos como marcar, excluir, concluir, reagendar, montar agenda, criar tarefa, criar meta ou checklist.
- Em CONVERSAR SOBRE META/PLANNER, o objetivo principal é EXPLICAR a tarefa/meta/ação para a pessoa: o que quer dizer, como fazer na prática, ideias, exemplos e sugestões simples. Não transforme isso em triagem.
- Em CONVERSA ESTRATÉGICA, use a linguagem Airia: próxima, firme, específica, com leitura de padrão apenas quando houver evidência, custo concreto e manobra pequena quando houver ação possível.
- Em qualquer MODO CONVERSA, quando a pessoa disser "não entendi", "está confuso", "não ficou claro" ou equivalente, NÃO diga que é "travamento de clareza", NÃO peça para ela escolher uma categoria e NÃO devolva a responsabilidade. Reformule em linguagem mais simples, com exemplo concreto e próximo passo pequeno.
- Em qualquer MODO CONVERSA, evite perguntas como primeira resposta. Só faça pergunta no fim, e apenas se for indispensável. Antes disso, entregue uma explicação útil com o contexto disponível.
- Em qualquer MODO CONVERSA, se não houver ação operacional a executar, use intent "clarify" com action "ask_clarification", mas o assistantMessage deve soar natural, estratégico e explicativo — nunca como formulário de decisão.
- HANDOFF_TO_JOURNAL É RESTRITO: SOMENTE use "handoff_to_journal" quando a pessoa pedir EXPLICITAMENTE "salva no diário", "vira diário", "registra no diário", "abre o diário com isso" — palavras claras de intenção. Em qualquer outro caso (mesmo que a conversa seja reflexiva, profunda ou pareça material de diário), NÃO faça handoff. A Aura central NÃO É o diário; ela apoia, executa e conversa, mas não converte conversa em diário sem permissão. Se você acha que faria sentido salvar, PERGUNTE em assistantMessage ("Quer que eu salve essa conversa no diário?") com action "ask_clarification" — não execute o handoff.
- ANTI-RESUMO (CRÍTICO): Se a pessoa enviou uma lista, um checklist ou um texto com vários pontos (ex: "comprar pão, leite e ovos"), NUNCA resuma tudo em um único título de tarefa. Use create_checklist ou create_goal para quebrar em sub-itens reais.
- Se for compromisso/agendamento com data ou horário (ex: "amanhã", "quarta", "às 14h"), use create_task e marque "needsConfirmation": true.
- Se for uma sequência de tarefas para o dia (ex: "organize meu dia", "planeje minha manhã"), use create_agenda.
- Se o pedido for recorrente ou cobrir um intervalo de datas (ex: "3 vezes por semana em abril", "toda segunda", "de 01/04 até 30/04"), use create_agenda e marque "needsConfirmation": true.
- Para pedidos recorrentes, NUNCA invente dias/horários ausentes. Se faltar detalhe suficiente para transformar em datas reais, use ask_clarification.
- Se for tarefa simples ou meta clara (ex: "lembrar de beber água"), "needsConfirmation" deve ser false.
- Se houver vários passos implícitos ou uma lista explícita, prefira create_checklist ou create_goal, mantendo TODOS os itens originais.
- No MODO EXECUTOR PURO, assistantMessage deve ser curta. Se "needsConfirmation" for true, diga que a proposta está pronta para revisão e NUNCA diga que já salvou no planner. Em MODO CONVERSA, não force resposta curta se isso prejudicar clareza, explicação ou manobra concreta.
- payload para create_task DEVE conter: { "title": string, "date": "YYYY-MM-DD", "startTime": "HH:MM", "category": string, "note": string | null }.
- payload para create_checklist DEVE conter: { "title": string, "items": string[], "category": string }.
- CHECKLIST QUEBRA SEMÂNTICA (CRÍTICO quando a pessoa cola um checklist e pede "Airia quebrar"):
  · NUNCA divida por contagem (não pegue N items e gere N sub-itens aleatórios).
  · LEIA cada item com atenção. Itens que JÁ têm próximo passo claro ("comprar leite") viram tarefa direta.
  · Itens vagos ou multi-passos ("organizar finanças") devem ser EXPANDIDOS em sub-passos concretos
    OU virar uma pergunta ("o que dentro de finanças quer destravar primeiro?") em vez de tarefa.
  · Agrupe por matéria semântica: tudo de trabalho junto, tudo de casa junto, tudo de saúde junto.
  · Use o ESTADO ADAPTATIVO DO DIA (carga sugerida, max tarefas pesadas, buffer): se a pessoa
    está em fase baixa e o checklist tem 12 itens, NÃO converta os 12 — pergunte qual o item
    mais urgente e converta só esse + 1-2 leves.
  · Cada sub-item DEVE mencionar algo concreto da vida da pessoa (nome de pessoa, lugar, projeto)
    quando o contexto permitir — nada de "fazer pausa" ou "respirar fundo" como passo do checklist.

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
            contextualMemory: input.ragContext,
            recentSuggestionMemory: input.recentSuggestionMemory,
            activeGoalsContext: input.activeGoalsContext,
            plannerContext: input.plannerContext,
            reasoningTraceContext: input.reasoningTraceContext,
            dayPlanContext: input.dayPlanContext,
            priorDiagnoses: input.priorDiagnoses,
            currentHour: input.currentHour,
            currentMinute: input.currentMinute,
            phase: input.phase,
            warningFlags: input.warningFlags,
            forecast7dSummary: input.forecast7dSummary,
            taskMomentum7d: input.taskMomentum7d,
            domain: interactionMode === 'conversation' ? 'journal-live' : 'aura-command',
            extraInstructions: interactionMode === 'conversation'
              ? isPlannerConversation
                ? [
                    'Este turno veio do botão CONVERSAR do planner. Explique a tarefa/meta/ação em linguagem natural: o que significa, por que ajuda, como fazer e ideias simples para começar.',
                    'Não classifique prioridade, não peça categoria, não faça triagem e não devolva pergunta antes de explicar.',
                    'Se a pessoa disser que não entendeu, reformule de modo mais simples e concreto. Não diga "travamento de clareza".',
                  ]
                : [
                    'Este turno veio do Chat Aura em modo conversa estratégica. Use o padrão Airia: abrir direto, espelhar o nó real, separar o ocorrido da interpretação quando útil, mostrar custo concreto e propor uma manobra pequena se houver evidência.',
                    'Não use visivelmente nomes de metodologia proprietária; a metodologia é raciocínio interno.',
                    'Se a frase atual pedir execução operacional, abandone a análise e responda como executor: curto, direto e acionável.',
                  ]
              : [
                  'Este turno é modo executor. Execute, peça confirmação ou pergunte só o dado indispensável. Não use resposta analítica longa.',
                ],
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

    const parsedRaw = extractJsonValue(content);
    const agendaCommand = extractAgendaCommand(parsedRaw);
    const commandResponse = parseAuraCommandResponse(content, input.message);

    return { ...commandResponse, agendaCommand: agendaCommand ?? null };
  }
}
