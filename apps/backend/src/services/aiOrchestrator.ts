type SuggestFallback =
  | {
      stabilityScore: number;
      state: string;
      pattern: string;
      insight: string;
      actions: Array<{ title: string; category: string; why?: string }>;
    }
  | {
      motivacional: string;
      autocuidado: string[];
      proactive?: {
        emoji: string;
        title: string;
        desc: string;
        actionPath: string;
      };
    }
  | Array<{ title: string; category: string; time?: string }>
  | null;

export type LatestCheckinSignals = {
  emotions: string[];
  factors: string[];
  note?: string;
  moodScore?: number;
  energyScore?: number;
  sleepScore?: number;
  stateLabel?: string;
};

type GenerationConfig = {
  maxTokens: number;
  temperature: number;
  useJsonResponse: boolean;
};

const DEFAULT_FALLBACKS: Record<string, SuggestFallback> = {
  'stability-analysis': {
    stabilityScore: 50,
    state: 'stable',
    pattern: 'Sem leitura completa neste momento; mantendo observação contínua.',
    insight: 'Siga com passos leves e faça novo check-in mais tarde para refinar a análise.',
    actions: [],
  },
  'home-messages': {
    motivacional: 'Hoje vale escolher uma única prioridade real e começar por ela.',
    autocuidado: [
      '🌿 Respire por 1 minuto antes de agir.',
      '💧 Beba água e ajuste sua postura agora.',
      '📝 Defina o próximo passo em até 5 minutos.',
    ],
    proactive: {
      emoji: '🎯',
      title: 'Próximo passo',
      desc: 'Uma ação curta agora reduz atrito do restante do dia.',
      actionPath: '/planner',
    },
  },
  'day-tasks': [
    { title: 'Definir 1 prioridade de hoje (10 min)', category: 'rotina', time: '09:00' },
    { title: 'Executar primeiro bloco sem distração (25 min)', category: 'trabalho', time: '10:00' },
    { title: 'Pausa de recuperação com respiração (5 min)', category: 'saude', time: '11:30' },
  ],
};

export function buildUnifiedSuggestContext(args: {
  type: string;
  context: Record<string, unknown>;
  userName: string;
  moodCycleContext: string | null;
  userProfileSummary: string | null;
  longTermMemory: string | null;
  ragContext: string;
  latestCheckinSignals?: LatestCheckinSignals | null;
}) {
  const now = new Date();
  const hour = typeof args.context.hour === 'number' ? args.context.hour : now.getHours();
  const partOfDay =
    typeof args.context.partOfDay === 'string' && args.context.partOfDay.trim().length > 0
      ? args.context.partOfDay
      : hour < 12
        ? 'manhã'
        : hour < 18
          ? 'tarde'
          : 'noite';

  const seededEmotions = Array.isArray(args.context.emotions)
    ? args.context.emotions
    : args.latestCheckinSignals?.emotions ?? [];
  const seededFactors = Array.isArray(args.context.factors)
    ? args.context.factors
    : args.latestCheckinSignals?.factors ?? [];

  return {
    ...args.context,
    _orchestrator: {
      type: args.type,
      generatedAt: now.toISOString(),
      source: 'aiOrchestrator',
    },
    emotions: seededEmotions,
    factors: seededFactors,
    latestCheckinSignals: args.latestCheckinSignals ?? null,
    userName: args.userName,
    hour,
    partOfDay,
    moodCycleContext: args.context.moodCycleContext ?? args.moodCycleContext,
    userProfileSummary: args.context.userProfileSummary ?? args.userProfileSummary,
    longTermMemory: args.context.longTermMemory ?? args.longTermMemory,
    ragContext: args.ragContext,
  };
}

export function resolveSuggestGenerationConfig(type: string, plainText: boolean): GenerationConfig {
  const maxTokens =
    type === 'agenda-blocks'
      ? 700
      : type === 'home-messages'
        ? 400
        : type === 'gtd-clarify'
          ? 280
          : type === 'goal-route'
            ? 150
            : type === 'phase-transition'
              ? 200
              : type === 'follow-up'
                ? 150
                : type === 'monthly-report'
                  ? 600
                  : 300;

  const temperature =
    type === 'home-messages'
      ? 0.85
      : type === 'agenda-blocks'
        ? 0.9
        : plainText
          ? 0.7
          : 0.4;

  return {
    maxTokens,
    temperature,
    useJsonResponse: !plainText,
  };
}

export function getSuggestFallback(type: string): SuggestFallback {
  return DEFAULT_FALLBACKS[type] ?? null;
}
