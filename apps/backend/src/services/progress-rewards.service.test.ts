import assert from 'node:assert/strict';

import {
  XP_BY_KIND,
  buildCelebration,
  buildCompletionReward,
  computeGoalCounters,
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

// Cada item concluído devolve retorno imediato — o retorno de dopamina do fechar.
{
  const streak = computeStreak({ events: [{ date: day(22), kind: 'task_done' }], today: day(22) });

  const simples = buildCompletionReward({ title: 'Enviar relatório', kind: 'task_done', streak, today: day(22) });
  assert.equal(simples.xpEarned, XP_BY_KIND.task_done);
  assert.equal(simples.animation, 'spark');
  assert.equal(simples.intensity, 'small');
  assert.ok(simples.headline.length <= 24, 'a frase tem que caber antes da pessoa sair da tela');

  // Itens diferentes não mostram sempre a mesma frase.
  const variacoes = new Set(
    ['Lavar louça', 'Ligar pro médico', 'Enviar relatório', 'Caminhar', 'Estudar', 'Pagar conta']
      .map((title) => buildCompletionReward({ title, kind: 'task_done', today: day(22) }).headline),
  );
  assert.ok(variacoes.size > 1, 'a mesma frase toda vez para de dar retorno');

  // A mesma conclusão mostra sempre a mesma frase — não pisca a cada render.
  assert.equal(
    buildCompletionReward({ title: 'Enviar relatório', kind: 'task_done', today: day(22) }).headline,
    simples.headline,
  );

  // Contar algo que já fez tem reconhecimento próprio.
  const relatado = buildCompletionReward({ title: 'Lavar a louça', kind: 'task_done', reported: true, today: day(22) });
  assert.equal(relatado.animation, 'pulse');
  assert.ok(relatado.xpEarned > 0, 'o que ela fez sozinha também pontua');

  // Marcos ganham comemoração grande.
  const subiuNivel = buildCompletionReward({ title: 'Caminhada', kind: 'habit_done', leveledUp: true, today: day(22) });
  assert.equal(subiuNivel.animation, 'confetti');
  assert.equal(subiuNivel.intensity, 'big');
  assert.equal(subiuNivel.detail, 'Subiu de nível.');

  const fechouODia = buildCompletionReward({ title: 'Última tarefa', kind: 'task_done', clearedTheDay: true, today: day(22) });
  assert.equal(fechouODia.headline, 'Dia fechado.');
  assert.equal(fechouODia.intensity, 'big');

  const seteDias = computeStreak({
    events: Array.from({ length: 7 }, (_, index) => ({ date: day(16 + index), kind: 'habit_done' as const })),
    today: day(22),
  });
  const marco = buildCompletionReward({ title: 'Caminhada', kind: 'habit_done', streak: seteDias, today: day(22) });
  assert.equal(marco.animation, 'streak');
  assert.match(String(marco.detail), /7 dias seguidos/);
}

// Nenhuma frase de conclusão compara com o que faltou nem cobra.
{
  const textos: string[] = [];
  for (const title of ['Lavar louça', 'Ligar pro médico', 'Enviar relatório', 'Caminhar', 'Estudar', 'Pagar conta', 'Alongar']) {
    for (const reported of [false, true]) {
      const reward = buildCompletionReward({ title, kind: 'task_done', reported, today: day(22) });
      textos.push(`${reward.headline} ${reward.detail ?? ''}`);
    }
  }
  for (const texto of textos) {
    assert.doesNotMatch(texto, /faltou|faltam|ainda|ontem|ao menos|pelo menos|finalmente|at[ée] que enfim|demorou/i, texto);
  }
}

// ── Objetivos: recompensa por micro-ação e por objetivo fechado ──────────────
{
  const acao = buildCompletionReward({ title: 'Separar os papéis', kind: 'goal_action_done', today: day(22) });
  assert.equal(acao.xpEarned, 12, 'micro-ação de objetivo tem que valer mais que hábito (8)');
  assert.equal(acao.intensity, 'small');

  // Objetivo inteiro é o evento mais raro do app: sempre grande, mesmo sem
  // subir de nível e sem marco de sequência.
  const objetivo = buildCompletionReward({ title: 'Organizar o quarto', kind: 'goal_completed', today: day(22) });
  assert.equal(objetivo.xpEarned, 60);
  assert.equal(objetivo.intensity, 'big', 'objetivo fechado não pode chegar com o mesmo peso de uma tarefa');
  assert.equal(objetivo.animation, 'confetti');
  assert.notEqual(objetivo.headline, acao.headline, 'objetivo fechado precisa de frase própria');

  // A regra da casa vale aqui também: nada de cobrança nem comparação.
  for (const title of ['Organizar o quarto', 'Terminar o curso', 'Vender as camas']) {
    const reward = buildCompletionReward({ title, kind: 'goal_completed', today: day(22) });
    assert.doesNotMatch(
      `${reward.headline} ${reward.detail ?? ''}`,
      /faltou|faltam|ainda|ontem|ao menos|pelo menos|finalmente|at[ée] que enfim|demorou/i,
    );
  }
}

// ── Contadores ───────────────────────────────────────────────────────────────
{
  const goalEvents = [
    { date: day(20), kind: 'goal_action_done' as const },
    { date: day(21), kind: 'goal_action_done' as const },
    { date: day(22), kind: 'goal_action_done' as const },
    { date: day(22), kind: 'goal_completed' as const },
  ];

  const counters = computeGoalCounters({ goalEvents, today: day(22) });
  assert.equal(counters.actionsCompleted, 3);
  assert.equal(counters.goalsCompleted, 1);
  assert.equal(counters.actionStreak.current, 3, 'três dias seguidos com ação');

  // Piso: os eventos só passaram a existir agora. Quem já tinha 30 ações
  // concluídas antes não pode ver zero — seria o oposto do efeito desejado.
  const comPiso = computeGoalCounters({
    goalEvents,
    today: day(22),
    floor: { actionsCompleted: 30, goalsCompleted: 4 },
  });
  assert.equal(comPiso.actionsCompleted, 30, 'piso histórico foi ignorado');
  assert.equal(comPiso.goalsCompleted, 4);

  // O piso é piso, não teto: quando os eventos passam do histórico, eles mandam.
  const eventosMaiores = Array.from({ length: 40 }, () => ({ date: day(22), kind: 'goal_action_done' as const }));
  assert.equal(
    computeGoalCounters({ goalEvents: eventosMaiores, today: day(22), floor: { actionsCompleted: 30 } }).actionsCompleted,
    40,
  );

  // Fase protegida não quebra a sequência de ações, igual ao resto do app.
  const comBuraco = [
    { date: day(20), kind: 'goal_action_done' as const },
    { date: day(22), kind: 'goal_action_done' as const },
  ];
  const atravessou = computeGoalCounters({
    goalEvents: comBuraco,
    today: day(22),
    phaseByDate: { [day(21)]: 'Recolhimento' },
  });
  assert.equal(atravessou.actionStreak.current, 2, 'Recolhimento tem que atravessar, não quebrar');
}

console.log('progress-rewards.service tests passed');
