import type { DailyContext, GroundedTask } from './context-grounding.service';

export type DecisionSurface = 'home' | 'planner' | 'checkin' | 'journal' | 'aura-chat' | 'insights' | 'notification' | 'agenda';

export type DecisionKind =
  | 'real_commitment'
  | 'suggested_commitment'
  | 'insight_only'
  | 'blocked'
  | 'notification_allowed'
  | 'notification_blocked';

export type DecisionCandidateSource = 'timeline' | 'habit' | 'goal' | 'memory' | 'feedback' | 'system';

export type DecisionCandidate = {
  id: string;
  title: string;
  kind: DecisionKind;
  source: DecisionCandidateSource;
  action: 'keep' | 'move' | 'shrink' | 'pause' | 'suggest' | 'convert' | 'notify' | 'block' | 'insight';
  score: number;
  confidence: number;
  reason: string;
  anchor?: string | null;
  from?: string | null;
  to?: string | null;
  notificationAllowed: boolean;
  requiresConfirmation: boolean;
};

export type DecisionResult = {
  surface: DecisionSurface;
  date: string;
  allowedActions: DecisionCandidate[];
  blockedActions: DecisionCandidate[];
  dayPriorities: string[];
  reasoning: string;
  confidence: number;
  emptyReason: string | null;
};

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
  'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'sua', 'seu', 'suas', 'seus',
  'voce', 'você', 'hoje', 'agora', 'fazer', 'abrir', 'ver', 'revisar', 'criar',
  'marcar', 'organizar', 'definir', 'separar', 'colocar', 'pegar', 'min', 'minutos',
]);

