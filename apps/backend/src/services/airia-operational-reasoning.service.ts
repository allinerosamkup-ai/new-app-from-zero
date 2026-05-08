import type { DailyContext } from './context-grounding.service';
import { DecisionEngine, type DecisionCandidate, type DecisionResult, type DecisionSurface } from './decision-engine.service';
import { ReasoningContextService, type ReasoningTrace } from './reasoning-context.service';

export type AiriaDecisionType = 'act' | 'adapt_agenda' | 'ask_anchor' | 'reflect_only' | 'prepare_message';
export type AiriaBlocker = 'capacity' | 'disposition' | 'permission' | 'expectation' | 'overload' | 'unclear';
export type AiriaConfidence = 'alta' | 'media' | 'baixa';

export type AiriaActionPlan = {
  surface: DecisionSurface;
  localDate: string;
  reading: {
    fact: string;
    pattern: string;
    moodCyclePhase: string | null;
    blocker: AiriaBlocker;
    capacity: ReasoningTrace['capacity'];
  };
  decision: {
    type: AiriaDecisionType;
    confidence: AiriaConfidence;
    why: string;
  };
  action?: {
    title: string;
    actionType: DecisionCandidate['action'] | 'ask';
    source: DecisionCandidate['source'] | 'system';
    targetId?: string | null;
    targetType?: DecisionCandidate['targetType'];
    route?: '/planner' | '/checkin' | '/journal' | '/goals' | '/insights' | null;
    canBecomeTask: boolean;
    displayText: string;
  };
  visibleReason: string;
  blockedReasons: string[];
};

export type AiriaOperationalReasoningInput = {
  dailyContext: DailyContext;
  surface: DecisionSurface;
  requestContext?: Record<string, unknown>;
  currentMessage?: string | null;
  situationSummary?: string | null;
  ragContext?: string | null;
  decisionBrain?: DecisionResult | null;
  trace?: ReasoningTrace | null;
};

const WRITE_GENERIC_PATTERN = /\b(escrev(a|er)|anot(e|ar)|registr(e|ar)|liste|listar|di[aá]rio|journaling)\b/i;
const ALWAYS_GENERIC_PATTERNS = [
  /\brespir(ar|e|acao|ação|a[cç][aã]o)\b/i,
  /\bbeb(er|a)\s+(agua|água)\b/i,
  /\borganizar\s+(a\s+)?vida\b/i,
  /\bplanejar\s+(o\s+)?dia\b/i,
  /\bva\s+com\s+calma\b/i,
  /\bvá\s+com\s+calma\b/i,
  /\bum\s+passo\s+de\s+cada\s+vez\b/i,
  /\btarefa\s+pequena\b/i,
  /\bpr[oó]ximo\s+passo\b/i,
];

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function phaseText(context: Record<string, unknown>): string | null {
  return cleanText(context.phaseLabel) || cleanText(context.phase) || cleanText(context.moodPhase) || null;
}

