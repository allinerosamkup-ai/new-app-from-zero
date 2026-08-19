import { inferCapacity } from '../lib/capacity';

import type { DailyContext } from './context-grounding.service';
import { DecisionEngine, type DecisionCandidate, type DecisionResult, type DecisionSurface } from './decision-engine.service';

export type ReasoningConfidence = 'alta' | 'media' | 'baixa';
export type ReasoningCapacity = 'alta' | 'media' | 'baixa' | 'protecao';
export type ReasoningDecisionType = 'acao' | 'pergunta' | 'acolhimento' | 'adaptar_agenda';

export type ReasoningTrace = {
  surface: DecisionSurface;
  localDate: string;
  evidence: string[];
  hypothesis: string;
  capacity: ReasoningCapacity;
  decision: {
    type: ReasoningDecisionType;
    title: string;
    targetId?: string | null;
    targetType?: string | null;
    action?: string | null;
  };
  why: string;
  confidence: ReasoningConfidence;
};

export type ReasoningContextInput = {
  dailyContext: DailyContext;
  surface: DecisionSurface;
  requestContext?: Record<string, unknown>;
  currentMessage?: string | null;
  situationSummary?: string | null;
  ragContext?: string | null;
  decisionBrain?: DecisionResult | null;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function listPreview(values: string[], limit = 3): string {
  return values.slice(0, limit).join(' | ');
}

function localClock(context: Record<string, unknown>): string | null {
  const hour = numberValue(context.currentHour ?? context.hour);
  const minute = numberValue(context.currentMinute ?? context.minute ?? 0);
  if (hour === null || minute === null) return null;
  const safeHour = Math.max(0, Math.min(23, Math.floor(hour)));
  const safeMinute = Math.max(0, Math.min(59, Math.floor(minute)));
  return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
}

function phaseText(context: Record<string, unknown>): string {
  return cleanText(context.phase ?? context.phaseLabel ?? context.moodPhase);
}

/**
 * A inferência de capacidade agora mora em `lib/capacity.ts`, uma implementação
 * só para o app inteiro. Esta função ficou como adaptador: traduz o formato
 * desta superfície para o contrato canônico.
 *
 * Uma conflação do código original é preservada de propósito: `sleepScore` do
 * check-in (declarado) entra como sinal decisivo, junto com o do Health Connect
 * (medido). Separar os dois aqui deixaria o app *menos* protetor com quem
 * relata ter dormido mal, e reduzir proteção não é efeito colateral aceitável
 * de uma unificação.
 */
function inferReasoningCapacity(context: DailyContext, requestContext: Record<string, unknown>): ReasoningCapacity {
  return inferCapacity({
    energyScore: numberValue(requestContext.energyScore ?? requestContext.energy),
    moodScore: numberValue(requestContext.moodScore ?? requestContext.mood),
    phaseLabel: phaseText(requestContext) || null,
    measuredSleepScore: numberValue(requestContext.sleepScore ?? context.healthSignals?.sleepScore),
    measuredSleepMinutes: numberValue(context.healthSignals?.sleepMinutes),
  }).level;
}

function confidenceFromDecision(decisionBrain: DecisionResult, action: DecisionCandidate | null, hasCurrentFact: boolean): ReasoningConfidence {
  const raw = action?.confidence ?? decisionBrain.confidence;
  if (!hasCurrentFact && !action) return 'baixa';
  if (raw >= 0.8) return 'alta';
  if (raw >= 0.62) return 'media';
  return 'baixa';
}

function hasOperationalAnchor(candidate: DecisionCandidate, context: DailyContext): boolean {
  if (candidate.kind === 'insight_only') return false;
  if (candidate.source === 'request') return Boolean(cleanText(candidate.anchor));
  if (candidate.source !== 'goal') return false;
  if (!candidate.targetId && !cleanText(candidate.anchor)) return false;
  return context.todayAnchorTitles.some((title) => cleanText(candidate.anchor) === title || candidate.title.includes(title));
}

function chooseAction(decisionBrain: DecisionResult, capacity: ReasoningCapacity, context: DailyContext): DecisionCandidate | null {
  const actionable = decisionBrain.allowedActions.filter((item) => hasOperationalAnchor(item, context));
  const changing = actionable.find((item) => item.action !== 'keep');
  if (changing) return changing;
  if (capacity === 'protecao') return actionable.find((item) => item.targetType === 'goal') ?? null;
  return actionable[0] ?? null;
}

function buildEvidence(input: ReasoningContextInput, decisionBrain: DecisionResult): string[] {
  const requestContext = input.requestContext ?? {};
  const evidence: string[] = [];
  const clock = localClock(requestContext);
  const message = cleanText(input.currentMessage);
  const situation = cleanText(input.situationSummary);
  const phase = phaseText(requestContext);

  if (message) evidence.push(`Fato atual/relato: ${message.slice(0, 180)}`);
  if (situation) evidence.push(`Situacao entendida: ${situation.slice(0, 180)}`);
  if (clock) evidence.push(`Horario local: ${clock}`);
  if (phase) evidence.push(`Fase/ritmo informado: ${phase}`);
  if (input.dailyContext.healthSignals) {
    const signals = input.dailyContext.healthSignals;
    const parts = [
      signals.sleepMinutes != null ? `sono ${Math.round(signals.sleepMinutes / 60 * 10) / 10}h` : '',
      signals.sleepScore != null ? `sono score ${signals.sleepScore}` : '',
      signals.steps != null ? `${Math.round(signals.steps)} passos` : '',
      signals.avgHeartRate != null ? `${Math.round(signals.avgHeartRate)} bpm` : '',
    ].filter(Boolean);
    if (parts.length) evidence.push(`Sinais corporais: ${parts.join(', ')}`);
  }
  if (input.dailyContext.activeGoalTitles.length) evidence.push(`Metas ativas: ${listPreview(input.dailyContext.activeGoalTitles)}`);
  if (input.dailyContext.completedSubgoalTitles.length) evidence.push(`Ações de Objetivo já concluídas: ${listPreview(input.dailyContext.completedSubgoalTitles)}`);
  if (input.dailyContext.blockedActionTitles.length || decisionBrain.blockedActions.length) {
    evidence.push(`Bloqueios/repeticoes: ${listPreview([...input.dailyContext.blockedActionTitles, ...decisionBrain.blockedActions.map((item) => item.title)])}`);
  }
  if (cleanText(input.ragContext) || cleanText(input.dailyContext.patternMemoryContext)) {
    evidence.push('Memorias RAG presentes: usar como padrao/contexto, nao como tarefa nova.');
  }

  return evidence.length ? evidence.slice(0, 9) : ['Sem evidencia atual suficiente alem do pedido imediato.'];
}

function buildHypothesis(input: ReasoningContextInput, capacity: ReasoningCapacity, action: DecisionCandidate | null): string {
  if (action?.action === 'shrink' || action?.action === 'pause') return `O estado atual pede reduzir a ação concreta de Objetivo para preservar continuidade sem transformar o dia em cobrança.`;
  if (action?.targetType === 'goal') return `Existe Objetivo ativo com uma ação concreta que permite avançar sem inventar frente nova.`;
  if (capacity === 'protecao') return `A leitura sugere capacidade baixa; melhor proteger energia e fazer pergunta curta se faltar ancora.`;
  if (input.dailyContext.todayAnchorTitles.length === 0) return `Ha memoria ou conversa, mas pouca ancora operacional atual para criar tarefa com seguranca.`;
  return `O melhor caminho e conectar o relato atual ao que ja existe no dia e escolher uma unica proxima decisao.`;
}

function decisionType(_surface: DecisionSurface, action: DecisionCandidate | null, hasAnchor: boolean, confidence: ReasoningConfidence): ReasoningDecisionType {
  if (!action || !hasAnchor || confidence === 'baixa') return 'pergunta';
  if (action.kind === 'insight_only') return 'acolhimento';
  return 'acao';
}

export class ReasoningContextService {
  static build(input: ReasoningContextInput): ReasoningTrace {
    const requestContext = input.requestContext ?? {};
    const decisionBrain = input.decisionBrain ?? DecisionEngine.evaluate({
      dailyContext: input.dailyContext,
      surface: input.surface,
      requestContext,
    });
    const capacity = inferReasoningCapacity(input.dailyContext, requestContext);
    const action = chooseAction(decisionBrain, capacity, input.dailyContext);
    const hasCurrentFact = Boolean(cleanText(input.currentMessage) || cleanText(input.situationSummary));
    const hasAnchor = Boolean(action && hasOperationalAnchor(action, input.dailyContext));
    const confidence = confidenceFromDecision(decisionBrain, action, hasCurrentFact || hasAnchor);
    const type = decisionType(input.surface, action, hasAnchor, confidence);
    const decisionAction = action?.action ?? null;
    const why = action?.bioReason || action?.reason || decisionBrain.reasoning;

    return {
      surface: input.surface,
      localDate: input.dailyContext.date,
      evidence: buildEvidence(input, decisionBrain),
      hypothesis: buildHypothesis(input, capacity, action),
      capacity,
      decision: {
        type,
        title: action?.title ?? (type === 'pergunta' ? 'Perguntar a ancora atual que falta' : 'Acolher sem criar tarefa'),
        targetId: action?.targetId ?? null,
        targetType: action?.targetType ?? null,
        action: decisionAction,
      },
      why,
      confidence,
    };
  }

  static formatForPrompt(trace: ReasoningTrace): string {
    const evidence = trace.evidence.map((item) => `- ${item}`).join('\n');
    return `RACIOCINIO OPERACIONAL ESTRUTURADO (USO INTERNO - NAO MOSTRAR):
Superficie: ${trace.surface}
Data: ${trace.localDate}
Evidencias:
${evidence}
Hipotese: ${trace.hypothesis}
Capacidade agora: ${trace.capacity}
Decisao: ${trace.decision.type} | ${trace.decision.title}${trace.decision.action ? ` | acao=${trace.decision.action}` : ''}${trace.decision.targetId ? ` | targetId=${trace.decision.targetId}` : ''}
Motivo curto: ${trace.why}
Confianca: ${trace.confidence}
Politica visivel: traduza a decisao em fala natural, amiga e pratica. Nao cite ReasoningTrace, evidencias internas, cadeia de pensamento ou nomes tecnicos. Se a confianca for baixa ou faltar ancora atual, faca uma pergunta curta em vez de inventar tarefa.`;
  }

  static buildForPrompt(input: ReasoningContextInput): { trace: ReasoningTrace; context: string } {
    const trace = ReasoningContextService.build(input);
    return {
      trace,
      context: ReasoningContextService.formatForPrompt(trace),
    };
  }
}
