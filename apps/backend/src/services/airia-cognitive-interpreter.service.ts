import OpenAI from 'openai';
import { z } from 'zod';
import type { DailyContext } from './context-grounding.service';
import type { DecisionSurface } from './decision-engine.service';
import type { AiriaActionPlan } from './airia-operational-reasoning.service';
import { getOpenAiMaxCompletionTokens, getOpenAiModel } from '../lib/openai-config';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}

const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as any)[prop];
  },
});

export type AiriaCognitiveIntent =
  | 'conversation'
  | 'execution'
  | 'decision'
  | 'agenda_adaptation'
  | 'journal_reflection'
  | 'checkin_reading'
  | 'home_guidance'
  | 'insight_reading'
  | 'message_draft'
  | 'clarification';

export type AiriaResponseMode =
  | 'acolher'
  | 'explicar'
  | 'executar'
  | 'adaptar_agenda'
  | 'preparar_mensagem'
  | 'perguntar_ancora'
  | 'fechar_sem_tarefa';

export type AiriaResponseTone = 'doce' | 'firme' | 'objetivo' | 'reflexivo' | 'executor';
export type AiriaMemoryJudgmentStatus = 'accepted' | 'partial' | 'rejected';

export type AiriaMemoryJudgment = {
  memory: string;
  status: AiriaMemoryJudgmentStatus;
  reason: string;
};

export type AiriaCognitiveFrame = {
  surface: DecisionSurface;
  currentFact: string;
  userInterpretation: string;
  emotionalSignal: string;
  intent: AiriaCognitiveIntent;
  decisionInPlay: string;
  moodCycleReading: string;
  relevantEvidence: string[];
  memoryJudgments: AiriaMemoryJudgment[];
  riskOfBadResponse: string[];
  confidence: 'alta' | 'media' | 'baixa';
};

export type AiriaResponsePlan = {
  responseMode: AiriaResponseMode;
  tone: AiriaResponseTone;
  oneSentenceReading: string;
  finalMove: string;
  mustMention: string[];
  mustAvoid: string[];
  allowedActionSource: 'agenda' | 'habit' | 'goal' | 'user_report' | 'memory_pattern' | 'none';
};

export type AiriaCognitiveResult = {
  frame: AiriaCognitiveFrame;
  responsePlan: AiriaResponsePlan;
};

export type AiriaCognitiveInput = {
  surface: DecisionSurface;
  dailyContext: DailyContext;
  currentMessage?: string | null;
  history?: Array<{ role: string; content: string }> | null;
  requestContext?: Record<string, unknown>;
  ragContext?: string | null;
  moodCycleContext?: string | null;
  plannerContext?: string | null;
  activeGoalsContext?: string | null;
  recentSuggestionMemory?: string | null;
  actionPlan?: AiriaActionPlan | null;
};

const CognitiveModelSchema = z.object({
  frame: z.object({
    currentFact: z.string().default(''),
    userInterpretation: z.string().default(''),
    emotionalSignal: z.string().default(''),
    intent: z.enum([
      'conversation',
      'execution',
      'decision',
      'agenda_adaptation',
      'journal_reflection',
      'checkin_reading',
      'home_guidance',
      'insight_reading',
      'message_draft',
      'clarification',
    ]).default('conversation'),
    decisionInPlay: z.string().default(''),
    moodCycleReading: z.string().default(''),
    relevantEvidence: z.array(z.string()).default([]),
    memoryJudgments: z.array(z.object({
      memory: z.string(),
      status: z.enum(['accepted', 'partial', 'rejected']),
      reason: z.string(),
    })).default([]),
    riskOfBadResponse: z.array(z.string()).default([]),
    confidence: z.enum(['alta', 'media', 'baixa']).default('media'),
  }),
  responsePlan: z.object({
    responseMode: z.enum([
      'acolher',
      'explicar',
      'executar',
      'adaptar_agenda',
      'preparar_mensagem',
      'perguntar_ancora',
      'fechar_sem_tarefa',
    ]).default('explicar'),
    tone: z.enum(['doce', 'firme', 'objetivo', 'reflexivo', 'executor']).default('doce'),
    oneSentenceReading: z.string().default(''),
    finalMove: z.string().default(''),
    mustMention: z.array(z.string()).default([]),
    mustAvoid: z.array(z.string()).default([]),
    allowedActionSource: z.enum(['agenda', 'habit', 'goal', 'user_report', 'memory_pattern', 'none']).default('none'),
  }),
});

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function listPreview(values: string[], limit = 4): string {
  return values.map(cleanText).filter(Boolean).slice(0, limit).join(' | ');
}

