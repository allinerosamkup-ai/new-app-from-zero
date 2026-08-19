import type { DailyContext, GroundedTask } from './context-grounding.service';
import { inferCapacity, toDecisionFlags } from '../lib/capacity';
import { getPhaseWindow, slotTier, bestAvailableStart, phaseHasPeakOrFlow, normalizePhaseWindowKey } from '../lib/phase-time-windows';
import { isTimelineBlockProtected } from './planner.service';
import { normalizeObjectiveSubgoals } from '../lib/objective-subgoals';
import { validateConcreteAction } from '../lib/action-quality';

export type DecisionSurface = 'home' | 'planner' | 'checkin' | 'journal' | 'aura-chat' | 'insights' | 'notification' | 'agenda';

export type DecisionKind =
  | 'real_commitment'
  | 'suggested_commitment'
  | 'insight_only'
  | 'blocked'
  | 'notification_allowed'
  | 'notification_blocked';

/**
 * Classifies WHY an item is blocked or hard to act on.
 * Used internally to craft richer bioReason and front-end tone.
 *   capacidade  — no energy or time window for it (phase/health signals)
 *   disposicao  — energy exists but the same item has been skipped 2+ times (partial Regra do 3)
 *   permissao   — energy exists, item keeps reappearing without acceptance (3+ rejections)
 */
export type TravaType = 'capacidade' | 'disposicao' | 'permissao';

export type DecisionCandidateSource = 'timeline' | 'habit' | 'goal' | 'memory' | 'feedback' | 'request' | 'system';

