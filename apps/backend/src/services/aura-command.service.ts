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
    case 'complete_items':
      return 'complete_items';
    case 'create_capture':
      return 'capture';
    case 'create_checkin':
    case 'log_checkin':
      return 'checkin';
    case 'create_habit':
      return 'habit';
    case 'create_calendar_event':
      return 'calendar_event';
    case 'postpone_task':
      return 'postpone';
    case 'start_task':
      return 'start_task';
    case 'adapt_agenda':
      return 'adapt_agenda';
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
    case 'planner_task':
      return 'create_task';
    case 'checklist':
      return 'create_checklist';
    case 'goal_project':
      return 'create_goal';
    case 'agenda_plan':
      return 'create_agenda';
    case 'routine_builder':
      // Rotina é montada aqui na conversa, em blocos concretos.
      return 'create_agenda';
    case 'clarify':
      return 'ask_clarification';
    case 'reflective_handoff':
      return 'handoff_to_journal';
    case 'reschedule':
      return 'update_task';
    case 'delete_task':
      return 'delete_task';
    case 'complete_items':
      return 'complete_items';
    case 'capture':
      return 'create_capture';
    case 'checkin':
      return 'record_checkin';
    case 'habit':
      return 'create_habit';
    case 'calendar_event':
      return 'create_calendar_event';
    case 'postpone':
      return 'postpone_task';
    case 'start_task':
      return 'start_task';
    case 'adapt_agenda':
      return 'adapt_agenda';
    case 'navigate':
      return 'open_screen';
    default:
      return null;
  }
}

