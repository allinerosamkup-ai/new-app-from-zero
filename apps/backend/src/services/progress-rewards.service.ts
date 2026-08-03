/**
 * Progresso e recompensa.
 *
 * Regra que manda em tudo aqui: **recompensa por aparecer, nunca punição por
 * faltar.** Gamificação que zera streak em dia ruim não incentiva — cobra. E para
 * quem tem TDAH, ciclotimia ou depressão, o dia ruim não é desleixo: é a própria
 * condição que o app existe para acompanhar.
 *
 * Consequência prática: a Airia é o único app que sabe que hoje é fase de
 * Recolhimento ou Pausa. Nesses dias a sequência **pausa**, não quebra. Ausência
 * nunca gera mensagem — só a presença gera.
 */

/** Fases em que não fazer nada é a resposta certa. */
export const PROTECTED_PHASES = ['Recolhimento', 'Pausa'] as const;

export type ProgressEvent = {
  date: string;
  kind:
    | 'habit_done'
    | 'task_done'
    | 'routine_completed'
    | 'routine_partial'
    | 'checkin'
    | 'journal'
    | 'goal_action_done'
    | 'goal_completed';
};

export type PhaseByDate = Record<string, string | undefined>;

export const XP_BY_KIND: Record<ProgressEvent['kind'], number> = {
  // Fechar um objetivo inteiro é o maior evento do app: várias micro-ações em
  // sequência, cada uma dependendo da anterior.
  goal_completed: 60,
  // Atravessar uma rotina inteira é o movimento mais difícil, e paga mais.
  routine_completed: 25,
  // Micro-ação de objetivo vale mais que hábito porque exige sequência: só a
  // próxima da fila é clicável, então concluir significa ter chegado até ali.
  goal_action_done: 12,
  // Começar e parar no meio também paga: começar é a parte cara.
  routine_partial: 10,
  habit_done: 8,
  task_done: 6,
  checkin: 4,
  journal: 4,
};

const LEVEL_STEP = 120;

export type StreakState = {
  current: number;
  best: number;
  /** Dias em que a sequência foi mantida por ser fase protegida. */
  protectedDays: number;
  /** True quando hoje é dia protegido: a sequência segura sozinha. */
  isProtectedToday: boolean;
};

export type ProgressState = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: StreakState;
};

function dayBefore(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function isProtectedPhase(phase: string | undefined): boolean {
  return !!phase && (PROTECTED_PHASES as readonly string[]).includes(phase);
}

export function levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  const level = Math.floor(xp / LEVEL_STEP) + 1;
  return { level, xpIntoLevel: xp % LEVEL_STEP, xpForNextLevel: LEVEL_STEP };
}

/**
 * Sequência de dias em que a pessoa apareceu.
 *
 * Dia com qualquer registro conta. Dia de fase protegida sem registro não conta
 * como presença, mas também não quebra — a sequência atravessa.
 */
export function computeStreak(input: {
  events: ProgressEvent[];
  today: string;
  phaseByDate?: PhaseByDate;
  maxLookbackDays?: number;
}): StreakState {
  const phaseByDate = input.phaseByDate ?? {};
  const activeDays = new Set(input.events.map((event) => event.date));
  const lookback = input.maxLookbackDays ?? 365;

  let current = 0;
  let protectedDays = 0;
  let cursor = input.today;

  // Ainda não apareceu hoje? A sequência de ontem continua viva — o dia não acabou.
  if (!activeDays.has(cursor) && !isProtectedPhase(phaseByDate[cursor])) {
    cursor = dayBefore(cursor);
  }

  for (let step = 0; step < lookback; step++) {
    if (activeDays.has(cursor)) {
      current += 1;
    } else if (isProtectedPhase(phaseByDate[cursor])) {
      protectedDays += 1;
    } else {
      break;
    }
    cursor = dayBefore(cursor);
  }

  // Melhor sequência histórica, com a mesma regra de proteção.
  let best = 0;
  let running = 0;
  const sorted = [...activeDays].sort();
  const first = sorted[0];
  if (first) {
    for (let day = first; day <= input.today; day = nextDay(day)) {
      if (activeDays.has(day)) {
        running += 1;
        best = Math.max(best, running);
      } else if (!isProtectedPhase(phaseByDate[day])) {
        running = 0;
      }
    }
  }

  return {
    current,
    best: Math.max(best, current),
    protectedDays,
    isProtectedToday: isProtectedPhase(phaseByDate[input.today]) && !activeDays.has(input.today),
  };
}

