/**
 * Motor de execução passo a passo.
 *
 * A diferença entre um planner e um app que funciona para quem trava não está no
 * plano — está em atravessar o plano. Aqui a rotina vira uma máquina de estados que
 * mostra UM passo por vez, guarda o próximo como prévia curta e registra quanto
 * tempo cada coisa levou de verdade.
 *
 * Lógica pura: sem banco, sem relógio implícito. Todo avanço recebe o instante de
 * fora, para que o mesmo run possa ser reconstruído a partir do log de eventos.
 */

export type RoutineRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned';
export type RoutineStepOutcome = 'done' | 'skipped';

export type RoutineStep = {
  id: string;
  title: string;
  /** Minutos previstos. É estimativa, não meta — atrasar não é falha. */
  plannedMinutes: number;
  /** Primeiro movimento físico. O que tira do lugar quando a pessoa congela. */
  starter?: string | null;
  icon?: string | null;
};

export type RoutineStepRecord = {
  stepId: string;
  outcome: RoutineStepOutcome;
  plannedMinutes: number;
  actualMinutes: number;
  startedAt: string;
  endedAt: string;
};

export type RoutineRun = {
  id: string;
  routineId: string;
  steps: RoutineStep[];
  status: RoutineRunStatus;
  currentStepIndex: number;
  startedAt: string | null;
  /** Instante em que o passo atual começou a contar. */
  stepStartedAt: string | null;
  /** Soma do tempo já corrido no passo atual antes da última pausa. */
  carriedStepSeconds: number;
  pausedAt: string | null;
  records: RoutineStepRecord[];
  endedAt: string | null;
};

/** Depois disso sem tocar em nada, o run é considerado abandonado — sem drama. */
export const ABANDON_AFTER_MINUTES = 15;

function iso(at: Date | string): string {
  return typeof at === 'string' ? at : at.toISOString();
}

function minutesBetween(from: string, to: string, carriedSeconds = 0): number {
  const elapsedSeconds = ((new Date(to).getTime() - new Date(from).getTime()) / 1000) + carriedSeconds;
  return Math.max(0, Math.round(elapsedSeconds / 60));
}

export function createRun(input: { id: string; routineId: string; steps: RoutineStep[] }): RoutineRun {
  return {
    id: input.id,
    routineId: input.routineId,
    steps: input.steps,
    status: 'idle',
    currentStepIndex: 0,
    startedAt: null,
    stepStartedAt: null,
    carriedStepSeconds: 0,
    pausedAt: null,
    records: [],
    endedAt: null,
  };
}

export function start(run: RoutineRun, at: Date | string): RoutineRun {
  if (run.status !== 'idle' || run.steps.length === 0) return run;
  const now = iso(at);
  return { ...run, status: 'running', startedAt: now, stepStartedAt: now, carriedStepSeconds: 0 };
}

function closeCurrentStep(run: RoutineRun, at: Date | string, outcome: RoutineStepOutcome): RoutineRun {
  const step = run.steps[run.currentStepIndex];
  if (!step) return run;
  const now = iso(at);
  const startedAt = run.stepStartedAt ?? now;
  const record: RoutineStepRecord = {
    stepId: step.id,
    outcome,
    plannedMinutes: step.plannedMinutes,
    // Pulado não gasta tempo: contar minutos de um passo que não aconteceu
    // envenenaria a calibração de duração.
    actualMinutes: outcome === 'skipped' ? 0 : minutesBetween(startedAt, now, run.carriedStepSeconds),
    startedAt,
    endedAt: now,
  };

  const nextIndex = run.currentStepIndex + 1;
  const isLast = nextIndex >= run.steps.length;
  return {
    ...run,
    records: [...run.records, record],
    currentStepIndex: isLast ? run.currentStepIndex : nextIndex,
    status: isLast ? 'completed' : 'running',
    stepStartedAt: isLast ? null : now,
    carriedStepSeconds: 0,
    pausedAt: null,
    endedAt: isLast ? now : null,
  };
}

export function completeStep(run: RoutineRun, at: Date | string): RoutineRun {
  if (run.status !== 'running' && run.status !== 'paused') return run;
  return closeCurrentStep(run, at, 'done');
}

/** Pular é uma saída legítima e não custa nada. Sem penalidade, sem aviso. */
export function skipStep(run: RoutineRun, at: Date | string): RoutineRun {
  if (run.status !== 'running' && run.status !== 'paused') return run;
  return closeCurrentStep(run, at, 'skipped');
}

