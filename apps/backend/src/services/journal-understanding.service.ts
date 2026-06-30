import type { DailyContext } from './context-grounding.service';

export type JournalSituationModel = {
  currentMessage: string;
  localDate?: string | null;
  temporalFrame: 'past' | 'today' | 'future' | 'unclear';
  temporalEvidence: string[];
  factualAnchors: string[];
  emotionalSignals: string[];
  interpretationSignals: string[];
  decisionSignals: string[];
  topics: string[];
  retrievalQueries: string[];
  summary: string;
};

export type JournalMemoryCandidate = {
  contentType?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  similarity?: number | null;
  createdAt?: Date | string | null;
  contentId?: string | null;
};

export type JournalMemoryCriticResult<T extends JournalMemoryCandidate> = {
  accepted: T[];
  rejected: Array<{ memory: T; reason: string }>;
};

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'eu', 'me', 'mim', 'minha', 'meu', 'minhas', 'meus', 'hoje',
  'agora', 'ontem', 'amanha', 'amanhã', 'foi', 'era', 'estou', 'tava', 'estava',
  'isso', 'aquilo', 'porque', 'entao', 'então', 'sobre', 'muito', 'mais',
]);

const EMOTION_WORDS = [
  'ansiosa', 'ansioso', 'ansiedade', 'irritada', 'irritado', 'raiva', 'triste',
  'tristeza', 'medo', 'culpa', 'alívio', 'alivio', 'cansada', 'cansado',
  'exausta', 'exausto', 'frustrada', 'frustrado', 'confusa', 'confuso',
  'travada', 'travado', 'pressionada', 'pressionado',
];

const INTERPRETATION_PATTERNS = [
  /\bach(o|ei|ando)\b/i,
  /\bparece\b/i,
  /\btalvez\b/i,
  /\bsinto que\b/i,
  /\bna minha cabeça\b/i,
  /\bfiquei pensando\b/i,
  /\bmedo de\b/i,
];

const DECISION_PATTERNS = [
  /\bpreciso\b/i,
  /\bdevo\b/i,
  /\bvou\b/i,
  /\bdecidir\b/i,
  /\bescolher\b/i,
  /\bresolver\b/i,
  /\bmandar\b/i,
  /\bligar\b/i,
  /\badiar\b/i,
  /\breagendar\b/i,
];

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalize(value: unknown): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenList(value: unknown): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    const key = normalize(text);
    if (!text || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function tokenOverlap(left: unknown, right: unknown): number {
  const a = new Set(tokenList(left));
  const b = new Set(tokenList(right));
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) {
    if (b.has(token)) common += 1;
  }
  return common / Math.min(a.size, b.size);
}

function isSimilar(left: unknown, right: unknown): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return tokenOverlap(a, b) >= 0.55;
}

function extractQuotedOrCapitalized(text: string): string[] {
  const quoted = [...text.matchAll(/[“"']([^“"']{3,80})[”"']/g)].map((match) => match[1]);
  const capitalized = [...text.matchAll(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ]{2,}){0,3}/g)]
    .map((match) => match[0])
    .filter((item) => !/^(Eu|Você|Hoje|Ontem|Amanhã|Diário|Aura|Ayan)$/.test(item));
  return unique([...quoted, ...capitalized]).slice(0, 8);
}

function inferTemporalFrame(message: string): Pick<JournalSituationModel, 'temporalFrame' | 'temporalEvidence'> {
  const key = normalize(message);
  const temporalEvidence: string[] = [];
  if (/\bontem\b|\bdia anterior\b|\bfoi ontem\b/.test(key)) temporalEvidence.push('A pessoa localizou o fato no passado/ontem.');
  if (/\bhoje\b|\bagora\b|\bneste momento\b/.test(key)) temporalEvidence.push('A pessoa localizou parte do relato em hoje/agora.');
  if (/\bamanha\b|\bamanhã\b|\bdepois\b|\bproxima\b|\bpróxima\b/.test(key)) temporalEvidence.push('A pessoa mencionou futuro/próximo passo.');

  if (/\bontem\b|\bfoi ontem\b|\bera ontem\b|\baconteceu ontem\b/.test(key)) {
    return { temporalFrame: 'past', temporalEvidence };
  }
  if (/\bamanha\b|\bamanhã\b|\bproxima semana\b|\bpróxima semana\b/.test(key)) {
    return { temporalFrame: 'future', temporalEvidence };
  }
  if (/\bhoje\b|\bagora\b|\bnesse momento\b|\bneste momento\b/.test(key)) {
    return { temporalFrame: 'today', temporalEvidence };
  }
  return { temporalFrame: 'unclear', temporalEvidence };
}