function nextDay(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function computeProgress(input: {
  events: ProgressEvent[];
  today: string;
  phaseByDate?: PhaseByDate;
}): ProgressState {
  const xp = input.events.reduce((total, event) => total + (XP_BY_KIND[event.kind] ?? 0), 0);
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(xp);
  return {
    xp,
    level,
    xpIntoLevel,
    xpForNextLevel,
    streak: computeStreak(input),
  };
}


export type RewardAnimation = 'spark' | 'confetti' | 'pulse' | 'streak';

export type CompletionReward = {
  xpEarned: number;
  headline: string;
  detail: string | null;
  animation: RewardAnimation;
  intensity: 'small' | 'big';
};

/**
 * Frases de conclusão.
 *
 * Curtas de propósito: o retorno tem que chegar antes da pessoa sair da tela. E
 * variadas de propósito: a mesma frase toda vez vira ruído e para de dar retorno
 * nenhum. Nenhuma delas compara com o que faltou nem com ontem.
 */
const DONE_HEADLINES = [
  'Feito.',
  'Saiu.',
  'Fechou.',
  'Esse foi.',
  'Mais um.',
  'Pronto.',
];

/** Quando a pessoa conta que já fez, o reconhecimento é mais explícito. */
const REPORTED_HEADLINES = [
  'Isso conta.',
  'Anotado como feito.',
  'Boa — já registrei.',
  'Marquei aqui.',
];

/**
 * Fechar um objetivo inteiro merece frase própria. Fala do que aconteceu, nunca
 * do tempo que levou nem do que ficou pelo caminho.
 */
const GOAL_DONE_HEADLINES = [
  'Objetivo fechado.',
  'Você chegou.',
  'Percorrido.',
  'Do começo ao fim.',
];

/** Escolha estável: a mesma conclusão sempre mostra a mesma frase, mas itens
 *  diferentes mostram frases diferentes. Sem repetir a anterior por acaso. */
function pick(pool: string[], seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
  }
  return pool[hash % pool.length];
}

/**
 * Retorno imediato de uma conclusão — o "soltar dopamina" de cada item fechado.
 *
 * `reported` marca o caso em que a pessoa contou algo que já tinha feito: aí o
 * texto reconhece em vez de só confirmar, porque ela fez sem o app ajudar.
 */
export function buildCompletionReward(input: {
  title: string;
  kind: Extract<
    ProgressEvent['kind'],
    'habit_done' | 'task_done' | 'routine_completed' | 'goal_action_done' | 'goal_completed'
  >;
  reported?: boolean;
  streak?: StreakState;
  leveledUp?: boolean;
  /** Fechou tudo que tinha para hoje. */
  clearedTheDay?: boolean;
  today?: string;
}): CompletionReward {
  const seed = `${input.title}:${input.today ?? ''}`;
  const xpEarned = XP_BY_KIND[input.kind] ?? XP_BY_KIND.task_done;

  const goalCompleted = input.kind === 'goal_completed';
  const milestoneStreak = !!input.streak && input.streak.current > 0 && input.streak.current % 7 === 0;
  // Objetivo concluído é sempre grande, independente de nível ou sequência: é o
  // evento mais raro do app e não pode chegar com o mesmo peso de uma tarefa.
  const big = goalCompleted || !!input.leveledUp || !!input.clearedTheDay || milestoneStreak;

  const headline = goalCompleted
    ? pick(GOAL_DONE_HEADLINES, seed)
    : input.reported
      ? pick(REPORTED_HEADLINES, seed)
      : input.clearedTheDay
        ? 'Dia fechado.'
        : pick(DONE_HEADLINES, seed);

  const detail = input.leveledUp
    ? 'Subiu de nível.'
    : milestoneStreak
      ? `${input.streak?.current} dias seguidos.`
      : input.clearedTheDay
        ? 'Não sobrou nada para hoje.'
        : null;

  return {
    xpEarned,
    headline,
    detail,
    animation: goalCompleted || input.leveledUp
      ? 'confetti'
      : milestoneStreak ? 'streak' : input.clearedTheDay ? 'confetti' : input.reported ? 'pulse' : 'spark',
    intensity: big ? 'big' : 'small',
  };
}

