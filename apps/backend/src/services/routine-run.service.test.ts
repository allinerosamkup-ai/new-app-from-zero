import assert from 'node:assert/strict';

import {
  ABANDON_AFTER_MINUTES,
  abandonIfStale,
  completeStep,
  createRun,
  currentStep,
  nextStepPreview,
  pause,
  progress,
  resume,
  skipStep,
  start,
  stepNotification,
  suggestDurationCalibration,
  summarize,
  type RunSummary,
} from './routine-run.service';

const steps = [
  { id: 's1', title: 'Beber um copo de água', plannedMinutes: 2, starter: 'Pegue o copo', icon: '💧' },
  { id: 's2', title: 'Alongar pescoço e ombros', plannedMinutes: 5, starter: 'Sente na beirada da cama' },
  { id: 's3', title: 'Trocar de roupa', plannedMinutes: 5, starter: 'Abra a gaveta' },
];

const at = (minutes: number) => new Date(Date.UTC(2026, 6, 26, 7, minutes, 0)).toISOString();

{
  const run = createRun({ id: 'run-1', routineId: 'rot-1', steps });
  assert.equal(run.status, 'idle');
  assert.equal(currentStep(run)?.id, 's1');
  assert.equal(stepNotification(run), null, 'run parado não notifica');

  const started = start(run, at(0));
  assert.equal(started.status, 'running');

  // Mostra um passo por vez e só uma linha do próximo.
  const notification = stepNotification(started);
  assert.equal(notification?.title, '💧 Agora: Beber um copo de água');
  assert.match(String(notification?.body), /Depois: Alongar pescoço e ombros/);
  assert.match(String(notification?.body), /1 de 3/);
  assert.equal(nextStepPreview(started), 'Alongar pescoço e ombros');

  const afterFirst = completeStep(started, at(3));
  assert.equal(afterFirst.currentStepIndex, 1);
  assert.equal(afterFirst.records[0].actualMinutes, 3, 'registra o tempo real, não o previsto');
  assert.equal(afterFirst.records[0].plannedMinutes, 2);
  assert.deepEqual(progress(afterFirst), { done: 1, total: 3, percent: 33 });

  // Pular não custa nada e não conta tempo.
  const afterSkip = skipStep(afterFirst, at(4));
  assert.equal(afterSkip.records[1].outcome, 'skipped');
  assert.equal(afterSkip.records[1].actualMinutes, 0);

  const finished = completeStep(afterSkip, at(12));
  assert.equal(finished.status, 'completed');
  assert.equal(finished.endedAt, at(12));
  assert.equal(nextStepPreview(finished), null);

  const summary = summarize(finished);
  assert.equal(summary.completedSteps, 2);
  assert.equal(summary.skippedSteps, 1);
  assert.equal(summary.plannedMinutes, 7);
  assert.equal(summary.actualMinutes, 11);
}

// Pausa preserva o tempo já corrido do passo.
{
  const run = start(createRun({ id: 'run-2', routineId: 'rot-1', steps }), at(0));
  const paused = pause(run, at(4));
  assert.equal(paused.status, 'paused');
  assert.equal(paused.carriedStepSeconds, 240);

  const resumed = resume(paused, at(30));
  assert.equal(resumed.status, 'running');

  const done = completeStep(resumed, at(32));
  assert.equal(done.records[0].actualMinutes, 6, 'os 26 min de pausa não entram na conta');
}

// Sumir sem fechar encerra sem apagar o que já foi feito.
{
  const run = completeStep(start(createRun({ id: 'run-3', routineId: 'rot-1', steps }), at(0)), at(2));
  const paused = pause(run, at(3));

  const stillOpen = abandonIfStale(paused, at(3 + ABANDON_AFTER_MINUTES - 1));
  assert.equal(stillOpen.status, 'paused');

  const abandoned = abandonIfStale(paused, at(3 + ABANDON_AFTER_MINUTES));
  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.records.length, 1, 'o passo concluído continua valendo');
  assert.equal(summarize(abandoned).completedSteps, 1);
}

// Transições inválidas não corrompem o estado.
{
  const idle = createRun({ id: 'run-4', routineId: 'rot-1', steps });
  assert.equal(completeStep(idle, at(1)).records.length, 0, 'não avança sem ter começado');
  assert.equal(resume(idle, at(1)).status, 'idle');
  assert.equal(pause(idle, at(1)).status, 'idle');
  assert.equal(start(createRun({ id: 'run-5', routineId: 'rot-1', steps: [] }), at(0)).status, 'idle');
}

// Calibração: só sugere ajuste com evidência repetida, e o ajuste é do app.
{
  const fast: RunSummary[] = Array.from({ length: 5 }, () => ({
    status: 'completed', completedSteps: 3, skippedSteps: 0, totalSteps: 3,
    plannedMinutes: 30, actualMinutes: 30, durationRatio: 1,
  }));
  assert.equal(suggestDurationCalibration(fast), null, 'quem cumpre o previsto não recebe recado');

  const slow: RunSummary[] = Array.from({ length: 3 }, () => ({
    status: 'completed', completedSteps: 3, skippedSteps: 0, totalSteps: 3,
    plannedMinutes: 30, actualMinutes: 45, durationRatio: 1.5,
  }));
  const calibration = suggestDurationCalibration(slow);
  assert.equal(calibration?.factor, 1.5);
  assert.match(String(calibration?.message), /Já ajustei/);
  assert.doesNotMatch(String(calibration?.message), /voc[êe] (?:erra|falha|atrasa|demora demais)/i);

  assert.equal(suggestDurationCalibration(slow.slice(0, 2)), null, 'duas amostras não são padrão');
}

console.log('routine-run.service tests passed');
