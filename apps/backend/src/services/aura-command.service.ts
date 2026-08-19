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
import { getOpenAiModel, getOpenAiOutputLimit } from '../lib/openai-config';
import { isExplicitRoutineBuilderRequest } from '../lib/routine-request';

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
    case 'respond':
      return 'conversation';
    case 'create_checklist':
      return 'checklist';
    case 'create_goal':
      return 'goal_project';
    case 'ask_clarification':
      return 'clarify';
    case 'handoff_to_journal':
      return 'reflective_handoff';
    case 'complete_items':
      return 'complete_items';
    case 'create_capture':
      return 'capture';
    case 'create_checkin':
    case 'log_checkin':
      return 'checkin';
    case 'open_screen':
      return 'navigate';
    default:
      return null;
  }
}

function inferActionFromIntent(intent: AuraCommandIntent | null): AuraCommandAction | null {
  switch (intent) {
    case 'conversation':
      return 'respond';
    case 'checklist':
      return 'create_checklist';
    case 'goal_project':
      return 'create_goal';
    case 'clarify':
      return 'ask_clarification';
    case 'reflective_handoff':
      return 'handoff_to_journal';
    case 'complete_items':
      return 'complete_items';
    case 'capture':
      return 'create_capture';
    case 'checkin':
      return 'record_checkin';
    case 'navigate':
      return 'open_screen';
    default:
      return null;
  }
}

function inferActionFromPayload(payload: Record<string, unknown>): AuraCommandAction | null {
  if (asString(payload.kind) === 'note' || asString(payload.kind) === 'checklist') return 'create_capture';
  if ('moodScore' in payload || 'energyScore' in payload || 'clarityScore' in payload || 'irritabilityScore' in payload) return 'create_checkin';
  if (Array.isArray(payload.items) || Array.isArray(payload.steps) || Array.isArray(payload.checklist)) return 'create_checklist';
  if (Array.isArray(payload.subgoals) || Array.isArray(payload.subtasks) || asString(payload.goalTitle)) return 'create_goal';
  return null;
}

function asksToSaveInJournal(message: string): boolean {
  return /\b(salv|registr|guard).{0,24}\b(di[aá]rio|journal)\b|\b(di[aá]rio|journal).{0,24}\b(salv|registr|guard)/i.test(message);
}

function routineBuilderResponse(message: string): AuraCommandResponse {
  const isEnglish =
    /\b(?:i need|i want|i would like|help me|can you|could you)\b/i.test(message)
    && !/\b(?:eu|preciso|quero|rotina|agenda|semana)\b/i.test(message);

  return AuraCommandResponseSchema.parse({
    assistantMessage: isEnglish
      ? 'The active experience works through goals, daily check-ins, and the journal. Tell me the concrete outcome you want to turn into a goal.'
      : 'A experiência ativa organiza o dia por Objetivos, Check-in e Diário. Me diga o resultado concreto que você quer transformar em objetivo.',
    intent: 'clarify',
    action: 'ask_clarification',
    payload: { sourceText: message },
    needsConfirmation: false,
    needsClarification: true,
    clarifyingQuestion: isEnglish
      ? 'What concrete outcome do you want to turn into a goal?'
      : 'Qual resultado concreto você quer transformar em objetivo?',
  });
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
  for (const key of ['title', 'date', 'startTime', 'time', 'category', 'blocks', 'items', 'steps', 'checklist', 'subgoals', 'subtasks', 'recurrence', 'taskId', 'newDate', 'newStartTime', 'targetDate', 'reason', 'screen', 'kind', 'content', 'frequency', 'targetDays', 'durationMinutes', 'moodScore', 'energyScore', 'clarityScore', 'irritabilityScore', 'note', 'emotions', 'calendarId', 'location', 'description']) {
    if (key in root) {
      payload[key] = root[key];
    }
  }

  return payload;
}