export function pause(run: RoutineRun, at: Date | string): RoutineRun {
  if (run.status !== 'running') return run;
  const now = iso(at);
  const carried = run.stepStartedAt
    ? run.carriedStepSeconds + ((new Date(now).getTime() - new Date(run.stepStartedAt).getTime()) / 1000)
    : run.carriedStepSeconds;
  return { ...run, status: 'paused', pausedAt: now, stepStartedAt: null, carriedStepSeconds: carried };
}

export function resume(run: RoutineRun, at: Date | string): RoutineRun {
  if (run.status !== 'paused') return run;
  return { ...run, status: 'running', stepStartedAt: iso(at), pausedAt: null };
}

/**
 * Some sem fechar? O run é encerrado como abandonado e o que já foi feito continua
 * valendo. Ninguém perde o progresso por ter largado no meio.
 */
export function abandonIfStale(run: RoutineRun, at: Date | string, afterMinutes = ABANDON_AFTER_MINUTES): RoutineRun {
  if (run.status !== 'paused' || !run.pausedAt) return run;
  if (minutesBetween(run.pausedAt, iso(at)) < afterMinutes) return run;
  return { ...run, status: 'abandoned', endedAt: iso(at), stepStartedAt: null };
}

export function currentStep(run: RoutineRun): RoutineStep | null {
  return run.steps[run.currentStepIndex] ?? null;
}

/** Prévia curta do próximo. Uma linha, nunca a lista inteira. */
export function nextStepPreview(run: RoutineRun): string | null {
  const next = run.steps[run.currentStepIndex + 1];
  return next ? next.title : null;
}

export function progress(run: RoutineRun): { done: number; total: number; percent: number } {
  const done = run.records.length;
  const total = run.steps.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * Texto da notificação de transição: o que é agora e o que vem depois.
 * Nunca cobra, nunca diz que está atrasada.
 */
export function stepNotification(run: RoutineRun): { title: string; body: string } | null {
  const step = currentStep(run);
  if (!step || run.status !== 'running') return null;
  const { done, total } = progress(run);
  const next = nextStepPreview(run);
  return {
    title: `${step.icon ? `${step.icon} ` : ''}Agora: ${step.title}`,
    body: [next ? `Depois: ${next}` : 'Último passo', `${done + 1} de ${total}`].join(' · '),
  };
}

export type RunSummary = {
  status: RoutineRunStatus;
  completedSteps: number;
  skippedSteps: number;
  totalSteps: number;
  plannedMinutes: number;
  actualMinutes: number;
  /** > 1 significa que a rotina leva mais tempo do que o previsto. */
  durationRatio: number | null;
};

export function summarize(run: RoutineRun): RunSummary {
  const completed = run.records.filter((record) => record.outcome === 'done');
  const planned = completed.reduce((total, record) => total + record.plannedMinutes, 0);
  const actual = completed.reduce((total, record) => total + record.actualMinutes, 0);
  return {
    status: run.status,
    completedSteps: completed.length,
    skippedSteps: run.records.length - completed.length,
    totalSteps: run.steps.length,
    plannedMinutes: planned,
    actualMinutes: actual,
    durationRatio: planned > 0 ? Number((actual / planned).toFixed(2)) : null,
  };
}

/**
 * Calibração de cegueira temporal.
 *
 * Não serve para dizer "você errou de novo": serve para a Airia parar de propor 30
 * minutos para algo que sempre leva 50. O ajuste é do app, não da pessoa.
 */
export function suggestDurationCalibration(
  summaries: RunSummary[],
  minimumRuns = 3,
): { factor: number; message: string } | null {
  const withRatio = summaries.filter((summary): summary is RunSummary & { durationRatio: number } => (
    typeof summary.durationRatio === 'number' && summary.durationRatio > 0
  ));
  if (withRatio.length < minimumRuns) return null;

  const recent = withRatio.slice(-minimumRuns);
  const average = recent.reduce((total, summary) => total + summary.durationRatio, 0) / recent.length;
  if (average <= 1.2) return null;

  const factor = Number(average.toFixed(2));
  return {
    factor,
    message: `Essa rotina costuma levar ${factor}x o tempo previsto. Já ajustei as durações para o tempo real.`,
  };
}