function inferActionFromPayload(payload: Record<string, unknown>): AuraCommandAction | null {
  if (asString(payload.kind) === 'note' || asString(payload.kind) === 'checklist') return 'create_capture';
  if ('moodScore' in payload || 'energyScore' in payload || 'clarityScore' in payload || 'irritabilityScore' in payload) return 'create_checkin';
  if (asString(payload.frequency) && asString(payload.title)) return 'create_habit';
  if (asString(payload.calendarId) && asString(payload.date) && (asString(payload.startTime) || asString(payload.time))) return 'create_calendar_event';
  if (Array.isArray(payload.blocks) || isRecord(payload.recurrence)) return 'create_agenda';
  if (asString(payload.taskId) && (asString(payload.newDate) || asString(payload.newStartTime))) return 'update_task';
  if (asString(payload.taskId)) return 'delete_task';
  if (asString(payload.date) || asString(payload.startTime) || asString(payload.time)) return 'create_task';
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
      ? 'Let me lay out your week here — I will place the blocks and you adjust what does not fit.'
      : 'Vou montar sua semana aqui. Coloco os blocos e você ajusta o que não servir.',
    intent: 'routine_builder',
    action: 'create_agenda',
    payload: { sourceText: message, buildWeek: true },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  });
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
    if (isExplicitRoutineBuilderRequest(input.message)) {
      return { ...routineBuilderResponse(input.message), agendaCommand: null };
    }

    const interactionMode = input.interactionMode === 'conversation' ? 'conversation' : 'executor';
    const isPlannerConversation = interactionMode === 'conversation' && (
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
      input.plannerContext ? ('== AGENDA/PLANNER ==\n' + input.plannerContext) : '',
      input.activeGoalsContext ? ('== METAS ATIVAS ==\n' + input.activeGoalsContext) : '',
      input.moodCycleContext ? ('== ESTADO ATUAL ==\n' + input.moodCycleContext) : '',
      input.reasoningTraceContext ? ('== CONTEXTO OPERACIONAL ==\n' + input.reasoningTraceContext) : '',
      '',
      '== HIERARQUIA DE EXECUÇÃO (CRÍTICO) ==',
      '1. CONVERSE quando a pessoa trouxer relato, dúvida, reflexão ou contexto sem pedir alteração no app: use respond/conversation e entregue leitura curta, sem transformar o relato em interrogatório.',
      '2. EXECUTE quando houver pedido operacional claro.',
      '3. PROPONHA se precisar de confirmação do usuário (só para datas futuras).',
      '4. PERGUNTE apenas se falta dado completamente indispensável (ex: qual tarefa específica remover).',
      '',
      '== MONTAR ROTINA AQUI NA CONVERSA (PRIORIDADE MÁXIMA) ==',
      'Quando a pessoa pedir para montar/organizar o dia, a semana ou a rotina inteira; colar uma lista misturada; ou pedir para transformar um texto em metas, hábitos, tarefas e compromissos:',
      '→ MONTE AQUI. Nunca mande a pessoa para outra tela nem diga que vai abrir um montador.',
      '→ Use create_agenda com os blocos concretos, e actions[] para os hábitos (create_habit) e metas (create_goal) que aparecerem no mesmo pedido.',
      '→ Distribua pelos dias usando o que você já sabe: compromissos existentes, hábitos devidos, fase e energia atual, janelas livres. Não empilhe em cima do que já existe.',
      '→ Não invente item que a pessoa não citou, mas decida horário, duração e dia dos itens que ela citou.',
      '→ assistantMessage: diga em uma frase o que montou e convide a ajustar ("montei a semana; me fala o que não serve").',
      '',
      '== FORMATO OBRIGATÓRIO PARA CREATE_AGENDA ==',
      'create_agenda serve tanto para dois blocos quanto para a semana inteira. Pedido amplo também é montado aqui.',
      'Quando action = "create_agenda", o payload DEVE ter uma chave "blocks" com array de blocos:',
      '{"action":"create_agenda","intent":"agenda_plan","needsConfirmation":false,"assistantMessage":"Pronto! Montei seu dia.","payload":{"blocks":[{"title":"Café + planejamento","date":"' + todayKey + '","startTime":"08:00","category":"pessoal"},{"title":"Foco profundo","date":"' + todayKey + '","startTime":"09:30","category":"trabalho"},{"title":"Almoço e pausa","date":"' + todayKey + '","startTime":"12:00","category":"autocuidado"},{"title":"Projetos da tarde","date":"' + todayKey + '","startTime":"14:00","category":"trabalho"},{"title":"Encerrar o dia","date":"' + todayKey + '","startTime":"17:30","category":"pessoal"}]}}',
      'Categorias válidas: "trabalho", "pessoal", "autocuidado", "social", "outro".',
      'NUNCA retorne create_agenda sem o campo "blocks" dentro de "payload".',
      '',
      '== SEM CONTEXTO ANTERIOR ==',
      'Se NÃO houver metas, hábitos, planner nem estado recente, não invente uma rotina padrão tirada do relógio e não faça entrevista. Execute somente o item nomeado na fala atual; se não houver item nem pedido operacional, responda com leitura breve e pare.',
      '',
      '== REGRAS DE NEEDSCONFIRMATION ==',
      '- FALSE (executa direto): tarefa de HOJE, rotina montada na conversa, tarefas sem data específica',
      '- TRUE (mostra proposta): APENAS quando a data é futura (amanhã ou depois)',
      '',
      '== REGRAS OPERACIONAIS ==',
      '- respond: conversa, análise ou orientação; payload vazio; não cria, move, exclui ou salva nada',
      '- create_task: title + date (' + todayKey + ' se hoje) + startTime + category + note',
      '- create_agenda: blocks[] com title/date/startTime/category cada um',
      '- create_agenda: blocks[] — de um bloco à semana inteira, sempre montada aqui na conversa',
      '- create_checklist: title + items[] (mantém TODOS os itens, sem resumir)',
      '- create_goal: title + subgoals[]',
      '- create_capture: kind "note"|"checklist" + title + content + items[]; use para "anote isso" e checklists soltas',
      '- record_checkin: localDate + moodScore + energyScore; clareza, irritabilidade, sono e fatores ficam null/ausentes quando não expressos. Preserve todos os fatores mencionados em factors[] e nunca substitua relato por nota neutra.',
      '- create_habit: title + frequency + targetDays + durationMinutes + reminderTime',
      '- create_calendar_event: compromisso fixo com title + date + startTime + durationMinutes + calendarId; se faltar data, pergunte; se faltar horário, proponha',
      '- update_task: taskId + newDate + newStartTime',
      '- delete_task: taskId',
      '- Para update_task/delete_task, use taskId somente quando o título do bloco corresponder ao alvo atual indicado no frame cognitivo; se não houver correspondência segura, use ask_clarification.',
      '- ask_clarification: só quando falta dado COMPLETAMENTE INDISPENSÁVEL',
      '- handoff_to_journal: APENAS quando a pessoa pedir EXPLICITAMENTE "salva no diário"',
      '- create_habit: title + frequency (daily|weekly) + daysOfWeek[] + timeOfDay (morning|afternoon|evening|anytime) + durationMinutes',
      '',
      '== MODO ' + interactionMode.toUpperCase() + ' ==',
      interactionMode === 'executor'
        ? 'Execute direto. assistantMessage curta (1-2 frases). Zero análise longa.'
        : isPlannerConversation
          ? 'Explique a tarefa/meta em linguagem natural. Por que ajuda, como fazer, ideia concreta. Sem triagem.'
          : 'Conversa estratégica: abra direto no ponto, leia o nó real, proponha manobra pequena e concreta.',
      '',
      '== RELATO DE CONCLUSÃO (complete_items) ==',
      'Se a pessoa relatar o que JÁ FEZ no dia (palavras-chave: "já fiz", "terminei", "fiz hoje", "acabei de", "concluí", "já tomei", "já mandei", "já fui"):',
      '→ action: "complete_items", intent: "complete_items"',
      '→ payload: { items: [ { title: "<o que foi feito>", type: "task" | "habit" } ] }',
      '→ Para cada coisa mencionada, criar um item na lista. type "habit" se for hábito recorrente (remédio, exercício, água, sono); "task" para todo o resto.',
      '→ assistantMessage: confirmar o registro de forma breve (1 frase). Sem elogios excessivos.',
      '→ needsConfirmation: false — se ela disse que fez, registra direto.',
      '',
      '== VÁRIAS COISAS NA MESMA FALA ==',
      'Uma fala pode conter mais de uma ação ("marquei consulta quinta às 15h e já lavei a louça" = criar compromisso + registrar conclusão).',
      '→ Coloque a primeira em action/payload e as demais em "actions": [{ "action": "...", "payload": {...} }]. Máximo 8.',
      '→ Nunca descarte a segunda coisa que a pessoa disse por já ter usado a primeira.',
      '',
      '== CONFIRA O DIA ANTES DE AGIR ==',
      'Você tem acima o dia real: estado atual, padrões verificados, Objetivos, Ações pendentes e concluídas e o que já foi relatado hoje. Contextos legados de agenda/hábitos só valem quando explicitamente habilitados.',
      '→ Antes de criar, procure se aquilo já existe. Se existir e a pessoa relatou que fez, use complete_items em vez de criar de novo.',
      '→ Antes de propor qualquer ajuste, olhe o que já está ocupado. Não empilhe em cima de compromisso existente nem reative superfície legada desabilitada.',
      '→ Se algo que você ia sugerir já foi feito hoje, não sugira: reconheça.',
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
