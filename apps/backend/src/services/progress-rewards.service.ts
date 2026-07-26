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
  kind: 'habit_done' | 'task_done' | 'routine_completed' | 'routine_partial' | 'checkin' | 'journal';
};

export type PhaseByDate = Record<string, string | undefined>;

export const XP_BY_KIND: Record<ProgressEvent['kind'], number> = {
  // Atravessar uma rotina inteira é o movimento mais difícil, e paga mais.
  routine_completed: 25,
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
