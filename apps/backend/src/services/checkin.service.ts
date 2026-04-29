import OpenAI from 'openai';
import { z } from 'zod';
import { buildAuraSystemPrompt, humanizeScore } from '../lib/aura-prompt';
import { getOpenAiMaxCompletionTokens, getOpenAiModel } from '../lib/openai-config';

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
      return true;
    })
    .slice(0, 3);
}

export class CheckinService {
  private static readonly MODEL = getOpenAiModel();

  static async evaluateDayState(data: {
    checkinSlot?: string;
    moodScore: number;
    energyScore: number;
    clarityScore: number;
    irritabilityScore: number;
    physicalScore?: number;
    socialScore?: number;
    sleepScore?: number;
    note?: string;
    userName?: string;
    profileSummary?: string | null;
    moodCycleContext?: string | null;
    contextualMemory?: string | null;
    activeGoalsContext?: string | null;
    recentSuggestionMemory?: string | null;
    completionContext?: string | null;
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
  }, client: Pick<OpenAI, 'chat'> = openai): Promise<CheckinState> {
    const checkinMoment = data.checkinSlot?.split('-')[0] || 'não informado';
    const currentLocalTime = extractClockFromCheckinSlot(data.checkinSlot);

    const FACTOR_LABELS: Record<string, string> = {
      good_sleep: 'Sono bom', exercise: 'Exercício', healthy_meal: 'Alimentação saudável',
      fresh_air: 'Ar fresco', good_talk: 'Boa conversa', kind_words: 'Palavras gentis',
      support: 'Apoio recebido', small_win: 'Pequena vitória', finished_task: 'Tarefa concluída',
      feeling_valued: 'Me senti valorizada', music: 'Música', time_outside: 'Tempo ao ar livre',
      hobby: 'Hobby', self_trust: 'Confiança em mim', rest: 'Descanso',
      stuck: 'Travada/o', relationship_conflict: 'Briga no relacionamento',
      overwhelmed: 'Sobrecarga mental', loneliness: 'Solidão', bad_sleep: 'Sono ruim',
      work_pressure: 'Pressão no trabalho', financial_stress: 'Estresse financeiro', bad_news: 'Má notícia',
    };
    const NEGATIVE_IDS = new Set(['stuck','relationship_conflict','overwhelmed','loneliness','bad_sleep','work_pressure','financial_stress','bad_news']);
    const EMOTION_LABELS: Record<string, string> = {
      radiant: 'Radiante', calm: 'Calma', happy: 'Feliz', anxious: 'Ansiosa',
      tired: 'Cansada', focused: 'Focada', sad: 'Triste', angry: 'Irritada',
      stressed: 'Estressada', sensitive: 'Sensível', exhausted: 'Exausta', agitated: 'Agitada',
    };

    const allFactors = data.factors ?? [];
    const negFactors = allFactors.filter(id => NEGATIVE_IDS.has(id));
    const posFactors = allFactors.filter(id => !NEGATIVE_IDS.has(id));
    const emotions = data.emotions ?? [];

    const emotionLine = emotions.length > 0
      ? `- Emoções relatadas: ${emotions.map(id => EMOTION_LABELS[id] ?? id).join(', ')}`
      : '';
    const negLine = negFactors.length > 0
      ? `- Fatores que pesaram: ${negFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}`
      : '';
    const posLine = posFactors.length > 0
      ? `- Fatores que ajudaram: ${posFactors.map(id => FACTOR_LABELS[id] ?? id).join(', ')}`
      : '';
    const contextLines = [emotionLine, negLine, posLine].filter(Boolean).join('\n');
    const trimmedNote = data.note?.trim() ?? '';
    const noteLine = trimmedNote
      ? `- Nota escrita (SINAL PRIORITÁRIO - dê mais peso a isto do que a inferências genéricas dos números): "${trimmedNote}"`
      : '- Nota escrita: Nenhuma';

    const prompt = `
Analise os dados de check-in e retorne uma leitura humanizada, específica e útil.

DADOS:
- Momento: ${checkinMoment}
- Humor ${humanizeScore(data.moodScore, 'mood')}, energia ${humanizeScore(data.energyScore, 'energy')} e clareza ${humanizeScore(data.clarityScore, 'generic')}
- Irritabilidade ${humanizeScore(data.irritabilityScore, 'generic')}, estado físico ${humanizeScore(data.physicalScore, 'generic')}
- Social ${humanizeScore(data.socialScore, 'generic')} e sono ${humanizeScore(data.sleepScore, 'sleep')}
${noteLine}${contextLines ? `\n${contextLines}` : ''}

${data.plannerContext ? `${data.plannerContext}\n` : ''}
${data.activeGoalsContext ? `METAS ATIVAS:\n${data.activeGoalsContext}\n` : ''}
${data.contextualMemory ? `MEMÓRIAS RELEVANTES:\n${data.contextualMemory}\n` : ''}
${data.recentSuggestionMemory ? `${data.recentSuggestionMemory}\n` : ''}
${data.completionContext ? `JÁ FEITO / NÃO SUGERIR DE NOVO:\n${data.completionContext}\n` : ''}
DIRETRIZES:
- Nunca diagnósticos médicos. Linguagem acolhedora, não clínica. Português do Brasil.
- Se houver agenda hoje, leve em conta o peso e tipo de compromissos ao calibrar as recomendações e suggestedIntensity.
- Se houver memória, metas ou padrões anteriores no contexto, use-os para reconhecer repetição e decisões pendentes; se não houver evidência, não finja memória.
- Sempre cruze padrões, decisões e ciclos de humor: o que se repete, qual decisão está em jogo e que manobra o estado atual permite.
- stateLabel: nome curto, humano e sóbrio do estado; evite rótulos dramáticos.
- Antes de sugerir, separe internamente fato vs interpretação, movimento em curso, obstáculo, utilidade do obstáculo, custo oculto e menor ação útil.
- Se houver nota escrita, ela é o sinal de maior contexto: use a nota para reinterpretar humor, energia e sugestões antes de concluir qualquer padrão.
- Se a nota explicar uma causa física ou situacional concreta, como doença, dor, gripe, febre, menstruação, noite ruim ou crise externa, não trate energia baixa como piora emocional; diferencie capacidade baixa de humor ruim.
- analysis: 1-2 frases que leiam o momento sem repetir os números; se há nota, emoções ou fatores específicos, mencione a nuance concreta.
- recommendations: 2-3 micro-ações realmente executáveis nas próximas horas, diferentes entre si, sem clichês; se há nota escrita, pelo menos 1 ação deve responder diretamente ao que ela revelou.
- Se uma recomendação recente já cobriu a mesma ideia, escolha uma alternativa real. Se a repetição for a melhor opção, escreva como retomada explícita da sugestão anterior e acrescente um ajuste concreto.
- Não sugira treino, kit de treino, hábito, tarefa, meta ou subtarefa que já aparece como concluída hoje. Use concluídos como evidência de movimento, não como próxima ação.
- Se citar horário explícito, ele deve ser posterior a ${currentLocalTime ?? 'agora'} e caber nas próximas 2 horas; nunca use madrugada ou horário já passado.
- Se não houver um horário óbvio e válido, prefira escrever a ação sem relógio.
- suggestedIntensity: 'L' (energia baixa/sensível), 'M' (equilibrada), 'P' (energia alta/focada).
- rationale: explicação interna curta e técnica, sem linguagem clínica pesada.
- Evite frases genéricas como "vá com calma", "um passo de cada vez" ou "você consegue" sem contexto.
- Evite transformar tudo em somática. Respiração, corpo e água só entram se fizerem sentido com um sinal concreto; priorize ativação, exposição gradual, reorganização prática ou contenção conforme o estado.
- Se sono, corpo e energia estiverem baixos juntos, puxe para proteção e redução de carga.
- Se clareza estiver alta com energia boa, puxe para foco e estrutura.

JSON APENAS:
{"stateLabel":"...","stateLabelType":"leve|moderado|sensível|crítico","analysis":"...","recommendations":["..."],"suggestedIntensity":"L|M|P","rationale":"..."}
    `;

    const response = await client.chat.completions.create({
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
            currentHour: data.currentHour,
            currentMinute: data.currentMinute,
            phase: data.phase,
            warningFlags: data.warningFlags,
            forecast7dSummary: data.forecast7dSummary,
            taskMomentum7d: data.taskMomentum7d,
            domain: 'checkin',
          }),
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: getOpenAiMaxCompletionTokens(1200),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Falha ao gerar estado da IA');

    const parsed = CheckinStateSchema.parse(JSON.parse(content));
    return {
      ...parsed,
      recommendations: sanitizeRecommendations(
        parsed.recommendations,
        currentLocalTime,
        data.avoidRecommendationTitles ?? [],
      ),
    };
  }
}
