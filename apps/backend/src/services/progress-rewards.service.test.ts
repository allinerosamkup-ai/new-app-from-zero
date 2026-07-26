import assert from 'node:assert/strict';

import {
  XP_BY_KIND,
  buildCelebration,
  computeProgress,
  computeStreak,
  levelFromXp,
  streakMessage,
  type ProgressEvent,
} from './progress-rewards.service';

const day = (n: number) => `2026-07-${String(n).padStart(2, '0')}`;

// XP soma por presença, e começar sem terminar também paga.
{
  const events: ProgressEvent[] = [
    { date: day(20), kind: 'routine_completed' },
    { date: day(21), kind: 'routine_partial' },
    { date: day(21), kind: 'habit_done' },
    { date: day(22), kind: 'checkin' },
  ];
  const progress = computeProgress({ events, today: day(22) });
  assert.equal(progress.xp, 25 + 10 + 8 + 4);
  assert.ok(XP_BY_KIND.routine_partial > 0, 'largar no meio ainda vale pontos');
  assert.equal(progress.level, levelFromXp(progress.xp).level);
}

// A sequência conta dias em que a pessoa apareceu.
{
  const events: ProgressEvent[] = [20, 21, 22].map((n) => ({ date: day(n), kind: 'habit_done' as const }));
  assert.equal(computeStreak({ events, today: day(22) }).current, 3);
}

// Ainda não apareceu hoje: a sequência de ontem continua viva, o dia não acabou.
{
  const events: ProgressEvent[] = [20, 21].map((n) => ({ date: day(n), kind: 'habit_done' as const }));
  assert.equal(computeStreak({ events, today: day(22) }).current, 2);
}

// O CASO QUE DEFINE O PRODUTO: dia ruim não quebra sequência.
{
  const events: ProgressEvent[] = [
    { date: day(20), kind: 'habit_done' },
    { date: day(21), kind: 'habit_done' },
    // dias 22 e 23 sem nada — fase de Recolhimento e Pausa
    { date: day(24), kind: 'habit_done' },
  ];
  const phaseByDate = { [day(22)]: 'Recolhimento', [day(23)]: 'Pausa' };

  const semProtecao = computeStreak({ events, today: day(24) });
  const comProtecao = computeStreak({ events, today: day(24), phaseByDate });

  assert.equal(semProtecao.current, 1, 'sem contexto de fase, a sequência quebraria');
  assert.equal(comProtecao.current, 3, 'com fase protegida, a sequência atravessa o dia ruim');
  assert.equal(comProtecao.protectedDays, 2);
}

// Dia protegido sem registro: a sequência segura e a fala tira peso.
{
  const events: ProgressEvent[] = [20, 21].map((n) => ({ date: day(n), kind: 'habit_done' as const }));
  const streak = computeStreak({ events, today: day(22), phaseByDate: { [day(22)]: 'Pausa' } });
  assert.equal(streak.isProtectedToday, true);
  assert.equal(streak.current, 2);

  const message = String(streakMessage(streak));
  assert.match(message, /fica guardada/);
  assert.doesNotMatch(message, /perde|perder|quebr|falh|volte|voltar a|nao desista|não desista/i);
}

// Ausência sem fase protegida não gera mensagem nenhuma. Silêncio, não cobrança.
{
  const streak = computeStreak({ events: [], today: day(22) });
  assert.equal(streak.current, 0);
  assert.equal(streakMessage(streak), null, 'não existe recado para quem não apareceu');
}

// Celebração fala do que aconteceu, nunca do que faltou.
{
  const streak = computeStreak({ events: [{ date: day(22), kind: 'routine_partial' }], today: day(22) });

  const parcial = buildCelebration({ completedSteps: 2, totalSteps: 5, streak });
  assert.equal(parcial.xpEarned, XP_BY_KIND.routine_partial);
  assert.match(parcial.headline, /2 passos atravessados/);
  const textoParcial = `${parcial.headline} ${parcial.detail}`;
  assert.doesNotMatch(textoParcial, /de 5|faltou|faltaram|incompleta|só|apenas|nao terminou|não terminou/i);

  const completa = buildCelebration({ completedSteps: 5, totalSteps: 5, streak });
  assert.equal(completa.xpEarned, XP_BY_KIND.routine_completed);
  assert.match(completa.headline, /Rotina fechada/);

  const primeira = buildCelebration({ completedSteps: 1, totalSteps: 4, streak });
  assert.match(primeira.headline, /começou/i);
}

// Nenhuma copy do módulo cobra, ameaça ou culpa.
{
  const streakLonga = computeStreak({
    events: [20, 21, 22].map((n) => ({ date: day(n), kind: 'habit_done' as const })),
    today: day(22),
  });
  const textos = [
    String(streakMessage(streakLonga)),
    ...[0, 1, 3, 5].map((done) => {
      const celebration = buildCelebration({ completedSteps: done, totalSteps: 5, streak: streakLonga });
      return `${celebration.headline} ${celebration.detail}`;
    }),
  ];
  for (const texto of textos) {
    assert.doesNotMatch(
      texto,
      /voc[êe] (?:perdeu|falhou|deixou|não|nao)|perdeu a sequ|nao desista|não desista|volte|cobran|prometeu|devia|deveria/i,
      texto,
    );
  }
}

console.log('progress-rewards.service tests passed');