function splitMemoryLines(value: string | null | undefined): string[] {
  return cleanText(value)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter((line) => line.length >= 18)
    .slice(0, 8);
}

function inferIntent(surface: DecisionSurface, message: string): AiriaCognitiveIntent {
  if (surface === 'journal') return 'journal_reflection';
  if (surface === 'checkin') return 'checkin_reading';
  if (surface === 'home') return 'home_guidance';
  if (surface === 'insights') return 'insight_reading';
  if (surface === 'planner' || surface === 'agenda') return 'agenda_adaptation';
  if (/\b(crie|criar|marca|marcar|exclu|apaga|conclu|agenda|reagenda|adiar|mover)\b/i.test(message)) return 'execution';
  if (/\b(mensagem|responder|mandar|whatsapp|email|e-mail)\b/i.test(message)) return 'message_draft';
  if (/\b(decidir|escolher|não sei|nao sei|dúvida|duvida)\b/i.test(message)) return 'decision';
  if (!message) return 'clarification';
  return 'conversation';
}

function inferMode(intent: AiriaCognitiveIntent, actionPlan?: AiriaActionPlan | null): AiriaResponseMode {
  if (actionPlan?.decision.type === 'ask_anchor') return 'perguntar_ancora';
  if (intent === 'execution') return 'executar';
  if (intent === 'agenda_adaptation') return 'adaptar_agenda';
  if (intent === 'message_draft') return 'preparar_mensagem';
  if (intent === 'clarification') return 'perguntar_ancora';
  if (intent === 'journal_reflection') return 'acolher';
  return 'explicar';
}

function actionSource(actionPlan?: AiriaActionPlan | null): AiriaResponsePlan['allowedActionSource'] {
  const target = actionPlan?.action?.targetType;
  if (target === 'timeline') return 'agenda';
  if (target === 'habit') return 'habit';
  if (target === 'goal') return 'goal';
  if (actionPlan?.decision.type === 'ask_anchor') return 'none';
  return 'user_report';
}

function heuristicBuild(input: AiriaCognitiveInput): AiriaCognitiveResult {
  const message = cleanText(input.currentMessage);
  const intent = inferIntent(input.surface, message);
  const evidence = [
    message ? `Relato atual: ${message.slice(0, 180)}` : '',
    input.dailyContext.pendingTaskTitles.length ? `Agenda: ${listPreview(input.dailyContext.pendingTaskTitles)}` : '',
    input.dailyContext.pendingHabitTitles.length ? `Hábitos: ${listPreview(input.dailyContext.pendingHabitTitles)}` : '',
    input.dailyContext.activeGoalTitles.length ? `Metas: ${listPreview(input.dailyContext.activeGoalTitles)}` : '',
    input.actionPlan?.action?.displayText ? `Plano operacional: ${input.actionPlan.action.displayText}` : '',
  ].filter(Boolean);
  const memoryJudgments = splitMemoryLines(input.ragContext).map((memory) => ({
    memory: memory.slice(0, 220),
    status: message && memory.toLowerCase().split(/\s+/).some((token) => token.length > 4 && message.toLowerCase().includes(token))
      ? 'partial' as const
      : 'rejected' as const,
    reason: message ? 'Comparada com o relato atual antes de aparecer na resposta.' : 'Sem relato atual suficiente para usar como ação.',
  }));
  const confidence = input.actionPlan?.decision.confidence ?? (message ? 'media' : 'baixa');
  const responseMode = inferMode(intent, input.actionPlan);
  const finalMove = input.actionPlan?.action?.displayText
    ?? (responseMode === 'perguntar_ancora' ? 'Perguntar qual fato atual precisa de direção agora.' : 'Responder com leitura curta e sem criar tarefa.');

  return {
    frame: {
      surface: input.surface,
      currentFact: message || 'Sem fato atual explícito.',
      userInterpretation: /acho|parece|sinto que|medo de/i.test(message) ? 'Há interpretação misturada ao fato.' : 'Interpretação não explicitada.',
      emotionalSignal: /ansios|trist|raiva|medo|culpa|cansad|exaust|irritad/i.test(message) ? 'Há emoção nomeada ou sugerida no relato.' : 'Sinal emocional leve ou não nomeado.',
      intent,
      decisionInPlay: input.actionPlan?.reading.pattern ?? 'Definir a próxima decisão possível com base no contexto real.',
      moodCycleReading: input.actionPlan?.reading.moodCyclePhase ?? (cleanText(input.moodCycleContext) || 'Ritmo atual não informado.'),
      relevantEvidence: evidence,
      memoryJudgments,
      riskOfBadResponse: [
        'Inventar tarefa a partir de memória antiga.',
        'Responder com lista genérica.',
        'Usar escrita/anotação como saída automática.',
      ],
      confidence,
    },
    responsePlan: {
      responseMode,
      tone: intent === 'execution' ? 'executor' : input.surface === 'journal' ? 'reflexivo' : 'doce',
      oneSentenceReading: evidence[0] ?? 'Ainda falta um fato atual claro para uma leitura forte.',
      finalMove,
      mustMention: evidence.slice(0, 2),
      mustAvoid: [
        'Não citar nomes técnicos da metodologia.',
        'Não usar memória rejeitada.',
        'Não criar tarefa sem âncora real.',
        'Não sugerir escrever/anotar/registrar fora do Diário, mensagem pronta ou pedido explícito.',
      ],
      allowedActionSource: actionSource(input.actionPlan),
    },
  };
}

