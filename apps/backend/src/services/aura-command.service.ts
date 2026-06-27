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
      localDate?: string | null;
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

    // Usa a data local do cliente se disponível; fallback para UTC do servidor
    const _now = new Date();
    const _pad = (n: number) => String(n).padStart(2, '0');
    const todayKey = (typeof input.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.localDate))
      ? input.localDate
      : `${_now.getUTCFullYear()}-${_pad(_now.getUTCMonth() + 1)}-${_pad(_now.getUTCDate())}`;

    const prompt = [
      'Você é a Airia — assistente operacional. Sua função é entender o que a pessoa precisa e FAZER ACONTECER.',
      '',
      '== PEDIDO ATUAL ==',
      input.message,
      '',
      historyBlock ? ('== HISTÓRICO RECENTE ==\n' + historyBlock) : '',
      input.ragContext ? ('== MEMÓRIAS ==\n' + input.ragContext) : '',
      input.plannerContext ? ('== AGENDA/PLANNER ==\n' + input.plannerContext) : '',
      input.activeGoalsContext ? ('== METAS ATIVAS ==\n' + input.activeGoalsContext) : '',
      input.moodCycleContext ? ('== ESTADO ATUAL ==\n' + input.moodCycleContext) : '',
      input.reasoningTraceContext ? ('== CONTEXTO OPERACIONAL ==\n' + input.reasoningTraceContext) : '',
      '',
      '== HIERARQUIA DE EXECUÇÃO (CRÍTICO) ==',
      '1. EXECUTE primeiro: se o pedido é claro, aja. Não analise antes de agir.',
      '2. PROPONHA se precisar de confirmação do usuário (só para datas futuras).',
      '3. PERGUNTE apenas se falta dado completamente indispensável (ex: qual tarefa específica remover).',
      '',
      '== ROTINA AUTOMÁTICA (PRIORIDADE MÁXIMA) ==',
      'Se a pessoa disser que não sabe o que fazer, está paralisada, quer organizar o dia,',
      'não tem agenda, está perdida ou pede "monta meu dia" / "o que faço agora" / "me ajuda a começar":',
      '→ Use create_agenda com blocos reais baseados em:',
      '  - Hora atual (se disponível no contexto)',
      '  - Fase/energia (do estado atual)',
      '  - Metas ativas',
      '  - Hábitos pendentes',
      '  - Necessidades básicas (alimentação, movimento, descanso)',
      '→ NÃO pergunte "qual é sua prioridade". Monte a rotina, apresente, deixe a pessoa ajustar.',
      '→ Blocos devem ter: title, date (hoje = ' + todayKey + '), startTime (HH:MM), category.',
      '→ assistantMessage: confirme o que foi criado de forma breve e animada. Máx 2 frases.',
      '',
      '== MODO ZERO CONTEXTO ==',
      'Se NÃO houver metas, hábitos, planner, nem estado de humor disponível:',
      '→ MESMO ASSIM use create_agenda — nunca retorne só texto quando pedirem rotina.',
      '→ Crie 5-6 blocos para um dia equilibrado começando ~1h depois da hora atual (' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ').',
      '→ Estrutura base: manhã ativa (café + movimento leve), foco profundo, pausa/alimentação, trabalho/projetos, encerramento.',
      '→ Use category: "routine" para manhã/encerramento, "focus" para trabalho, "break" para pausa.',
      '→ Títulos em português natural. Ex: "Café + planejamento do dia", "Foco profundo", "Almoço e pausa", "Projetos / tarefas", "Encerrar o dia".',
      '',
      '== REGRAS DE NEEDSCONFIRMATION ==',
      '- FALSE (executa direto): tarefa de HOJE, rotina do dia, tarefas sem data específica',
      '- TRUE (mostra proposta): APENAS quando a data é futura (amanhã ou depois)',
      '',
      '== REGRAS OPERACIONAIS ==',
      '- create_task: title + date (' + todayKey + ' se hoje) + startTime + category + note',
      '- create_agenda: blocks[] com title/date/startTime/category cada um',
      '- create_checklist: title + items[] (mantém TODOS os itens, sem resumir)',
      '- create_goal: title + subgoals[]',
      '- update_task: taskId + newDate + newStartTime',
      '- delete_task: taskId',
      '- ask_clarification: só quando falta dado COMPLETAMENTE INDISPENSÁVEL',
      '- handoff_to_journal: APENAS quando a pessoa pedir EXPLICITAMENTE "salva no diário"',
      '',
      '== MODO ' + interactionMode.toUpperCase() + ' ==',
      interactionMode === 'executor'
        ? 'Execute direto. assistantMessage curta (1-2 frases). Zero análise longa.'
        : isPlannerConversation
          ? 'Explique a tarefa/meta em linguagem natural. Por que ajuda, como fazer, ideia concreta. Sem triagem.'
          : 'Conversa estratégica: abra direto no ponto, leia o nó real, proponha manobra pequena e concreta.',
      '',
      '== ANTI-PADRÕES (NUNCA FAÇA) ==',
      '- Não pergunte "qual é sua prioridade?" quando a agenda está vazia — crie a rotina.',
      '- Não resuma uma lista em uma tarefa — use create_checklist.',
      '- Não use análise emocional longa em modo executor.',
      '- Não faça handoff ao diário sem a pessoa pedir.',
      '- Não diga que já salvou se needsConfirmation é true.',
      '',
      'Retorne APENAS JSON com: assistantMessage, intent, action, payload, needsConfirmation.',
    ].filter(Boolean).join('\n');

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