/**
 * Os quatro contadores que a faixa de progresso mostra.
 *
 * `actionsCompleted` e `goalsCompleted` são totais acumulados — números que só
 * sobem, nunca zeram. `actionStreak` reusa `computeStreak` e por isso herda de
 * graça a regra de fase protegida: Recolhimento e Pausa não quebram sequência.
 */
export type GoalCounters = {
  actionsCompleted: number;
  goalsCompleted: number;
  actionStreak: StreakState;
};

export function computeGoalCounters(input: {
  /** Só eventos de objetivo — o resto do histórico não entra nestes contadores. */
  goalEvents: ProgressEvent[];
  today: string;
  phaseByDate?: PhaseByDate;
  /**
   * Piso vindo do estado atual dos objetivos. Necessário porque os eventos só
   * passaram a existir agora: sem ele, quem já concluiu dezenas de ações veria
   * zero — o oposto do efeito que a contagem deveria ter.
   */
  floor?: { actionsCompleted?: number; goalsCompleted?: number };
}): GoalCounters {
  const actionEvents = input.goalEvents.filter((event) => event.kind === 'goal_action_done');
  return {
    actionsCompleted: Math.max(actionEvents.length, input.floor?.actionsCompleted ?? 0),
    goalsCompleted: Math.max(
      input.goalEvents.filter((event) => event.kind === 'goal_completed').length,
      input.floor?.goalsCompleted ?? 0,
    ),
    // Sequência conta dias com ação de objetivo, não qualquer presença no app.
    // Não é recuperável para quem já usava: subgoals não guardam data, então
    // começa do zero — e isso é honesto, não um bug.
    actionStreak: computeStreak({
      events: actionEvents,
      today: input.today,
      phaseByDate: input.phaseByDate,
    }),
  };
}

export type Celebration = {
  headline: string;
  detail: string;
  xpEarned: number;
};

/**
 * Fechamento de uma rotina executada.
 *
 * Vale para rotina inteira e para rotina pela metade — sem "você só fez 2 de 5".
 * O texto celebra o que aconteceu e não menciona o que faltou.
 */
export function buildCelebration(input: {
  completedSteps: number;
  totalSteps: number;
  streak: StreakState;
  leveledUp?: boolean;
}): Celebration {
  const finishedAll = input.completedSteps >= input.totalSteps && input.totalSteps > 0;
  const xpEarned = finishedAll ? XP_BY_KIND.routine_completed : XP_BY_KIND.routine_partial;

  const headline = finishedAll
    ? 'Rotina fechada.'
    : input.completedSteps > 1
      ? `${input.completedSteps} passos atravessados.`
      : 'Você começou.';

  const detail = input.leveledUp
    ? 'Subiu de nível.'
    : input.streak.current > 1
      ? `${input.streak.current} dias seguidos aparecendo.`
      : 'Começar é a parte cara. Essa parte já foi.';

  return { headline, detail, xpEarned };
}

/**
 * Mensagem sobre a sequência. Devolve null quando não há nada a dizer.
 *
 * Nunca existe mensagem para ausência: silêncio é o comportamento correto quando a
 * pessoa não apareceu. O único caso de fala sem presença é a fase protegida — e aí
 * a fala é para tirar peso, não para cobrar volta.
 */
export function streakMessage(streak: StreakState): string | null {
  if (streak.isProtectedToday) {
    return 'Hoje é dia de recolher. Sua sequência fica guardada — ela não depende de você produzir hoje.';
  }
  if (streak.current >= 2) {
    return `${streak.current} dias seguidos.`;
  }
  return null;
}