function buildPrompt(input: AiriaCognitiveInput): string {
  const history = (input.history ?? [])
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'Usuária' : 'Airia'}: ${item.content}`)
    .join('\n');
  const signals = [
    input.moodCycleContext ? `Humor/histórico: ${input.moodCycleContext}` : '',
    input.plannerContext ? `Planner: ${input.plannerContext}` : '',
    input.activeGoalsContext ? `Metas: ${input.activeGoalsContext}` : '',
    input.recentSuggestionMemory ? `Sugestões recentes/bloqueios: ${input.recentSuggestionMemory}` : '',
    input.ragContext ? `RAG/memória recuperada: ${input.ragContext}` : '',
  ].filter(Boolean).join('\n\n');

  return `Faça uma pré-leitura cognitiva para a Airia antes da resposta final.

SUPERFÍCIE: ${input.surface}
RELATO/PEDIDO ATUAL:
${cleanText(input.currentMessage) || 'sem mensagem direta'}

HISTÓRICO RECENTE:
${history || 'sem histórico recente'}

CONTEXTO DO DIA:
- Data: ${input.dailyContext.date}
- Agenda pendente: ${listPreview(input.dailyContext.pendingTaskTitles) || 'nenhuma'}
- Hábitos devidos: ${listPreview(input.dailyContext.pendingHabitTitles) || 'nenhum'}
- Metas ativas: ${listPreview(input.dailyContext.activeGoalTitles) || 'nenhuma'}
- Já feito/bloqueado: ${listPreview([...input.dailyContext.completedTaskTitles, ...input.dailyContext.completedHabitTitles, ...input.dailyContext.blockedActionTitles]) || 'nada relevante'}

PLANO OPERACIONAL JÁ VALIDADO:
${input.actionPlan ? JSON.stringify(input.actionPlan, null, 2) : 'nenhum'}

SINAIS E MEMÓRIA:
${signals || 'sem sinais adicionais'}

OBJETIVO:
- Separar fato, emoção, interpretação e decisão em jogo.
- Julgar quais memórias são úteis, parciais ou rejeitadas.
- Definir como a resposta final deve ser escrita.
- Não criar tarefa a partir de memória antiga.
- Não usar termos técnicos da metodologia.
- Não sugerir escrever/anotar/registrar fora de Diário, mensagem pronta ou pedido explícito.

