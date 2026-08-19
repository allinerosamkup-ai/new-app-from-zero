import OpenAI from 'openai';
import { z } from 'zod';
import { buildAuraSystemPrompt, humanizeScore } from '../lib/aura-prompt';
import { splitFactors } from '../lib/checkin-factors';
import { getOpenAiModel, getOpenAiOutputLimit } from '../lib/openai-config';
import { isGroundingQuestion, validateVisibleConcreteAction } from '../lib/action-quality';
import { extractJsonValue } from '../lib/extract-json';
import { AiriaOperationalReasoningService, type AiriaActionPlan } from './airia-operational-reasoning.service';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) { return (getOpenAI() as any)[prop]; },
});

// Aprimorado conforme as novas especificações
export const CheckinStateSchema = z.object({
  stateLabel: z.string(), // Ex: "Dia sensível"
  stateLabelType: z.enum(['leve', 'moderado', 'sensível', 'crítico']),
  analysis: z.string(), // 1-2 frases do estado energético
  recommendations: z.array(z.string()), // Sugestões específicas
  suggestedIntensity: z.enum(['L', 'M', 'P']), // L=Leve, M=Médio, P=Pesado
  rationale: z.string(), // Explicação técnica interna da IA
});

export type CheckinState = z.infer<typeof CheckinStateSchema>;

const GENERIC_RECOMMENDATION_PATTERNS = [
  /\brespir(ar|e|acao|ação)\b/,
  /\bbeb(er|a)\s+(agua|água)\b/,
  /\bva\s+com\s+calma\b/,
  /\bvá\s+com\s+calma\b/,
  /\bum\s+passo\s+de\s+cada\s+vez\b/,
  /\borganizar\s+(o\s+)?dia\b/,
  /\bplanejar\s+(o\s+)?dia\b/,
  /\bescrev(a|er)\b/,
  /\banot(e|ar)\b/,
  /\bregistr(e|ar)\b/,
  /\btrein(o|ar)\b/,
  /\bkit(s)?\s+do\s+treino\b/,
];

const SIMILARITY_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'hoje', 'agora', 'fazer', 'abrir', 'ver', 'revisar', 'criar',
  'marcar', 'organizar', 'definir', 'separar', 'colocar', 'pegar', 'min', 'minutos',
]);