export function parseAuraCommandResponse(content: string, originalMessage = ''): AuraCommandResponse {
  if (isExplicitRoutineBuilderRequest(originalMessage)) {
    return routineBuilderResponse(originalMessage);
  }

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
    if (asksToSaveInJournal(originalMessage)) {
      action = 'handoff_to_journal';
      intent = 'reflective_handoff';
    } else {
      action = 'respond';
      intent = 'conversation';
    }
  }

  const needsClarification = asBoolean(root.needsClarification, intent === 'clarify' || action === 'ask_clarification');
  const assistantMessage =
    asString(root.assistantMessage) ??
    asString(root.message) ??
    (needsClarification
      ? 'Preciso apenas do item exato para concluir essa alteração.'
      : 'Entendi o que você trouxe.');

  const normalized = {
    assistantMessage,
    intent,
    action,
    payload,
    needsConfirmation: asBoolean(root.needsConfirmation, false),
    needsClarification,
    clarifyingQuestion:
      asString(root.clarifyingQuestion) ??
      (needsClarification ? 'Qual item exato devo alterar?' : null),
  };

  return AuraCommandResponseSchema.parse(normalized);
}

function unavailableCommandResponse(locale?: string): AuraCommandResponse {
  const isPortuguese = !locale || locale.toLowerCase().startsWith('pt');
  return {
    assistantMessage: isPortuguese
      ? 'Não consegui concluir essa etapa agora. Vou seguir apenas com o que ficou claro no seu pedido.'
      : 'I could not complete that step right now. I will continue only with what was clear in your request.',
    intent: 'conversation',
    action: 'respond',
    payload: {},
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
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
      locale?: string;
    },
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<AuraCommandResponse> {
    if (isExplicitRoutineBuilderRequest(input.message)) {
      return routineBuilderResponse(input.message);
    }

    const interactionMode = input.interactionMode === 'conversation' ? 'conversation' : 'executor';
    const isGoalConversation = interactionMode === 'conversation' && (
      /bot[aã]o\s+CONVERSAR/i.test(input.message) ||
      /tarefa\/meta/i.test(input.message) ||
      /pr[oó]xima a[cç][aã]o da meta/i.test(input.message) ||
      /entender melhor esta/i.test(input.message)
    );
    const historyBlock = (input.history ?? [])
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'Usuário' : 'Airia'}: ${message.content}`)
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
      input.activeGoalsContext ? ('== METAS ATIVAS ==\n' + input.activeGoalsContext) : '',
      input.moodCycleContext ? ('== ESTADO ATUAL ==\n' + input.moodCycleContext) : '',
      input.reasoningTraceContext ? ('== CONTEXTO OPERACIONAL ==\n' + input.reasoningTraceContext) : '',
      '',
      '== HIERARQUIA DE EXECUÇÃO (CRÍTICO) ==',
      '1. CONVERSE quando a pessoa trouxer relato, dúvida, reflexão ou contexto sem pedir alteração no app: use respond/conversation e entregue leitura curta, sem transformar o relato em interrogatório.',
      '2. EXECUTE quando houver pedido operacional claro.',
      '3. PROPONHA somente uma ação concreta que pertença a um Objetivo ativo.',
      '4. PERGUNTE apenas se falta dado completamente indispensável (ex: qual tarefa específica remover).',
      '',
      '== NÚCLEO ATIVO ==',
      'O produto ativo tem Check-in, Diário, Objetivos e Padrões. Toda ação deve pertencer a uma dessas superfícies.',
      'Quando a pessoa pedir para organizar o dia ou a semana, use o Check-in para calibrar o tamanho do dia ou transforme um resultado nomeado em Objetivo; se faltar resultado concreto, faça uma pergunta curta.',
      'Sem Objetivo ativo ou resultado nomeado, não invente tarefa. Entregue uma leitura curta ou encaminhe ao Diário quando a pessoa pedir para elaborar o relato.',
      '',
      '== REGRAS OPERACIONAIS ==',
      '- respond: conversa, análise ou orientação; payload vazio; não cria, move, exclui ou salva nada',
      '- create_checklist: title + items[] (mantém TODOS os itens, sem resumir)',
      '- create_goal: title + subgoals[]; cada subação deve ter title, doneWhen e objeto concreto',
      '- create_capture: kind "note"|"checklist" + title + content + items[]; use para "anote isso" e checklists soltas',
      '- record_checkin: localDate + moodScore + energyScore; clareza, irritabilidade, sono e fatores ficam null/ausentes quando não expressos. Preserve todos os fatores mencionados em factors[] e nunca substitua relato por nota neutra.',
      '- ask_clarification: só quando falta dado COMPLETAMENTE INDISPENSÁVEL',
      '- handoff_to_journal: APENAS quando a pessoa pedir EXPLICITAMENTE "salva no diário"',
      '',
      '== MODO ' + interactionMode.toUpperCase() + ' ==',
      interactionMode === 'executor'
        ? 'Execute direto. assistantMessage curta (1-2 frases). Zero análise longa.'
        : isGoalConversation
          ? 'Explique o Objetivo ou a ação em linguagem natural. Diga por que ajuda e qual é o próximo movimento concreto. Sem triagem.'
          : 'Conversa estratégica: abra direto no ponto, leia o nó real, proponha manobra pequena e concreta.',
      '',
      '== RELATO DE CONCLUSÃO (complete_items) ==',
      'Se a pessoa relatar o que JÁ FEZ no dia (palavras-chave: "já fiz", "terminei", "fiz hoje", "acabei de", "concluí", "já tomei", "já mandei", "já fui"):',
      '→ action: "complete_items", intent: "complete_items"',
      '→ Só registre conclusão quando ela nomear uma ação existente de Objetivo. Caso contrário, reconheça o que ela fez sem criar registro em área desativada.',
      '',
      '== VÁRIAS COISAS NA MESMA FALA ==',
      'Uma fala pode conter mais de uma ação ("marquei consulta quinta às 15h e já lavei a louça" = criar compromisso + registrar conclusão).',
      '→ Coloque a primeira em action/payload e as demais em "actions": [{ "action": "...", "payload": {...} }]. Máximo 8.',
      '→ Nunca descarte a segunda coisa que a pessoa disse por já ter usado a primeira.',
      '',
      '== CONFIRA O CONTEXTO ANTES DE AGIR ==',
      'Você tem acima estado atual, padrões verificados, Objetivos, ações pendentes/concluídas e o que já foi relatado hoje.',
      '→ Antes de criar uma meta, procure se ela já existe. Antes de propor uma ação, use apenas a próxima ação concreta do Objetivo ativo.',
      '→ Se algo já foi feito hoje, reconheça; não recrie e não reative qualquer superfície legada.',
      '',
      '== ANTI-PADRÕES (NUNCA FAÇA) ==',
      '- Não transforme relato em pergunta de triagem. Se não há pedido operacional, use respond e entregue a resposta.',
      '- Não mande a pessoa para outra tela para fazer o que você consegue fazer aqui.',
      '- Não resuma uma lista em uma tarefa — use create_checklist.',
      '- Não use análise emocional longa em modo executor.',
      '- Não faça handoff ao diário sem a pessoa pedir.',
      '- Não diga que já salvou se needsConfirmation é true.',
      '',
      'Retorne APENAS JSON com: assistantMessage, intent, action, payload, needsConfirmation e, quando houver mais de uma coisa a fazer, actions[]. Para conversa comum: {"intent":"conversation","action":"respond","payload":{},"needsConfirmation":false}.',
    ].filter(Boolean).join('\n');

    try {
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
            ? isGoalConversation
                  ? [
                      'Este turno veio de uma conversa sobre Objetivo. Explique a meta ou ação em linguagem natural: o que significa, por que ajuda, como fazer e ideias simples para começar.',
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
        ...getOpenAiOutputLimit(this.MODEL, 1200),
      } as any);

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[aura-command] provedor não devolveu conteúdo estruturado');
        return unavailableCommandResponse(input.locale);
      }

      return parseAuraCommandResponse(content, input.message);
    } catch (error) {
      console.warn('[aura-command] falha do provedor; usando recuperação segura:', error);
      return unavailableCommandResponse(input.locale);
    }
  }
}
