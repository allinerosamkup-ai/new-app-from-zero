export type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'crisis';
export type RiskRoute = 'self_support' | 'adapt_day' | 'human_support' | 'crisis_protocol';

export type RiskSafety = {
  riskLevel: RiskLevel;
  signals: string[];
  route: RiskRoute;
  message: string;
};

const CRISIS_PATTERNS = [
  /\b(me\s+)?matar\b/i,
  /\bsuic[ií]dio\b/i,
  /\bautoagress[aã]o\b/i,
  /\bme\s+cortar\b/i,
  /\bn[aã]o\s+quero\s+mais\s+viver\b/i,
  /\bquero\s+sumir\s+para\s+sempre\b/i,
];

const HIGH_PATTERNS = [
  /\bdesesperan[çc]a\b/i,
  /\bsem\s+sa[ií]da\b/i,
  /\bperdi\s+o\s+controle\b/i,
  /\bn[aã]o\s+aguento\s+mais\b/i,
  /\bviol[eê]ncia\b/i,
  /\babuso\b/i,
];

const MODERATE_PATTERNS = [
  /\bcrise\b/i,
  /\bcolapso\b/i,
  /\bp[aâ]nico\b/i,
  /\bdepress[aã]o\b/i,
  /\bmania\b/i,
  /\bhipomania\b/i,
  /\bins[oô]nia\b/i,
];

function matchSignals(text: string, patterns: RegExp[], label: string): string[] {
  return patterns.filter((pattern) => pattern.test(text)).map(() => label);
}

export function assessRiskSafety(input: {
  text?: string | null;
  moodScore?: number | null;
  energyScore?: number | null;
  sleepScore?: number | null;
  irritabilityScore?: number | null;
}): RiskSafety {
  const text = input.text ?? '';
  const signals = [
    ...matchSignals(text, CRISIS_PATTERNS, 'linguagem de crise ou autoagressao'),
    ...matchSignals(text, HIGH_PATTERNS, 'sofrimento intenso ou risco contextual'),
    ...matchSignals(text, MODERATE_PATTERNS, 'sinal de desregulacao emocional'),
  ];

  const veryLowMood = typeof input.moodScore === 'number' && input.moodScore <= 2;
  const veryLowEnergy = typeof input.energyScore === 'number' && input.energyScore <= 2;
  const poorSleep = typeof input.sleepScore === 'number' && input.sleepScore <= 2;
  const highIrritability = typeof input.irritabilityScore === 'number' && input.irritabilityScore >= 9;

  if (veryLowMood && veryLowEnergy) signals.push('humor e energia muito baixos');
  if (poorSleep) signals.push('sono muito baixo');
  if (highIrritability) signals.push('irritabilidade muito alta');

  if (CRISIS_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      riskLevel: 'crisis',
      signals: Array.from(new Set(signals)),
      route: 'crisis_protocol',
      message: 'A Airia deve interromper recomendacoes comuns e mostrar recursos de crise e contato humano.',
    };
  }

  if (HIGH_PATTERNS.some((pattern) => pattern.test(text)) || (veryLowMood && veryLowEnergy && poorSleep)) {
    return {
      riskLevel: 'high',
      signals: Array.from(new Set(signals)),
      route: 'human_support',
      message: 'A Airia deve sugerir apoio humano e reduzir carga do dia, sem diagnosticar.',
    };
  }

  if (MODERATE_PATTERNS.some((pattern) => pattern.test(text)) || veryLowMood || (highIrritability && (veryLowEnergy || poorSleep))) {
    return {
      riskLevel: 'moderate',
      signals: Array.from(new Set(signals)),
      route: 'adapt_day',
      message: 'A Airia deve priorizar ajuste de agenda, protecao de energia e observacao do padrao.',
    };
  }

  if (highIrritability) {
    return {
      riskLevel: 'low',
      signals: Array.from(new Set(signals)),
      route: 'self_support',
      message: 'A irritabilidade merece contexto antes de qualquer alerta ou redução de agenda.',
    };
  }

  if (signals.length > 0 || veryLowEnergy || poorSleep) {
    return {
      riskLevel: 'low',
      signals: Array.from(new Set(signals)),
      route: 'adapt_day',
      message: 'A Airia pode oferecer autoapoio pratico e adaptacao leve do dia.',
    };
  }

  return {
    riskLevel: 'none',
    signals: [],
    route: 'self_support',
    message: 'Sem sinal critico detectado; seguir com suporte funcional e agenda adaptativa.',
  };
}

export function riskSafetyPromptPolicy(riskSafety: RiskSafety): string {
  return [
    'POLITICA DE SEGURANCA CLINICA:',
    '- Airia nao diagnostica, nao prescreve, nao promete cura e nao substitui psicologa, psiquiatra ou emergencia.',
    '- Se houver crise ou autoagressao, interrompa coaching comum e oriente busca de ajuda humana/emergencial.',
    '- Evite linguagem de terapeuta falsa; posicione como assistente de humor, energia e agenda adaptativa.',
    `- Classificacao atual: ${riskSafety.riskLevel}; rota: ${riskSafety.route}; sinais: ${riskSafety.signals.join(', ') || 'nenhum'}.`,
  ].join('\n');
}