function extractSignals(message: string, patterns: RegExp[]): string[] {
  return patterns
    .filter((pattern) => pattern.test(message))
    .map((pattern) => {
      const match = message.match(pattern);
      return match?.[0] ?? '';
    })
    .filter(Boolean);
}

function goalTitleFromMemory(memory: JournalMemoryCandidate): string {
  const content = cleanText(memory.content);
  const match = content.match(/(?:Meta|Objetivo):\s*([^\n.]+)/i);
  return cleanText(match?.[1]) || content.split('\n')[0] || '';
}

function memoryObjectiveId(memory: JournalMemoryCandidate): string | null {
  const metadata = memory.metadata ?? {};
  const fromMetadata = cleanText((metadata as Record<string, unknown>).objectiveId);
  return fromMetadata || cleanText(memory.contentId) || null;
}

export class JournalUnderstandingService {
  static buildSituation(input: {
    message: string;
    localDate?: string | null;
    recentSessionHistory?: string | null;
    latestCheckinNote?: string | null;
    activeGoalTitles?: string[];
    completedGoalTitles?: string[];
  }): JournalSituationModel {
    const message = cleanText(input.message);
    const temporal = inferTemporalFrame(message);
    const tokens = tokenList(message);
    const named = extractQuotedOrCapitalized(message);
    const activeGoalMatches = (input.activeGoalTitles ?? []).filter((title) => tokenOverlap(message, title) >= 0.35 || isSimilar(message, title));
    const completedGoalMatches = (input.completedGoalTitles ?? []).filter((title) => tokenOverlap(message, title) >= 0.35 || isSimilar(message, title));
    const topics = unique([
      ...named,
      ...activeGoalMatches,
      ...completedGoalMatches,
      ...tokens.slice(0, 12),
    ]).slice(0, 14);

    const emotionalSignals = EMOTION_WORDS.filter((word) => normalize(message).includes(normalize(word)));
    const interpretationSignals = extractSignals(message, INTERPRETATION_PATTERNS);
    const decisionSignals = extractSignals(message, DECISION_PATTERNS);
    const factualAnchors = unique([
      ...named,
      temporal.temporalFrame !== 'unclear' ? `cronologia: ${temporal.temporalFrame}` : '',
      ...activeGoalMatches.map((title) => `meta ativa mencionada: ${title}`),
      ...completedGoalMatches.map((title) => `meta concluída mencionada: ${title}`),
    ]);

    const coreQuery = topics.length ? topics.join(' ') : message;
    const retrievalQueries = unique([
      `${message}`,
      `diário análise contexto ${coreQuery}`,
      emotionalSignals.length ? `padrões emocionais ${emotionalSignals.join(' ')} ${coreQuery}` : '',
      decisionSignals.length ? `decisões recorrentes ${decisionSignals.join(' ')} ${coreQuery}` : '',
      temporal.temporalFrame !== 'unclear' ? `cronologia ${temporal.temporalFrame} ${coreQuery}` : '',
      input.recentSessionHistory ? `continuidade do diário ${coreQuery} ${input.recentSessionHistory.slice(0, 400)}` : '',
    ]).filter(Boolean).slice(0, 5);

    return {
      currentMessage: message,
      localDate: input.localDate ?? null,
      temporalFrame: temporal.temporalFrame,
      temporalEvidence: temporal.temporalEvidence,
      factualAnchors,
      emotionalSignals,
      interpretationSignals,
      decisionSignals,
      topics,
      retrievalQueries,
      summary: [
        `Assunto provável: ${topics.slice(0, 5).join(', ') || 'mensagem atual sem tema nomeado'}.`,
        `Cronologia: ${temporal.temporalFrame}.`,
        emotionalSignals.length ? `Emoções/sinais: ${emotionalSignals.join(', ')}.` : '',
        decisionSignals.length ? `Decisão/ação em jogo: ${decisionSignals.join(', ')}.` : '',
      ].filter(Boolean).join(' '),
    };
  }