function extractClockFromCheckinSlot(checkinSlot?: string): string | null {
  const match = checkinSlot?.match(/-(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

function timeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function resolveNextRecommendationTime(currentLocalTime: string): string {
  const currentMinutes = timeToMinutes(currentLocalTime);
  if (currentMinutes === null) return '09:00';

  const roundedNext = Math.ceil((currentMinutes + 1) / 30) * 30;
  if (roundedNext <= 18 * 60) {
    return minutesToTime(roundedNext);
  }

  return '09:00';
}

function normalizeRecommendationText(value: unknown): string {
  return typeof value === 'string'
    ? value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    : '';
}

function tokenSet(value: unknown): Set<string> {
  return new Set(
    normalizeRecommendationText(value)
      .split(' ')
      .filter((token) => token.length >= 3 && !SIMILARITY_STOPWORDS.has(token)),
  );
}

function tokenOverlap(a: unknown, b: unknown): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }
  return common / Math.min(left.size, right.size);
}

function isSimilarRecommendation(a: unknown, b: unknown): boolean {
  const left = normalizeRecommendationText(a);
  const right = normalizeRecommendationText(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  return tokenOverlap(left, right) >= 0.58;
}

function isGenericRecommendation(recommendation: string, blockedTitles: string[]): boolean {
  const normalized = normalizeRecommendationText(recommendation);
  if (!normalized) return true;

  return GENERIC_RECOMMENDATION_PATTERNS.some((pattern) => {
    if (!pattern.test(normalized)) return false;
    if (/\btrein(o|ar)\b|\bkit(s)?\s+do\s+treino\b/.test(pattern.source)) {
      return blockedTitles.some((title) => /\btrein(o|ar|amento)\b/.test(normalizeRecommendationText(title)));
    }
    return true;
  });
}

function sanitizeRecommendationTimes(recommendations: string[], currentLocalTime: string | null): string[] {
  if (!currentLocalTime) {
    return recommendations;
  }

  const currentMinutes = timeToMinutes(currentLocalTime);
  if (currentMinutes === null) {
    return recommendations;
  }

  const nextAllowedTime = resolveNextRecommendationTime(currentLocalTime);
  const maxAllowedMinutes = Math.min(currentMinutes + 120, 18 * 60);
  const isAfterTodayWindow = currentMinutes >= 18 * 60;

  return recommendations.map((recommendation) =>
    recommendation.replace(/\b(?:[aà]s\s+)?(\d{1,2})[:h](\d{2})\b/gi, (_match, rawHours, rawMinutes) => {
      const hours = String(rawHours).padStart(2, '0');
      const parsedMinutes = timeToMinutes(`${hours}:${rawMinutes}`);
      if (
        parsedMinutes !== null &&
        parsedMinutes > currentMinutes &&
        parsedMinutes >= 6 * 60 &&
        parsedMinutes <= maxAllowedMinutes
      ) {
        return `${hours}:${rawMinutes}`;
      }

      return isAfterTodayWindow ? `amanhã às ${nextAllowedTime}` : nextAllowedTime;
    }).replace(/[aà]s\s+amanh[ãa]\s+[aà]s/gi, 'amanhã às'),
  );
}

function sanitizeRecommendations(
  recommendations: string[],
  currentLocalTime: string | null,
  blockedTitles: string[] = [],
): string[] {
  const timed = sanitizeRecommendationTimes(recommendations, currentLocalTime);
  const seen = new Set<string>();

  return timed
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((item) => {
      const key = normalizeRecommendationText(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      if (isGenericRecommendation(item, blockedTitles)) return false;
      if (blockedTitles.some((title) => isSimilarRecommendation(item, title))) return false;
      if (!isGroundingQuestion(item) && !validateVisibleConcreteAction(item).ok) return false;
      return true;
    })
    .slice(0, 3);
}

function fallbackCheckinState(input: {
  moodScore: number;
  energyScore: number;
  operationalRecommendation?: string | null;
  currentLocalTime: string | null;
  avoidRecommendationTitles?: string[] | null;
}): CheckinState {
  const sensitive = input.moodScore <= 3 || input.energyScore <= 3;
  const steady = input.moodScore >= 7 && input.energyScore >= 7;
  const suggestedIntensity = input.energyScore <= 3 ? 'L' : input.energyScore >= 8 ? 'P' : 'M';
  const stateLabel = sensitive ? 'ritmo mais baixo' : steady ? 'bom fôlego hoje' : 'ritmo possível';
  const analysis = sensitive
    ? 'Hoje pede um ritmo menor. Vale proteger sua energia e escolher apenas o que realmente cabe.'
    : steady
      ? 'Seu humor e sua energia dão espaço para seguir com uma frente de cada vez, sem acelerar além do necessário.'
      : 'O dia parece pedir um passo de cada vez, ajustando o tamanho das ações ao que você consegue sustentar agora.';

  return {
    stateLabel,
    stateLabelType: sensitive ? 'sensível' : steady ? 'leve' : 'moderado',
    analysis,
    recommendations: sanitizeRecommendations(
      input.operationalRecommendation ? [input.operationalRecommendation] : [],
      input.currentLocalTime,
      input.avoidRecommendationTitles ?? [],
    ).slice(0, 1),
    suggestedIntensity,
    rationale: 'Leitura proporcional gerada sem resposta estruturada do provedor.',
  };
}

export class CheckinService {
  private static readonly MODEL = getOpenAiModel();

  static async evaluateDayState(data: {
    checkinSlot?: string;
    moodScore: number;
    energyScore: number;
    clarityScore?: number | null;
    irritabilityScore?: number | null;
    physicalScore?: number | null;
    socialScore?: number | null;
    sleepScore?: number | null;
    note?: string;
    userName?: string;
    profileSummary?: string | null;
    moodCycleContext?: string | null;
    contextualMemory?: string | null;
    activeGoalsContext?: string | null;
    recentSuggestionMemory?: string | null;
    completionContext?: string | null;
    reasoningTraceContext?: string | null;
    airiaActionPlan?: AiriaActionPlan | null;
    operationalRecommendation?: string | null;
    avoidRecommendationTitles?: string[] | null;
    emotions?: string[];
    factors?: string[];
    plannerContext?: string | null;
    currentHour?: number;
    currentMinute?: number;
    phase?: string | null;
    warningFlags?: string[] | null;
    forecast7dSummary?: string | null;
    taskMomentum7d?: number | null;
    priorDiagnoses?: string[] | null;
  }, client: Pick<OpenAI, 'chat'> = openai): Promise<CheckinState> {
    const checkinMoment = data.checkinSlot?.split('-')[0] || 'não informado';
    const currentLocalTime = extractClockFromCheckinSlot(data.checkinSlot);

    const EMOTION_LABELS: Record<string, string> = {
      radiant: 'Radiante', calm: 'Calma', happy: 'Feliz', anxious: 'Ansiosa',
      tired: 'Cansada', focused: 'Focada', sad: 'Triste', angry: 'Irritada',
      stressed: 'Estressada', sensitive: 'Sensível', exhausted: 'Exausta', agitated: 'Agitada',
    };

    const { helped, weighed } = splitFactors(data.factors ?? []);
    const emotions = data.emotions ?? [];

    const emotionLine = emotions.length > 0
      ? `- Emoções relatadas: ${emotions.map(id => EMOTION_LABELS[id] ?? id).join(', ')}`
      : '';
    const negLine = weighed.length > 0 ? `- Fatores que pesaram: ${weighed.join(', ')}` : '';
    const posLine = helped.length > 0 ? `- Fatores que ajudaram: ${helped.join(', ')}` : '';
    const contextLines = [emotionLine, negLine, posLine].filter(Boolean).join('\n');
    const trimmedNote = data.note?.trim() ?? '';
    const noteLine = trimmedNote
      ? `- Nota escrita (SINAL PRIORITÁRIO - dê mais peso a isto do que a inferências genéricas dos números): "${trimmedNote}"`
      : '- Nota escrita: Nenhuma';

    const operationalPlanContext = data.airiaActionPlan
      ? AiriaOperationalReasoningService.formatForPrompt(data.airiaActionPlan)
      : '';
    const operationalRecommendation = data.operationalRecommendation?.trim()
      || (data.airiaActionPlan ? AiriaOperationalReasoningService.visibleSuggestion(data.airiaActionPlan) : '');

    const prompt = `Você lê o check-in e devolve uma leitura humana, precisa e proporcional ao que foi relatado.

DADOS DE HOJE:
- Momento: ${checkinMoment}
- Humor ${humanizeScore(data.moodScore, 'mood')}, energia ${humanizeScore(data.energyScore, 'energy')} e clareza ${humanizeScore(data.clarityScore, 'generic')}
- Irritabilidade ${humanizeScore(data.irritabilityScore, 'generic')}, estado físico ${humanizeScore(data.physicalScore, 'generic')}
- Social ${humanizeScore(data.socialScore, 'generic')} e sono ${humanizeScore(data.sleepScore, 'sleep')}
${noteLine}${contextLines ? `\n${contextLines}` : ''}

${data.activeGoalsContext ? `OBJETIVOS E AÇÕES ATIVAS:\n${data.activeGoalsContext}\n` : ''}
${data.contextualMemory ? `MEMÓRIAS RELEVANTES:\n${data.contextualMemory}\n` : ''}
${data.recentSuggestionMemory ? `${data.recentSuggestionMemory}\n` : ''}
${data.completionContext ? `JÁ FEITO / NÃO SUGERIR DE NOVO:\n${data.completionContext}\n` : ''}
${operationalPlanContext ? `${operationalPlanContext}\n` : ''}

POLÍTICA DE LEITURA:
- Não diagnostique. Responda em português do Brasil, com linguagem direta e não clínica.
- Leia nesta ordem: check-in e nota atual; emoções e fatores; histórico e memória quando existirem; Objetivos e ações pendentes; sugestões bloqueadas ou já concluídas.
- Histórico explica contexto, mas nunca autoriza criar uma tarefa. O Check-in calibra tamanho e urgência; não inventa destino operacional.
- A nota escrita tem prioridade. Se ela explica causa física ou situacional, diferencie capacidade baixa de piora emocional.
- "analysis" tem uma ou duas frases e cita uma nuance real, sem repetir números ou ecoar a nota.
- "stateLabel" é curto, humano e sóbrio. "rationale" é uma explicação interna curta, sem linguagem clínica pesada.

POLÍTICA DA RECOMENDAÇÃO:
- Retorne no máximo uma recomendação. Use somente uma ação pendente e concreta de Objetivo, uma ação explicitamente narrada na nota ou a ação validada no plano operacional. Planner, agenda e Hábitos estão desativados e nunca são fonte, destino ou sugestão.
- A recomendação não pode ser decidir o que fazer, organizar melhor, revisar uma pendência, escolher uma tarefa, separar uma decisão, respirar, beber água ou outra fórmula genérica.
- Quando houver ação, use EXATAMENTE este formato: "<verbo + objeto específico>. Pronto quando: <evidência observável>."
- Exemplo válido, somente se banco e saldo foram citados: "Abrir o app do banco e anotar o saldo atual. Pronto quando: o saldo estiver anotado."
- Nunca copie esse exemplo para contexto que não citou banco, app ou saldo.
- Se não existir objeto seguro para uma ação, a única recomendação é UMA pergunta curta para obter a âncora; não preencha o card com conselho vago.
- Não repita ação já concluída, rejeitada, adiada ou sugerida recentemente. Se houver horário explícito, ele deve ser posterior a ${currentLocalTime ?? 'agora'} e caber nas próximas duas horas; sem horário seguro, não use relógio.
- suggestedIntensity: 'L' para energia baixa/sensível, 'M' para equilibrada e 'P' para energia alta/focada.

JSON APENAS:
{"stateLabel":"...","stateLabelType":"leve|moderado|sensível|crítico","analysis":"...","recommendations":["Ação. Pronto quando: evidência."],"suggestedIntensity":"L|M|P","rationale":"..."}`;

    const request = {
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: buildAuraSystemPrompt({
            userName: data.userName,
            profileSummary: data.profileSummary,
            moodCycleContext: data.moodCycleContext,
            contextualMemory: data.contextualMemory,
            activeGoalsContext: data.activeGoalsContext,
            plannerContext: data.plannerContext,
            recentSuggestionMemory: data.recentSuggestionMemory,
            reasoningTraceContext: [data.reasoningTraceContext, operationalPlanContext].filter(Boolean).join('\n\n'),
            currentHour: data.currentHour,
            currentMinute: data.currentMinute,
            phase: data.phase,
            warningFlags: data.warningFlags,
            forecast7dSummary: data.forecast7dSummary,
            taskMomentum7d: data.taskMomentum7d,
            priorDiagnoses: data.priorDiagnoses,
            domain: 'checkin',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      ...getOpenAiOutputLimit(this.MODEL, 1200),
    } as const;
    const fallback = () => fallbackCheckinState({
      moodScore: data.moodScore,
      energyScore: data.energyScore,
      operationalRecommendation,
      currentLocalTime,
      avoidRecommendationTitles: data.avoidRecommendationTitles,
    });

    try {
      const response = await client.chat.completions.create(request as any);
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[checkin] provedor não devolveu estado estruturado; usando leitura proporcional');
        return fallback();
      }

      const parsed = CheckinStateSchema.parse(extractJsonValue(content));
      return {
        ...parsed,
        recommendations: sanitizeRecommendations(
          operationalRecommendation ? [operationalRecommendation] : parsed.recommendations,
          currentLocalTime,
          data.avoidRecommendationTitles ?? [],
        ).slice(0, 1),
      };
    } catch {
      console.warn('[checkin] falha ao gerar estado estruturado; usando leitura proporcional');
      return fallback();
    }
  }
}