Retorne apenas JSON neste formato:
{
  "frame": {
    "currentFact": "fato real em uma frase",
    "userInterpretation": "interpretação provável ou vazio",
    "emotionalSignal": "emoção/sinal percebido",
    "intent": "conversation|execution|decision|agenda_adaptation|journal_reflection|checkin_reading|home_guidance|insight_reading|message_draft|clarification",
    "decisionInPlay": "decisão concreta em jogo",
    "moodCycleReading": "como humor/energia/fase calibram a resposta",
    "relevantEvidence": ["até 5 evidências reais"],
    "memoryJudgments": [{"memory":"trecho curto","status":"accepted|partial|rejected","reason":"motivo"}],
    "riskOfBadResponse": ["riscos a evitar"],
    "confidence": "alta|media|baixa"
  },
  "responsePlan": {
    "responseMode": "acolher|explicar|executar|adaptar_agenda|preparar_mensagem|perguntar_ancora|fechar_sem_tarefa",
    "tone": "doce|firme|objetivo|reflexivo|executor",
    "oneSentenceReading": "leitura visível em linguagem comum",
    "finalMove": "ação principal, pergunta curta ou nenhum",
    "mustMention": ["até 2 fatos reais"],
    "mustAvoid": ["coisas que a resposta final não pode fazer"],
    "allowedActionSource": "agenda|habit|goal|user_report|memory_pattern|none"
  }
}`;
}

function normalizeParsed(input: AiriaCognitiveInput, parsed: z.infer<typeof CognitiveModelSchema>): AiriaCognitiveResult {
  const fallback = heuristicBuild(input);
  return {
    frame: {
      ...fallback.frame,
      ...parsed.frame,
      surface: input.surface,
      relevantEvidence: parsed.frame.relevantEvidence.slice(0, 5),
      memoryJudgments: parsed.frame.memoryJudgments.slice(0, 8),
      riskOfBadResponse: parsed.frame.riskOfBadResponse.length
        ? parsed.frame.riskOfBadResponse.slice(0, 6)
        : fallback.frame.riskOfBadResponse,
    },
    responsePlan: {
      ...fallback.responsePlan,
      ...parsed.responsePlan,
      mustMention: parsed.responsePlan.mustMention.slice(0, 2),
      mustAvoid: [
        ...parsed.responsePlan.mustAvoid,
        'Não citar nomes técnicos da metodologia.',
        'Não inventar tarefa sem âncora real.',
      ].slice(0, 8),
    },
  };
}

export class AiriaCognitiveInterpreterService {
  private static readonly MODEL = process.env.OPENAI_COGNITIVE_MODEL?.trim() || getOpenAiModel();

  static async interpret(
    input: AiriaCognitiveInput,
    client: Pick<OpenAI, 'chat'> = openai,
  ): Promise<AiriaCognitiveResult> {
    if (!process.env.OPENAI_API_KEY && client === openai) {
      return heuristicBuild(input);
    }

    try {
      const response = await client.chat.completions.create({
        model: this.MODEL,
        messages: [
          {
            role: 'system',
            content: 'Você é a camada cognitiva interna da Airia. Você não conversa com a usuária; você interpreta contexto e devolve JSON para orientar a resposta final com máxima qualidade.',
          },
          { role: 'user', content: buildPrompt(input) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: getOpenAiMaxCompletionTokens(5000),
        temperature: 0.2,
      } as any);

      const content = response.choices?.[0]?.message?.content;
      if (!content) return heuristicBuild(input);
      const parsed = CognitiveModelSchema.parse(JSON.parse(content));
      return normalizeParsed(input, parsed);
    } catch (error) {
      console.warn('[airia-cognitive] Falling back to heuristic frame:', error);
      return heuristicBuild(input);
    }
  }

  static formatForPrompt(result: AiriaCognitiveResult): string {
    const memoryLines = result.frame.memoryJudgments
      .map((item) => `- ${item.status}: ${item.memory} (${item.reason})`)
      .join('\n');
    return `FRAME COGNITIVO DA AIRIA (USO INTERNO - NAO MOSTRAR):
Superficie: ${result.frame.surface}
Fato atual: ${result.frame.currentFact}
Interpretacao da usuaria: ${result.frame.userInterpretation}
Sinal emocional: ${result.frame.emotionalSignal}
Intencao: ${result.frame.intent}
Decisao em jogo: ${result.frame.decisionInPlay}
Leitura de humor/energia: ${result.frame.moodCycleReading}
Confianca: ${result.frame.confidence}
Evidencias aceitas:
${result.frame.relevantEvidence.map((item) => `- ${item}`).join('\n') || '- nenhuma'}
Julgamento de memoria:
${memoryLines || '- nenhuma memoria usada'}
Riscos de resposta ruim:
${result.frame.riskOfBadResponse.map((item) => `- ${item}`).join('\n')}

PLANO DE RESPOSTA (USO INTERNO - NAO MOSTRAR):
Modo: ${result.responsePlan.responseMode}
Tom: ${result.responsePlan.tone}
Leitura em uma frase: ${result.responsePlan.oneSentenceReading}
Movimento final permitido: ${result.responsePlan.finalMove}
Precisa mencionar: ${result.responsePlan.mustMention.join(' | ') || 'nada obrigatorio'}
Precisa evitar: ${result.responsePlan.mustAvoid.join(' | ')}
Fonte permitida da acao: ${result.responsePlan.allowedActionSource}
Regra: a fala final deve obedecer este plano. Se houver baixa confianca, pergunte curto. Se houver memoria rejeitada, nao use. Se houver acao, entregue uma acao principal.`;
  }
}