const GENERIC_PATTERNS = [
  /\brespir(ar|e|acao|ação)\b/,
  /\bbeb(er|a)\s+(agua|água)\b/,
  /\borganizar\s+(o\s+)?dia\b/,
  /\bplanejar\s+(o\s+)?dia\b/,
  /\bproximo\s+passo\b/,
  /\bpróximo\s+passo\b/,
  /\btarefa\s+pequena\b/,
  /\banot(e|ar)\s+(uma\s+)?pend[eê]ncia\b/,
  /\bkit(s)?\s+(do\s+)?treino\b/,
  /\bsepar(ar|e)\s+(a\s+)?roupa\s+(de\s+)?treino\b/,
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

function tokenSet(value: unknown): Set<string> {
  return new Set(normalize(value).split(' ').filter((token) => token.length >= 3 && !STOPWORDS.has(token)));
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

function isSimilar(a: unknown, b: unknown): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  return tokenOverlap(left, right) >= 0.58;
}

function isGeneric(value: string): boolean {
  const key = normalize(value);
  if (!key) return true;
  return GENERIC_PATTERNS.some((pattern) => pattern.test(key));
}

function timeToMinutes(value: unknown): number | null {
  if (typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  return null;
}

function formatTime(value: unknown): string | null {
  const minutes = timeToMinutes(value);
  if (minutes === null) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function currentMinutes(context: Record<string, unknown>): number {
  const hour = Number(context.currentHour ?? context.hour ?? 9);
  const minute = Number(context.currentMinute ?? context.minute ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 9 * 60;
  return Math.max(0, Math.min(23 * 60 + 59, Math.round(hour) * 60 + Math.round(minute)));
}

function phaseKey(context: Record<string, unknown>): string {
  return normalize(context.phase ?? context.phaseLabel ?? context.moodPhase);
}

function isLowCapacityPhase(context: Record<string, unknown>): boolean {
  return /\b(turbulencia|pausa|recolhimento|desacelerando)\b/.test(phaseKey(context));
}

function isHighCapacityPhase(context: Record<string, unknown>): boolean {
  return /\b(voo alto|fluindo)\b/.test(phaseKey(context));
}

function isHeavy(task: GroundedTask): boolean {
  return task.intensity === 'P' || task.category === 'trabalho';
}

function blockedTitles(context: DailyContext): string[] {
  return [
    ...context.completedTaskTitles,
    ...context.completedHabitTitles,
    ...context.completedGoalTitles,
    ...context.completedSubgoalTitles,
    ...context.blockedActionTitles,
    ...context.recentSuggestionTitles,
  ];
}

function uniqueBlockedTitles(context: DailyContext): Array<{ title: string; source: DecisionCandidateSource; reason: string }> {
  const items = [
    ...context.completedTaskTitles.map((title) => ({ title, source: 'timeline' as const, reason: 'Tarefa já concluída hoje.' })),
    ...context.completedHabitTitles.map((title) => ({ title, source: 'habit' as const, reason: 'Hábito já concluído hoje.' })),
    ...context.completedGoalTitles.map((title) => ({ title, source: 'goal' as const, reason: 'Meta já concluída.' })),
    ...context.completedSubgoalTitles.map((title) => ({ title, source: 'goal' as const, reason: 'Subtarefa já concluída.' })),
    ...context.blockedActionTitles.map((title) => ({ title, source: 'feedback' as const, reason: 'Ação rejeitada, excluída ou marcada como feita no card.' })),
    ...context.recentSuggestionTitles.map((title) => ({ title, source: 'feedback' as const, reason: 'Sugestão recente; não deve voltar agora.' })),
  ];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isBlockedByHistory(title: string, context: DailyContext): boolean {
  return blockedTitles(context).some((blocked) => isSimilar(title, blocked));
}

function makeBlocked(input: {
  id: string;
  title: string;
  source: DecisionCandidateSource;
  reason: string;
  action?: DecisionCandidate['action'];
}): DecisionCandidate {
  return {
    id: input.id,
    title: input.title,
    kind: 'blocked',
    source: input.source,
    action: input.action ?? 'block',
    score: 0,
    confidence: 0.9,
    reason: input.reason,
    notificationAllowed: false,
    requiresConfirmation: false,
  };
}

function dedupeCandidates(candidates: DecisionCandidate[]): DecisionCandidate[] {
  const seen = new Set<string>();
  const out: DecisionCandidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const key = `${candidate.kind}:${normalize(candidate.title)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

export class DecisionEngine {
  static evaluate(input: {
    dailyContext: DailyContext;
    surface: DecisionSurface;
    requestContext?: Record<string, unknown>;
  }): DecisionResult {
    const requestContext = input.requestContext ?? {};
    const now = currentMinutes(requestContext);
    const lowCapacity = isLowCapacityPhase(requestContext);
    const highCapacity = isHighCapacityPhase(requestContext);
    const allowed: DecisionCandidate[] = [];
    const blocked: DecisionCandidate[] = [];

    for (const item of uniqueBlockedTitles(input.dailyContext)) {
      blocked.push(makeBlocked({
        id: `history:${normalize(item.title)}`,
        title: item.title,
        source: item.source,
        reason: item.reason,
      }));
    }

    for (const task of input.dailyContext.tasks) {
      const title = cleanText(task.title);
      if (!title) continue;
      const from = formatTime(task.startAt);
      const taskMinutes = timeToMinutes(task.startAt);
      if (task.status === 'completed') {
        blocked.push(makeBlocked({ id: `task:${normalize(title)}`, title, source: 'timeline', reason: 'Já está concluído hoje.' }));
        continue;
      }

      if (isBlockedByHistory(title, input.dailyContext)) {
        blocked.push(makeBlocked({ id: `task:${normalize(title)}`, title, source: 'timeline', reason: 'Já foi rejeitado, concluído ou sugerido recentemente.' }));
        continue;
      }

      const past = taskMinutes !== null && taskMinutes < now;
      const action = past ? 'move' : lowCapacity && isHeavy(task) ? 'pause' : 'keep';
      const score = 70 + (isHeavy(task) ? 8 : 4) + (past ? 10 : 0) - (lowCapacity && isHeavy(task) ? 5 : 0);
      allowed.push({
        id: `task:${normalize(title)}`,
        title,
        kind: 'real_commitment',
        source: 'timeline',
        action,
        score,
        confidence: past ? 0.82 : 0.88,
        reason: past
          ? 'Compromisso real pendente com horário já passado; precisa de revisão antes de continuar no dia.'
          : action === 'pause'
            ? 'Compromisso real pesado em fase de baixa capacidade; melhor pausar ou revisar escopo.'
            : 'Compromisso real do dia.',
        anchor: title,
        from,
        to: action === 'move' ? null : from,
        notificationAllowed: !past,
        requiresConfirmation: action !== 'keep',
      });
    }

    for (const title of input.dailyContext.pendingHabitTitles) {
      if (isBlockedByHistory(title, input.dailyContext) || isGeneric(title)) {
        blocked.push(makeBlocked({ id: `habit:${normalize(title)}`, title, source: 'habit', reason: 'Hábito já concluído/rejeitado recentemente ou genérico demais.' }));
        continue;
      }
      allowed.push({
        id: `habit:${normalize(title)}`,
        title,
        kind: 'real_commitment',
        source: 'habit',
        action: lowCapacity ? 'pause' : 'convert',
        score: lowCapacity ? 42 : 68,
        confidence: 0.76,
        reason: lowCapacity ? 'Hábito real devido hoje, mas fase pede reduzir atrito.' : 'Hábito real devido hoje; pode virar bloco opcional.',
        anchor: title,
        notificationAllowed: !lowCapacity,
        requiresConfirmation: true,
      });
    }

    const hasRealAgenda = input.dailyContext.pendingTaskTitles.length > 0;
    const openSuggestionSlots = allowed.filter((item) => item.kind !== 'blocked').length < (highCapacity ? 5 : 3);
    for (const goalTitle of input.dailyContext.activeGoalTitles) {
      if (!openSuggestionSlots) break;
      if (isBlockedByHistory(goalTitle, input.dailyContext)) {
        blocked.push(makeBlocked({ id: `goal:${normalize(goalTitle)}`, title: goalTitle, source: 'goal', reason: 'Meta ou ação parecida já foi bloqueada recentemente.' }));
        continue;
      }
      const score = (hasRealAgenda ? 52 : 62) + (highCapacity ? 12 : 0) - (lowCapacity ? 10 : 0);
      allowed.push({
        id: `goal:${normalize(goalTitle)}`,
        title: goalTitle,
        kind: 'suggested_commitment',
        source: 'goal',
        action: 'suggest',
        score,
        confidence: 0.68,
        reason: hasRealAgenda
          ? 'Meta ativa pode gerar bloco opcional se couber depois dos compromissos reais.'
          : 'Agenda sem pendências reais pode receber uma sugestão opcional ligada à meta ativa.',
        anchor: goalTitle,
        notificationAllowed: false,
        requiresConfirmation: true,
      });
    }

    if (allowed.length === 0) {
      allowed.push({
        id: 'insight:empty',
        title: 'Sem ação útil agora',
        kind: 'insight_only',
        source: 'system',
        action: 'insight',
        score: 10,
        confidence: 0.7,
        reason: 'Não há ação suficientemente ancorada no dia real.',
        notificationAllowed: false,
        requiresConfirmation: false,
      });
    }

    const allowedActions = dedupeCandidates(allowed)
      .filter((candidate) => candidate.kind !== 'blocked')
      .slice(0, input.surface === 'home' ? 3 : 8);
    const blockedActions = dedupeCandidates(blocked);
    const actionable = allowedActions.filter((candidate) => candidate.kind !== 'insight_only');
    const dayPriorities = actionable.slice(0, 3).map((candidate) => candidate.title);

    return {
      surface: input.surface,
      date: input.dailyContext.date,
      allowedActions,
      blockedActions,
      dayPriorities,
      reasoning: actionable.length
        ? 'Decisão baseada em compromissos reais, hábitos/metas ativos, fase, horário local e bloqueios de repetição.'
        : 'Nenhuma ação passou pelos critérios de âncora, horário e repetição.',
      confidence: actionable.length ? Math.round((actionable.reduce((sum, item) => sum + item.confidence, 0) / actionable.length) * 100) / 100 : 0.7,
      emptyReason: actionable.length ? null : 'Sem candidato operacional confiável; manter como insight.',
    };
  }
}