  static filterMemories<T extends JournalMemoryCandidate>(input: {
    memories: T[];
    situation: JournalSituationModel;
    dailyContext?: DailyContext | null;
  }): JournalMemoryCriticResult<T> {
    const accepted: T[] = [];
    const rejected: Array<{ memory: T; reason: string }> = [];
    const topicText = [
      input.situation.currentMessage,
      input.situation.topics.join(' '),
      input.situation.factualAnchors.join(' '),
    ].join(' ');
    const completedGoals = input.dailyContext?.completedGoalTitles ?? [];
    const activeGoals = input.dailyContext?.activeGoalTitles ?? [];

    for (const memory of input.memories) {
      const content = cleanText(memory.content);
      if (!content) {
        rejected.push({ memory, reason: 'Memória vazia.' });
        continue;
      }

      const contentType = cleanText(memory.contentType).toLowerCase();
      const similarity = Number(memory.similarity ?? 0);
      const overlap = tokenOverlap(topicText, content);

      if (contentType === 'goal') {
        const title = goalTitleFromMemory(memory);
        const isCompleted = completedGoals.some((goal) => isSimilar(goal, title));
        const isActive = activeGoals.some((goal) => isSimilar(goal, title));
        const mentioned = tokenOverlap(input.situation.currentMessage, title) >= 0.25 || isSimilar(input.situation.currentMessage, title);
        if (isCompleted && !mentioned) {
          rejected.push({ memory, reason: 'Meta concluída não relacionada ao relato atual.' });
          continue;
        }
        if (!isActive && !mentioned) {
          rejected.push({ memory, reason: 'Meta não está ativa nem foi mencionada.' });
          continue;
        }
        if (overlap < 0.12 && !mentioned) {
          rejected.push({ memory, reason: 'Meta sem relação semântica suficiente com a mensagem.' });
          continue;
        }
      } else if (overlap < 0.08 && similarity < 0.72) {
        rejected.push({ memory, reason: 'Memória sem relação suficiente com a situação compreendida.' });
        continue;
      }

      accepted.push(memory);
    }

    return { accepted: accepted.slice(0, 8), rejected };
  }

  static formatSituationForPrompt(situation: JournalSituationModel, rejectedReasons: string[] = []): string {
    return [
      'SITUAÇÃO COMPREENDIDA ANTES DA RESPOSTA:',
      situation.summary,
      situation.temporalEvidence.length ? `Evidência temporal: ${situation.temporalEvidence.join(' ')}` : '',
      situation.factualAnchors.length ? `Âncoras factuais: ${situation.factualAnchors.join(' | ')}` : '',
      situation.interpretationSignals.length ? `Sinais de interpretação/história: ${situation.interpretationSignals.join(' | ')}` : '',
      situation.decisionSignals.length ? `Sinais de decisão/ação: ${situation.decisionSignals.join(' | ')}` : '',
      rejectedReasons.length ? `Memórias descartadas pelo crítico: ${unique(rejectedReasons).slice(0, 5).join(' | ')}` : '',
      'Regra: responda ao fato e à cronologia acima; memória descartada não pode aparecer na resposta.',
    ].filter(Boolean).join('\n');
  }

  static memoryObjectiveId(memory: JournalMemoryCandidate): string | null {
    return memoryObjectiveId(memory);
  }
}