function localClock(context: Record<string, unknown>): string | null {
  const hour = Number(context.currentHour ?? context.hour);
  const minute = Number(context.currentMinute ?? context.minute ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return `${String(Math.max(0, Math.min(23, Math.floor(hour)))).padStart(2, '0')}:${String(Math.max(0, Math.min(59, Math.floor(minute)))).padStart(2, '0')}`;
}

function isLate(context: Record<string, unknown>): boolean {
  const hour = Number(context.currentHour ?? context.hour);
  return Number.isFinite(hour) && hour >= 20;
}

function methodPatternFor(input: {
  trace: ReasoningTrace;
  action: DecisionCandidate | null;
  requestContext: Record<string, unknown>;
  dailyContext: DailyContext;
}): string {
  if (input.action?.targetType === 'timeline') return 'Há um compromisso real em jogo; a decisão útil é adaptar a agenda antes de abrir uma frente nova.';
  if (input.action?.targetType === 'habit') return 'Há um hábito real devido; a decisão é manter continuidade sem transformar o hábito em cobrança.';
  if (input.action?.targetType === 'goal') return 'Há uma meta ativa; a decisão é criar um avanço mínimo em vez de uma ideia solta.';
  if (input.dailyContext.patternMemoryContext || input.dailyContext.recentSuggestionTitles.length) {
    return 'O histórico explica padrão, mas ainda falta uma âncora atual para transformar isso em ação.';
  }
  if (input.trace.capacity === 'protecao') return 'O estado pede proteção de carga antes de qualquer avanço.';
  return 'O melhor raciocínio é escolher uma decisão pequena que transforme percepção em ação real.';
}

function blockerFor(trace: ReasoningTrace, requestContext: Record<string, unknown>): AiriaBlocker {
  if (trace.capacity === 'protecao') return 'overload';
  if (trace.capacity === 'baixa') return 'capacity';
  const phase = phaseText(requestContext) ?? '';
  if (/voo alto|fluindo/i.test(phase)) return 'expectation';
  if (trace.confidence === 'baixa') return 'unclear';
  return 'disposition';
}

function actionRoute(candidate: DecisionCandidate | null, surface: DecisionSurface): NonNullable<AiriaActionPlan['action']>['route'] {
  if (!candidate) return null;
  if (candidate.targetType === 'timeline') return '/planner';
  if (candidate.targetType === 'habit') return '/planner';
  if (candidate.targetType === 'goal') return '/goals';
  if (surface === 'journal') return '/journal';
  return '/planner';
}

function canUseWritingSuggestion(surface: DecisionSurface, message: string, candidate: DecisionCandidate | null): boolean {
  if (surface === 'journal') return true;
  if (surface === 'aura-chat' && /\b(mensagem|responder|texto|escrever para|mandar)\b/i.test(message)) return true;
  if (candidate?.action === 'suggest' && /\bmensagem|resposta|email|e-mail|whatsapp\b/i.test(candidate.title)) return true;
  return false;
}

function isForbiddenGeneric(text: string, surface: DecisionSurface, message: string, candidate: DecisionCandidate | null): boolean {
  if (ALWAYS_GENERIC_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (WRITE_GENERIC_PATTERN.test(text) && !canUseWritingSuggestion(surface, message, candidate)) return true;
  return false;
}

function durationFor(candidate: DecisionCandidate | null, trace: ReasoningTrace): string {
  if (trace.capacity === 'protecao') return '10 minutos';
  if (candidate?.targetType === 'goal' && trace.capacity === 'alta') return '40 minutos';
  if (candidate?.targetType === 'goal') return '25 minutos';
  if (candidate?.targetType === 'habit') return trace.capacity === 'baixa' ? '10 minutos' : '20 minutos';
  return '30 minutos';
}

function displayFor(candidate: DecisionCandidate, trace: ReasoningTrace): string {
  const title = candidate.title.replace(/\.$/, '');
  const start = candidate.suggestedStartTime;
  const end = candidate.suggestedEndTime;

  if (candidate.targetType === 'timeline') {
    if (candidate.action === 'move' && start && end) return `Mover "${title}" para ${start}-${end}.`;
    if (candidate.action === 'shrink') return `Reduzir "${title}" para 30 minutos e manter só o essencial.`;
    if (candidate.action === 'pause') return `Adiar "${title}" para amanhã e tirar essa cobrança de hoje.`;
    return `Fazer "${title}" como próximo bloco real do dia.`;
  }

  if (candidate.targetType === 'habit') {
    if (trace.capacity === 'protecao' || candidate.action === 'pause') {
      return `Fazer só a versão mínima de "${title}" por ${durationFor(candidate, trace)} ou pausar sem compensar hoje.`;
    }
    if (start && end) return `Encaixar "${title}" como bloco leve de ${start} a ${end}.`;
    return `Fazer "${title}" por ${durationFor(candidate, trace)} sem ampliar a tarefa.`;
  }

  if (candidate.targetType === 'goal') {
    if (start && end) return `Abrir um bloco de ${start} a ${end} para avançar em "${title}".`;
    return `Separar ${durationFor(candidate, trace)} para avançar só uma parte de "${title}".`;
  }

  return title;
}

function selectOperationalCandidate(decisionBrain: DecisionResult, trace: ReasoningTrace): DecisionCandidate | null {
  const actionable = decisionBrain.allowedActions
    .filter((item) => item.kind !== 'insight_only' && item.action !== 'block')
    .filter((item) => item.targetType === 'timeline' || item.targetType === 'habit' || item.targetType === 'goal');

  const priority = (candidate: DecisionCandidate) => {
    const target = candidate.targetType === 'timeline' ? 300 : candidate.targetType === 'habit' ? 200 : 100;
    const action = candidate.action !== 'keep' ? 40 : 0;
    const protection = trace.capacity === 'protecao' && candidate.targetType === 'goal' ? -80 : 0;
    return target + action + candidate.score + protection;
  };

  return actionable.sort((a, b) => priority(b) - priority(a))[0] ?? null;
}

function visibleReasonFor(candidate: DecisionCandidate | null, trace: ReasoningTrace, requestContext: Record<string, unknown>): string {
  const clock = localClock(requestContext);
  const phase = phaseText(requestContext);
  if (!candidate) return 'Falta uma âncora atual para sugerir algo sem inventar tarefa.';
  const base = candidate.bioReason || candidate.reason || trace.why;
  const phasePart = phase ? ` Ritmo de hoje: ${phase}.` : '';
  const timePart = clock ? ` Horário considerado: ${clock}.` : '';
  return `${base}${phasePart}${timePart}`.trim();
}

export class AiriaOperationalReasoningService {
  static build(input: AiriaOperationalReasoningInput): AiriaActionPlan {
    const requestContext = input.requestContext ?? {};
    const decisionBrain = input.decisionBrain ?? DecisionEngine.evaluate({
      dailyContext: input.dailyContext,
      surface: input.surface,
      requestContext,
    });
    const trace = input.trace ?? ReasoningContextService.build({
      dailyContext: input.dailyContext,
      surface: input.surface,
      requestContext,
      currentMessage: input.currentMessage,
      situationSummary: input.situationSummary,
      ragContext: input.ragContext,
      decisionBrain,
    });
    const message = [input.currentMessage, input.situationSummary].map(cleanText).filter(Boolean).join(' | ');
    const rawCandidate = selectOperationalCandidate(decisionBrain, trace);
    const blockedReasons = decisionBrain.blockedActions.map((item) => `${item.title}: ${item.reason}`).slice(0, 6);
    const displayText = rawCandidate ? displayFor(rawCandidate, trace) : '';
    const forbidden = rawCandidate ? isForbiddenGeneric(`${rawCandidate.title} ${displayText}`, input.surface, message, rawCandidate) : false;
    const lateHeavyGoal = rawCandidate?.targetType === 'goal' && isLate(requestContext);
    const candidate = forbidden || lateHeavyGoal ? null : rawCandidate;
    const confidence: AiriaConfidence = candidate ? trace.confidence : 'baixa';
    const needsAnchor = !candidate || trace.confidence === 'baixa';
    const decisionType: AiriaDecisionType = needsAnchor
      ? 'ask_anchor'
      : input.surface === 'planner' || input.surface === 'agenda'
        ? 'adapt_agenda'
        : 'act';
    const phase = phaseText(requestContext);
    const askText = input.surface === 'journal'
      ? 'Qual é o fato de hoje que você quer que a Airia use para te devolver uma direção prática?'
      : 'Qual é a única coisa real de hoje que mais precisa ser ajustada agora?';
    const finalDisplayText = candidate ? displayFor(candidate, trace) : askText;

    return {
      surface: input.surface,
      localDate: input.dailyContext.date,
      reading: {
        fact: cleanText(input.currentMessage) || cleanText(input.situationSummary) || 'Sem fato atual explícito.',
        pattern: methodPatternFor({ trace, action: candidate, requestContext, dailyContext: input.dailyContext }),
        moodCyclePhase: phase,
        blocker: blockerFor(trace, requestContext),
        capacity: trace.capacity,
      },
      decision: {
        type: decisionType,
        confidence,
        why: visibleReasonFor(candidate, trace, requestContext),
      },
      action: {
        title: candidate?.title ?? 'Perguntar a âncora atual',
        actionType: candidate?.action ?? 'ask',
        source: candidate?.source ?? 'system',
        targetId: candidate?.targetId ?? null,
        targetType: candidate?.targetType ?? 'system',
        route: actionRoute(candidate, input.surface),
        canBecomeTask: Boolean(candidate && (candidate.targetType === 'timeline' || candidate.targetType === 'habit' || candidate.targetType === 'goal')),
        displayText: finalDisplayText,
      },
      visibleReason: visibleReasonFor(candidate, trace, requestContext),
      blockedReasons,
    };
  }

  static visibleSuggestion(plan: AiriaActionPlan): string {
    return plan.action?.displayText ?? 'Qual é a única coisa real de hoje que mais precisa ser ajustada agora?';
  }

  static formatForPrompt(plan: AiriaActionPlan): string {
    return `PLANO OPERACIONAL DA AIRIA (USO INTERNO - NAO MOSTRAR):
Superficie: ${plan.surface}
Data: ${plan.localDate}
Fato atual: ${plan.reading.fact}
Padrao funcional: ${plan.reading.pattern}
Fase/ritmo: ${plan.reading.moodCyclePhase ?? 'nao informado'}
Bloqueio principal: ${plan.reading.blocker}
Capacidade: ${plan.reading.capacity}
Decisao: ${plan.decision.type}
Confianca: ${plan.decision.confidence}
Acao principal validada: ${plan.action?.displayText ?? 'nenhuma'}
Fonte da acao: ${plan.action?.source ?? 'system'}${plan.action?.targetId ? ` | targetId=${plan.action.targetId}` : ''}
Motivo visivel curto: ${plan.visibleReason}
Bloqueios aplicados: ${plan.blockedReasons.length ? plan.blockedReasons.join(' | ') : 'nenhum'}
Regra: a resposta visivel deve seguir esta decisao. Nao invente outra sugestao, nao gere lista solta e nao use escrever/anotar/registrar fora do Diario, mensagem pronta ou pedido explicito.`;
  }
}