export type DecisionCandidate = {
  id: string;
  title: string;
  kind: DecisionKind;
  source: DecisionCandidateSource;
  targetId?: string | null;
  targetType?: 'timeline' | 'habit' | 'goal' | 'system';
  action: 'keep' | 'move' | 'shrink' | 'pause' | 'suggest' | 'convert' | 'notify' | 'block' | 'insight';
  score: number;
  confidence: number;
  reason: string;
  anchor?: string | null;
  from?: string | null;
  to?: string | null;
  suggestedStartTime?: string | null;
  suggestedEndTime?: string | null;
  suggestedDate?: string | null;
  bioReason?: string;
  impactLabel?: 'reduz carga' | 'protege energia' | 'aproveita janela' | 'mantém ritmo';
  notificationAllowed: boolean;
  requiresConfirmation: boolean;
  travaType?: TravaType;
  doneWhen?: string | null;
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

function formatMinutesAsTime(total: number): string {
  const clamped = Math.max(7 * 60, Math.min(20 * 60, total));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function roundUpToStep(minutes: number, step = 15): number {
  return Math.ceil(minutes / step) * step;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the broadest usable window for the day given the current phase.
 * Phase-aware: uses PHASE_WINDOWS to find the outer bounds of all tiers.
 * Falls back to sensible defaults when no phase is known.
 */
function dayWindowFor(input: {
  lowCapacity: boolean;
  highCapacity: boolean;
  targetType: 'timeline' | 'habit' | 'goal';
  phaseKey?: string;
}): { start: number; end: number } {
  if (input.phaseKey) {
    const pw = getPhaseWindow(input.phaseKey);
    const allRanges = [...pw.peak, ...pw.flow, ...pw.maintenance];
    if (allRanges.length > 0) {
      const start = Math.min(...allRanges.map(([s]) => s));
      const end = Math.max(...allRanges.map(([, e]) => e));
      return { start, end };
    }
  }
  // Fallback (no phase context)
  if (input.targetType === 'habit') return input.lowCapacity ? { start: 11 * 60, end: 18 * 60 } : { start: 8 * 60, end: 19 * 60 };
  if (input.targetType === 'goal') return input.highCapacity ? { start: 9 * 60, end: 16 * 60 } : { start: 10 * 60, end: 18 * 60 };
  return input.lowCapacity ? { start: 10 * 60, end: 17 * 60 } : { start: 8 * 60, end: 19 * 60 };
}

function findAvailableSlot(input: {
  dateKey: string;
  tasks: GroundedTask[];
  now: number;
  duration: number;
  lowCapacity: boolean;
  highCapacity: boolean;
  targetType: 'timeline' | 'habit' | 'goal';
  phaseKey?: string;
  heavy?: boolean;
}): { date: string; start: string; end: string; isNextDay: boolean; tier: 'peak' | 'flow' | 'maintenance' | 'rest' } {
  const window = dayWindowFor({ ...input });
  const busy = input.tasks
    .filter((task) => task.status !== 'completed')
    .map((task) => ({
      start: timeToMinutes(task.startAt),
      end: timeToMinutes(task.endAt),
    }))
    .filter((slot): slot is { start: number; end: number } => slot.start !== null && slot.end !== null && slot.end > slot.start);

  function trySlot(cursor: number): { date: string; start: string; end: string; isNextDay: boolean; tier: 'peak' | 'flow' | 'maintenance' | 'rest' } | null {
    const end = cursor + input.duration;
    if (end > window.end) return null;
    const conflict = busy.some((slot) => cursor < slot.end && end > slot.start);
    if (conflict) return null;
    const pw = input.phaseKey ? getPhaseWindow(input.phaseKey) : null;
    const tier = pw ? slotTier(cursor, pw) : 'maintenance';
    return { date: input.dateKey, start: formatMinutesAsTime(cursor), end: formatMinutesAsTime(end), isNextDay: false, tier };
  }

  // Phase-aware: for heavy tasks, try peak/flow windows first
  if (input.phaseKey && input.heavy) {
    const pw = getPhaseWindow(input.phaseKey);
    const preferredRanges = [...pw.peak, ...pw.flow];
    for (const [rangeStart, rangeEnd] of preferredRanges) {
      const earliest = Math.max(rangeStart, roundUpToStep(input.now + 15, 15));
      for (let cursor = earliest; cursor + input.duration <= rangeEnd; cursor += 15) {
        const result = trySlot(cursor);
        if (result) return result;
      }
    }
  }

  // Fallback: iterate full day window
  const earliestToday = Math.max(window.start, roundUpToStep(input.now + 15, 15));
  for (let cursor = earliestToday; cursor + input.duration <= window.end; cursor += 15) {
    const result = trySlot(cursor);
    if (result) return result;
  }

  // Tomorrow fallback
  const pw = input.phaseKey ? getPhaseWindow(input.phaseKey) : null;
  const tomorrowStart = pw && (pw.peak.length > 0 || pw.flow.length > 0)
    ? Math.min(...[...pw.peak, ...pw.flow].map(([s]) => s))
    : input.lowCapacity ? 10 * 60 : 9 * 60;
  return {
    date: addDaysToDateKey(input.dateKey, 1),
    start: formatMinutesAsTime(tomorrowStart),
    end: formatMinutesAsTime(tomorrowStart + input.duration),
    isNextDay: true,
    tier: 'peak',
  };
}

function currentMinutes(context: Record<string, unknown>): number {
  const hour = Number(context.currentHour ?? context.hour ?? 9);
  const minute = Number(context.currentMinute ?? context.minute ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 9 * 60;
  return Math.max(0, Math.min(23 * 60 + 59, Math.round(hour) * 60 + Math.round(minute)));
}

function phaseKey(context: Record<string, unknown>): string {
  return normalizePhaseWindowKey(normalize(context.phase ?? context.phaseLabel ?? context.moodPhase));
}

function numberOrNullValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function healthReasonSuffix(context: DailyContext): string {
  const signals = context.healthSignals;
  if (!signals) return '';
  const parts: string[] = [];
  if (signals.sleepMinutes != null) {
    const hours = Math.round((signals.sleepMinutes / 60) * 10) / 10;
    parts.push(`sono medido de ${hours}h`);
  }
  if (signals.steps != null) parts.push(`${Math.round(signals.steps)} passos`);
  if (signals.avgHeartRate != null) parts.push(`batimento medio ${Math.round(signals.avgHeartRate)} bpm`);
  if (signals.exerciseMinutes != null && signals.exerciseMinutes > 0) parts.push(`${Math.round(signals.exerciseMinutes)} min de exercicio`);
  return parts.length ? ` Sinal do Health Connect: ${parts.join(', ')}.` : '';
}

/**
 * Counts how many times a title appears in recentSuggestionTitles (proxy for rejection count).
 * If a title is suggested repeatedly without acceptance it's likely a Regra do 3 pattern.
 */
function rejectionCount(title: string, context: DailyContext): number {
  return context.recentSuggestionTitles.filter((t) => isSimilar(t, title)).length;
}

/**
 * Classifies the type of block (trava) for a candidate.
 *   permissao  — 3+ rejections; energy is not the issue
 *   disposicao — 1–2 rejections; tentative avoidance
 *   capacidade — phase/health is the limiting factor
 */
function classifyTrava(
  title: string,
  context: DailyContext,
  lowCapacity: boolean,
): TravaType {
  const count = rejectionCount(title, context);
  if (count >= 3) return 'permissao';
  if (count >= 1) return 'disposicao';
  return lowCapacity ? 'capacidade' : 'capacidade';
}

/**
 * Builds a bioReason string that identifies the trava type, following
 * the Aliança Divergente principle of naming the smallest concrete obstacle.
 */
function buildTravaReason(
  title: string,
  travaType: TravaType,
  context: DailyContext,
  phaseNote: string,
  healthSuffix: string,
): string {
  const count = rejectionCount(title, context);
  switch (travaType) {
    case 'permissao':
      return `Você passou por ${title} ${count} vezes esta semana sem avançar. Sem julgamento — se quiser, posso sugerir uma versão de 10 minutos para hoje.${healthSuffix}`;
    case 'disposicao':
      return `${title} apareceu mais de uma vez na lista sem ser aceito. Pode não ser a hora certa — ou pode ser que o tamanho ainda está grande demais.${healthSuffix}`;
    default:
      return phaseNote
        ? `${phaseNote}${healthSuffix}`
        : `A fase atual pede menos carga; deixar este item para uma janela melhor protege o ritmo.${healthSuffix}`;
  }
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

function isBlockedByExactTarget(targetId: string | null | undefined, targetType: string, context: DailyContext): boolean {
  if (!targetId) return false;
  return Boolean(context.blockedActionTargetIds?.includes(targetId)
    || context.blockedActionCanonicalKeys?.includes(`${targetType}:${targetId}`));
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
    targetType: input.source === 'timeline' ? 'timeline' : input.source === 'habit' ? 'habit' : input.source === 'goal' ? 'goal' : 'system',
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
    const currentPhaseKey = phaseKey(requestContext);

    // Recalibration signal support (from /api/agenda/recalibrate)
    const recalibSignal = typeof requestContext.recalibrationSignal === 'string'
      ? requestContext.recalibrationSignal as string
      : null;
    const forceHard = recalibSignal === 'day_hard' || recalibSignal === 'energy_crash';
    const forceGreat = recalibSignal === 'day_great' || recalibSignal === 'hyperfocus';
    // TDAH + hyperfocus: profile reports ADHD and today's checkin has hyperfocusOccurred
    const adhdHyperfocusActive =
      requestContext.adhdProfile === true && requestContext.hyperfocusOccurred === true;
    const structureHyperfocus = recalibSignal === 'hyperfocus' || adhdHyperfocusActive;

    /**
     * Capacidade vem de `lib/capacity.ts`, a implementação única do app.
     *
     * O cálculo anterior era feito aqui com dois booleanos independentes, e
     * eles podiam ser verdadeiros ao mesmo tempo: quem estivesse em fase alta
     * com sono medido ruim ligava `lowCapacity` **e** `highCapacity` na mesma
     * avaliação, e como os dois são lidos em pontos diferentes deste motor, o
     * dia saía protegido num trecho e ampliado no outro. Com um nível só isso
     * deixa de ser representável, e o empate resolve protegendo.
     *
     * Os sinais passados são exatamente os que este motor sempre enxergou —
     * fase, sono medido e recalibração. Energia e humor entram por outras
     * superfícies; incluí-los aqui seria mudança de comportamento, não
     * unificação.
     */
    const capacity = inferCapacity({
      phaseLabel: String(requestContext.phase ?? requestContext.phaseLabel ?? requestContext.moodPhase ?? ''),
      measuredSleepScore: numberOrNullValue(input.dailyContext.healthSignals?.sleepScore),
      measuredSleepMinutes: numberOrNullValue(input.dailyContext.healthSignals?.sleepMinutes),
      recalibrationSignal: recalibSignal,
    });
    const { lowCapacity, highCapacity } = toDecisionFlags(capacity.level);

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

      if (isBlockedByExactTarget(task.id, 'timeline', input.dailyContext) || isBlockedByHistory(title, input.dailyContext)) {
        blocked.push(makeBlocked({ id: `task:${normalize(title)}`, title, source: 'timeline', reason: 'Já foi rejeitado, concluído ou sugerido recentemente.' }));
        continue;
      }

      const past = taskMinutes !== null && taskMinutes < now;
      const hardLowCapacity = /\b(pausa|recolhimento|turbulencia)\b/.test(currentPhaseKey);
      const protectedAnchor = isTimelineBlockProtected(task);

      // Phase-aware action: check if the task's slot falls in a 'rest' tier
      const pw = currentPhaseKey ? getPhaseWindow(currentPhaseKey) : null;
      const taskTier = pw && taskMinutes !== null ? slotTier(taskMinutes, pw) : null;
      const outOfWindow = taskTier === 'rest' && isHeavy(task);

      const action = protectedAnchor ? 'keep'
        : past ? 'move'
        : outOfWindow && hardLowCapacity ? 'pause'   // outside window in Turbulência/Pausa/Recolhimento → pause
        : outOfWindow && lowCapacity ? 'shrink'       // outside window with health-signal lowCapacity → shrink
        : outOfWindow ? 'move'                         // outside window otherwise → move to right window
        : lowCapacity && isHeavy(task) ? 'shrink'     // in window but low capacity + heavy → reduce scope
        : 'keep';

      const originalDuration = taskMinutes !== null && timeToMinutes(task.endAt) !== null
        ? Math.max(30, Math.min(90, (timeToMinutes(task.endAt) as number) - taskMinutes))
        : 45;
      const slot = findAvailableSlot({
        dateKey: input.dailyContext.date,
        tasks: input.dailyContext.tasks,
        now,
        duration: action === 'shrink' ? 30 : originalDuration,
        lowCapacity,
        highCapacity,
        targetType: 'timeline',
        phaseKey: currentPhaseKey || undefined,
        heavy: isHeavy(task),
      });

      // Phase-specific bioReason referencing the actual window
      const phaseNote = pw
        ? outOfWindow
          ? `A fase ${currentPhaseKey || 'atual'} tem janela melhor em ${slot.isNextDay ? 'amanhã às ' + slot.start : slot.start} — este bloco está fora da janela de energia do dia.`
          : action === 'pause' || action === 'shrink'
            ? `A fase ${currentPhaseKey || 'atual'} pede menor carga; ${action === 'shrink' ? 'reduzir duração mantém avanço' : 'pausar evita sobrecarga'}.`
            : ''
        : '';

      const score = 70 + (isHeavy(task) ? 8 : 4) + (past ? 10 : 0)
        - (lowCapacity && isHeavy(task) ? 5 : 0)
        - (outOfWindow ? 8 : 0)
        + (taskTier === 'peak' ? 15 : taskTier === 'flow' ? 8 : 0);

      allowed.push({
        id: `task:${normalize(title)}`,
        title,
        kind: 'real_commitment',
        source: 'timeline',
        targetId: task.id ?? null,
        targetType: 'timeline',
        action,
        score,
        confidence: past ? 0.82 : 0.88,
        reason: protectedAnchor
          ? 'Compromisso fixo ou protegido; a Airia preserva esta âncora e adapta apenas o restante do dia.'
          : past
          ? 'Compromisso real pendente com horário já passado; precisa de revisão antes de continuar no dia.'
          : action === 'pause'
            ? 'Compromisso real pesado em fase de baixa capacidade; melhor pausar ou revisar escopo.'
            : action === 'shrink'
              ? 'Compromisso real pesado em fase de baixa capacidade; melhor reduzir escopo.'
            : action === 'move' && outOfWindow
              ? 'Compromisso real pesado fora da janela de energia da fase atual; mover para o melhor horário disponível.'
            : 'Compromisso real do dia.',
        anchor: title,
        from,
        to: action === 'move' ? null : from,
        suggestedDate: action === 'move' ? slot.date : input.dailyContext.date,
        suggestedStartTime: action === 'move' ? slot.start : action === 'shrink' ? from : null,
        suggestedEndTime: action === 'move' ? slot.end : action === 'shrink' && from ? formatMinutesAsTime((taskMinutes ?? now) + 30) : null,
        bioReason: (protectedAnchor
          ? 'Este bloco é uma âncora protegida; horário e compromisso permanecem intactos.'
          : action === 'move'
          ? slot.isNextDay
            ? 'O horário já passou e não há janela limpa hoje; mover para amanhã protege o dia sem forçar encaixe ruim.'
            : phaseNote || 'O horário já passou; a Airia escolheu a próxima janela livre para manter continuidade sem fingir que ainda dá para cumprir no tempo antigo.'
          : phaseNote || (action === 'pause'
            ? 'A fase atual sinaliza menor capacidade; pausar evita transformar uma tarefa pesada em sobrecarga.'
            : action === 'shrink'
              ? 'A fase atual pede menos carga; reduzir duração mantém avanço sem forçar o dia.'
            : 'O bloco já combina com o ritmo atual e pode permanecer como está.')) + healthReasonSuffix(input.dailyContext),
        impactLabel: action === 'move' ? 'mantém ritmo' : action === 'pause' ? 'protege energia' : action === 'shrink' ? 'reduz carga' : 'mantém ritmo',
        notificationAllowed: !past,
        // A Airia ajusta sozinha o que é dela para ajustar. Âncora protegida
        // (consulta, buscar alguém, compromisso com terceiro) continua exigindo
        // aval humano: quebrar isso tem custo fora do app.
        requiresConfirmation: action !== 'keep' && protectedAnchor,
        travaType: action !== 'keep' ? 'capacidade' : undefined,
      });
    }

    for (const title of input.dailyContext.pendingHabitTitles) {
      const habitId = input.dailyContext.habits.find((habit) => habit.title === title)?.id ?? null;
      if (isBlockedByExactTarget(habitId, 'habit', input.dailyContext) || isBlockedByHistory(title, input.dailyContext) || isGeneric(title)) {
        blocked.push(makeBlocked({ id: `habit:${normalize(title)}`, title, source: 'habit', reason: 'Hábito já concluído/rejeitado recentemente ou genérico demais.' }));
        continue;
      }
      const trava = classifyTrava(title, input.dailyContext, lowCapacity);
      const slot = findAvailableSlot({
        dateKey: input.dailyContext.date,
        tasks: input.dailyContext.tasks,
        now,
        duration: lowCapacity ? 15 : 25,
        lowCapacity,
        highCapacity,
        targetType: 'habit',
        phaseKey: currentPhaseKey || undefined,
        heavy: false,
      });
      // Efeito paralelo boost: if all timeline candidates are blocked/paused in a low-capacity phase,
      // boost autocuidado habits as a displacement suggestion
      const isAutocuidado = /\b(exerc|caminh|medit|descanso|pausa|respir|alongar|beber|agua|sono|dormir)\b/i.test(title);
      const timelineAllPaused = allowed.filter((c) => c.source === 'timeline').every((c) => c.action === 'pause' || c.action === 'move');
      const efeitoParaleloBoost = lowCapacity && isAutocuidado && timelineAllPaused ? 20 : 0;
      const efeitoParaleloNote = efeitoParaleloBoost > 0
        ? ' Trabalho pesado está fora da janela de hoje — mas há espaço para este hábito agora, que costuma destravar o ritmo.'
        : '';

      allowed.push({
        id: `habit:${normalize(title)}`,
        title,
        kind: 'real_commitment',
        source: 'habit',
        targetId: habitId,
        targetType: 'habit',
        action: lowCapacity ? 'pause' : 'convert',
        score: (lowCapacity ? 42 : 68) + efeitoParaleloBoost,
        confidence: 0.76,
        reason: lowCapacity ? 'Hábito real devido hoje, mas fase pede reduzir atrito.' : 'Hábito real devido hoje; pode virar bloco opcional.',
        anchor: title,
        suggestedDate: lowCapacity ? null : slot.date,
        suggestedStartTime: lowCapacity ? null : slot.start,
        suggestedEndTime: lowCapacity ? null : slot.end,
        bioReason: buildTravaReason(
          title,
          trava,
          input.dailyContext,
          lowCapacity
            ? 'O hábito existe, mas o ritmo de hoje pede versão reduzida ou pausa consciente.'
            : 'O hábito está devido hoje e pode entrar como bloco leve, sem virar cobrança solta.',
          healthReasonSuffix(input.dailyContext) + efeitoParaleloNote,
        ),
        impactLabel: lowCapacity ? 'protege energia' : 'mantém ritmo',
        notificationAllowed: !lowCapacity,
        requiresConfirmation: false,
        travaType: trava,
      });
    }

    // structureHyperfocus: use existing goal actions instead of opening new fronts.
    const maxSuggestionSlots = forceHard ? 1 : structureHyperfocus ? 1 : (highCapacity ? 5 : 3);
    const openSuggestionSlots = allowed.some((item) => item.targetType === 'goal')
      || allowed.filter((item) => item.kind !== 'blocked').length < maxSuggestionSlots;

    for (const goal of input.dailyContext.goals.filter((item) => item.progress < 100)) {
      if (!openSuggestionSlots) break;
      const goalId = goal.id ?? null;
      const nextAction = normalizeObjectiveSubgoals(goal.subgoals).find((action) => (
        !action.done
        && action.status !== 'rejected'
        && action.status !== 'deferred'
        && validateConcreteAction(action).ok
      ));
      if (!nextAction) continue;
      const actionTitle = nextAction.title;
      if (isBlockedByExactTarget(goalId, 'goal', input.dailyContext) || isBlockedByHistory(actionTitle, input.dailyContext)) {
        blocked.push(makeBlocked({ id: `goal:${normalize(actionTitle)}`, title: actionTitle, source: 'goal', reason: 'Ação de Objetivo já foi bloqueada, concluída ou sugerida recentemente.' }));
        continue;
      }

      const trava = classifyTrava(actionTitle, input.dailyContext, lowCapacity);
      const score = 62 + (highCapacity ? 12 : 0) - (lowCapacity ? 10 : 0);

      allowed.push({
        id: `goal:${nextAction.id}`,
        title: actionTitle,
        kind: 'suggested_commitment',
        source: 'goal',
        targetId: goalId,
        targetType: 'goal',
        action: 'suggest',
        score,
        confidence: 0.76,
        reason: 'Próxima ação concreta já vinculada ao Objetivo ativo.',
        anchor: actionTitle,
        doneWhen: nextAction.doneWhen,
        bioReason: buildTravaReason(
          actionTitle,
          trava,
          input.dailyContext,
          lowCapacity
            ? 'A ação continua ativa, mas o tamanho de hoje precisa ser mínimo para respeitar a energia.'
            : highCapacity
              ? 'A fase atual abre espaço para esta ação concreta sem criar uma frente nova.'
              : 'Há uma ação concreta de Objetivo conectada ao dia real.',
          healthReasonSuffix(input.dailyContext),
        ),
        impactLabel: lowCapacity ? 'reduz carga' : highCapacity ? 'aproveita janela' : 'mantém ritmo',
        notificationAllowed: false,
        requiresConfirmation: false,
        travaType: trava,
      });
    }

    // TDAH+hyperfocus guard: prevent new tasks, suggest closing what's open
    if (adhdHyperfocusActive) {
      allowed.push({
        id: 'insight:adhd-hyperfocus-close',
        title: 'Encerrar com limite — hiperfoco ativo',
        kind: 'insight_only',
        source: 'system',
        targetType: 'system',
        action: 'insight',
        score: 90,
        confidence: 0.9,
        reason: 'Hiperfoco detectado com perfil TDAH: não é hora de abrir nova frente, mas de fechar o que está aberto.',
        bioReason: 'Hiperfoco é janela de entrega — não de expansão. O que está em andamento merece atenção total; tarefa nova agora dilui o ganho real.',
        impactLabel: 'protege energia',
        notificationAllowed: false,
        requiresConfirmation: false,
      });
    }

    if (allowed.length === 0) {
      const explicitActionRequested = requestContext.explicitActionRequested === true;
      const explicitActionTitle = cleanText(requestContext.explicitActionTitle);
      if (explicitActionRequested && explicitActionTitle) {
        allowed.push({
          id: `request:${normalize(explicitActionTitle)}`,
          title: explicitActionTitle,
          kind: 'suggested_commitment',
          source: 'request',
          targetType: 'system',
          action: 'suggest',
          score: 70,
          confidence: 0.86,
          reason: 'Ação pedida explicitamente na interação atual.',
          anchor: explicitActionTitle,
          bioReason: 'O pedido atual autoriza esta sugestão sem transformar memória ou fase em tarefa.',
          impactLabel: 'mantém ritmo',
          notificationAllowed: false,
          requiresConfirmation: true,
        });
      } else {
        allowed.push({
          id: 'insight:missing-anchor',
          title: 'Falta uma âncora atual',
          kind: 'insight_only',
          source: 'system',
          targetType: 'system',
          action: 'insight',
          score: 10,
          confidence: 0.7,
          reason: 'Não há ação suficientemente ancorada no dia real; é preciso perguntar o que precisa de ajuda hoje.',
          bioReason: 'Sem agenda, hábito, meta, subtarefa ou pedido explícito atual, a Airia pergunta antes de sugerir.',
          impactLabel: 'mantém ritmo',
          notificationAllowed: false,
          requiresConfirmation: false,
        });
      }
    }

    const principalMovementSurfaces = new Set<DecisionSurface>(['home', 'aura-chat', 'checkin']);
    const allowedActions = dedupeCandidates(allowed)
      .filter((candidate) => candidate.kind !== 'blocked')
      .slice(0, principalMovementSurfaces.has(input.surface) ? 1 : 8);
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
        ? `Decisão baseada em ações concretas de Objetivos, fase, horário local${input.dailyContext.healthSignals ? ', sinais corporais do Health Connect' : ''} e bloqueios de repetição.`
        : 'Nenhuma ação passou pelos critérios de âncora, horário e repetição.',
      confidence: actionable.length ? Math.round((actionable.reduce((sum, item) => sum + item.confidence, 0) / actionable.length) * 100) / 100 : 0.7,
      emptyReason: actionable.length ? null : 'Sem candidato operacional confiável; manter como insight.',
    };
  }
}
