import assert from 'node:assert/strict';

import {
  capacityBasisSummary,
  correctionBias,
  inferCapacity,
  toDecisionFlags,
  toGoalCapacity,
  toStepMinutes,
  type CapacityLevel,
} from './capacity';

/**
 * O ternário que vivia em `index.ts:2225`, reproduzido aqui para provar em
 * quais pontos o canônico concorda com ele e em qual ponto diverge de
 * propósito. Sem esta cópia, "mudou o comportamento" viraria descoberta em
 * produção em vez de decisão registrada.
 */
function legacyGoalCapacity(energy: number): 'quick' | 'moderate' | 'heavy' {
  return energy <= 3 ? 'quick' : energy >= 7 ? 'heavy' : 'moderate';
}

/** Os dois booleanos originais de `decision-engine.service.ts:439-440`. */
function legacyDecisionFlags(input: {
  phase?: string;
  poorMeasuredSleep?: boolean;
  recalibrationSignal?: string | null;
}): { lowCapacity: boolean; highCapacity: boolean } {
  const forceHard = input.recalibrationSignal === 'day_hard' || input.recalibrationSignal === 'energy_crash';
  const forceGreat = input.recalibrationSignal === 'day_great' || input.recalibrationSignal === 'hyperfocus';
  const lowPhase = /\b(turbulencia|pausa|recolhimento|desacelerando)\b/.test((input.phase ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  const highPhase = /\b(voo alto|fluindo)\b/.test((input.phase ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  return {
    lowCapacity: forceHard || (!forceGreat && (lowPhase || Boolean(input.poorMeasuredSleep))),
    highCapacity: forceGreat || (!forceHard && highPhase),
  };
}

const PHASES = [
  'Voo Alto', 'Fluindo', 'Estável', 'Desacelerando',
  'Recolhimento', 'Pausa', 'Retomada', 'Turbulência',
];

function run() {
  // ── 1. Segurança vence tudo ────────────────────────────────────────────────
  // Energia 9 com risco de crise não é um dia grande. Se esta asserção cair,
  // o app propõe carga para alguém que precisa de apoio.
  const crisis = inferCapacity({ energyScore: 9, moodScore: 8, riskRoute: 'crisis_protocol' });
  assert.equal(crisis.level, 'protecao');
  assert.equal(crisis.confidence, 'alta');
  assert.match(crisis.reason, /apoio/);

  const humanSupport = inferCapacity({ energyScore: 10, phaseLabel: 'Voo Alto', riskRoute: 'human_support' });
  assert.equal(humanSupport.level, 'protecao');

  // ── 2. Sono medido ruim é teto, mesmo com energia alta ─────────────────────
  const shortSleep = inferCapacity({ energyScore: 8, moodScore: 7, measuredSleepMinutes: 300 });
  assert.equal(shortSleep.level, 'protecao');
  assert.match(shortSleep.reason, /5h/);

  const poorSleepScore = inferCapacity({ energyScore: 8, measuredSleepScore: 3 });
  assert.equal(poorSleepScore.level, 'protecao');

  // Sono medido que não sincronizou (0 min) não é noite mal dormida.
  const noSync = inferCapacity({ energyScore: 8, moodScore: 7, measuredSleepMinutes: 0 });
  assert.equal(noSync.level, 'alta');

  // ── 3. Sem sinal nenhum: media, assumido, confiança baixa ──────────────────
  const empty = inferCapacity();
  assert.equal(empty.level, 'media');
  assert.equal(empty.assumed, true);
  assert.equal(empty.confidence, 'baixa');
  assert.equal(empty.corrected, false);
  assert.match(empty.reason, /Ainda não tenho sinal/);

  // ── 4. Confronto com o ternário legado, energia 1..10 ──────────────────────
  //
  // O ternário de `index.ts:2225` discordava do resto do app em três energias:
  // 4 e 5 (que `reasoning-context` já tratava como capacidade baixa) e 7 (que
  // só ali era "dia grande", contra o corte de 8 usado em todo o resto).
  //
  // **A regra que a unificação tem que respeitar: em nenhuma energia o
  // canônico pode pedir MAIS do que o legado pedia.** Unificar escalas obriga a
  // escolher nas bordas, e a escolha é sempre a que protege. Se esta asserção
  // cair, alguém tornou o app mais exigente sem perceber.
  const DEMAND: Record<'quick' | 'moderate' | 'heavy', number> = { quick: 0, moderate: 1, heavy: 2 };
  const divergences: string[] = [];
  for (let energy = 1; energy <= 10; energy += 1) {
    const canonical = toGoalCapacity(inferCapacity({ energyScore: energy }).level);
    const legacy = legacyGoalCapacity(energy);
    assert.ok(
      DEMAND[canonical] <= DEMAND[legacy],
      `energia ${energy}: o canônico (${canonical}) pede mais que o legado (${legacy})`,
    );
    if (canonical !== legacy) divergences.push(`${energy}:${legacy}->${canonical}`);
  }
  assert.deepEqual(
    divergences,
    ['4:moderate->quick', '5:moderate->quick', '7:heavy->moderate'],
    'as divergências são exatamente as três declaradas — nenhuma a mais, nenhuma a menos',
  );

  // ── 5. Paridade com os booleanos do DecisionEngine ─────────────────────────
  //
  // O DecisionEngine só enxerga fase, sono medido e recalibração; o canônico é
  // chamado com exatamente esses sinais, então a paridade tem que ser exata —
  // com uma exceção que o próprio confronto revelou.
  //
  // **Bug encontrado no legado:** fase alta com sono medido ruim (dormiu 5h e
  // está em "Fluindo") liga `lowCapacity` E `highCapacity` na mesma avaliação.
  // Os dois sinalizadores são lidos em pontos diferentes do motor, então o dia
  // saía protegido num lugar e ampliado no outro. Como dois níveis de
  // capacidade não podem valer ao mesmo tempo, o canônico resolve para o lado
  // que protege.
  let contradictions = 0;
  for (const phase of PHASES) {
    for (const poorMeasuredSleep of [false, true]) {
      for (const signal of [null, 'day_hard', 'energy_crash', 'day_great', 'hyperfocus']) {
        const canonical = toDecisionFlags(inferCapacity({
          phaseLabel: phase,
          measuredSleepMinutes: poorMeasuredSleep ? 300 : null,
          recalibrationSignal: signal,
        }).level);
        const legacy = legacyDecisionFlags({ phase, poorMeasuredSleep, recalibrationSignal: signal });

        if (legacy.lowCapacity && legacy.highCapacity) {
          contradictions += 1;
          assert.deepEqual(
            canonical,
            { lowCapacity: true, highCapacity: false },
            `estado contraditório em fase=${phase} sinal=${signal} deveria resolver protegendo`,
          );
          continue;
        }

        assert.deepEqual(
          canonical,
          legacy,
          `divergência em fase=${phase} sono=${poorMeasuredSleep} sinal=${signal}`,
        );
      }
    }
  }
  assert.ok(contradictions > 0, 'o confronto precisa exercitar o estado contraditório do legado');

  // ── 6. Relato do dia vence fase e sono ─────────────────────────────────────
  const greatDespiteLowPhase = inferCapacity({ phaseLabel: 'Recolhimento', recalibrationSignal: 'day_great' });
  assert.equal(greatDespiteLowPhase.level, 'alta');

  const hardDespiteHighPhase = inferCapacity({ phaseLabel: 'Voo Alto', recalibrationSignal: 'day_hard' });
  assert.equal(hardDespiteHighPhase.level, 'baixa');

  // ── 7. Queda intradiária e adapt_day limitam o teto ────────────────────────
  const falling = inferCapacity({ energyScore: 8, moodScore: 7, intradayDirection: 'falling' });
  assert.equal(falling.level, 'baixa');
  assert.match(falling.reason, /cai|caindo/i);

  const adaptDay = inferCapacity({ energyScore: 8, moodScore: 7, riskRoute: 'adapt_day' });
  assert.equal(adaptDay.level, 'baixa');

  // Mas não derrubam quem acabou de dizer que está rendendo.
  const greatFalling = inferCapacity({ recalibrationSignal: 'hyperfocus', intradayDirection: 'falling' });
  assert.equal(greatFalling.level, 'alta');

  // ── 8. Sono declarado rebaixa um nível; medido decide ──────────────────────
  const declaredPoor = inferCapacity({ energyScore: 8, moodScore: 7, declaredSleepHours: 4 });
  assert.equal(declaredPoor.level, 'media', 'declarado desce um nível a partir de alta');
  assert.match(declaredPoor.reason, /4h/);

  // Mesma noite ruim, contada versus medida: a medida protege mais, porque
  // erra menos que a memória de quem acabou de acordar.
  const onlyDeclared = inferCapacity({ declaredSleepHours: 4 });
  const onlyMeasured = inferCapacity({ measuredSleepMinutes: 240 });
  assert.equal(onlyDeclared.level, 'baixa', 'declarado sozinho desce um nível a partir de media');
  assert.equal(onlyMeasured.level, 'protecao', 'medido sozinho decide proteção');
  assert.ok(
    LEVELS.indexOf(onlyMeasured.level) < LEVELS.indexOf(onlyDeclared.level),
    'sono medido nunca pode pesar menos que o declarado',
  );

  // Havendo medida, o declarado não conta duas vezes.
  const bothSleeps = inferCapacity({ energyScore: 8, measuredSleepMinutes: 300, declaredSleepHours: 4 });
  assert.equal(bothSleeps.level, 'protecao');
  assert.equal(bothSleeps.basis.filter((item) => item.signal === 'sono').length, 1);

  // ── 9. Sinal velho não sustenta dia grande ─────────────────────────────────
  const now = new Date('2026-08-17T22:00:00.000Z');
  const stalePeak = inferCapacity({
    energyScore: 9,
    moodScore: 8,
    observedAt: new Date('2026-08-17T07:00:00.000Z'),
    now,
  });
  assert.equal(stalePeak.level, 'media', 'pico das 7h não decide as 22h');
  assert.equal(stalePeak.confidence, 'baixa');

  const freshPeak = inferCapacity({
    energyScore: 9,
    moodScore: 8,
    observedAt: new Date('2026-08-17T20:00:00.000Z'),
    now,
  });
  assert.equal(freshPeak.level, 'alta');

  // ── 10. Correção do mesmo dia: um nível, e só um ───────────────────────────
  const base = inferCapacity({ energyScore: 6, moodScore: 6 });
  assert.equal(base.level, 'media');

  const correctedDown = inferCapacity({
    energyScore: 6, moodScore: 6,
    localDate: '2026-08-17',
    correction: { direction: 'down', localDate: '2026-08-17' },
  });
  assert.equal(correctedDown.level, 'baixa');
  assert.equal(correctedDown.corrected, true);

  const correctedUp = inferCapacity({
    energyScore: 6, moodScore: 6,
    localDate: '2026-08-17',
    correction: { direction: 'up', localDate: '2026-08-17' },
  });
  assert.equal(correctedUp.level, 'alta');

  // Correção de outro dia não vale para hoje.
  const otherDay = inferCapacity({
    energyScore: 6, moodScore: 6,
    localDate: '2026-08-17',
    correction: { direction: 'up', localDate: '2026-08-16' },
  });
  assert.equal(otherDay.level, 'media');
  assert.equal(otherDay.corrected, false);

  // ── 11. Correção não fura o teto de proteção ───────────────────────────────
  const correctionVsSleep = inferCapacity({
    energyScore: 8, measuredSleepMinutes: 300,
    localDate: '2026-08-17',
    correction: { direction: 'up', localDate: '2026-08-17' },
  });
  assert.notEqual(correctionVsSleep.level, 'alta', 'sono medido ruim não vira dia grande por um toque');

  const correctionVsRisk = inferCapacity({
    energyScore: 8, riskRoute: 'adapt_day',
    localDate: '2026-08-17',
    correction: { direction: 'up', localDate: '2026-08-17' },
  });
  assert.notEqual(correctionVsRisk.level, 'alta');

  // Correção para baixo sempre pode: reduzir é seguro.
  const correctionDownAlwaysWorks = inferCapacity({
    energyScore: 9, moodScore: 8,
    localDate: '2026-08-17',
    correction: { direction: 'down', localDate: '2026-08-17' },
  });
  assert.equal(correctionDownAlwaysWorks.level, 'media');

  // ── 12. Viés entre dias: 3 correções, 2 dias distintos ─────────────────────
  assert.equal(correctionBias([]), 0);
  assert.equal(correctionBias([
    { direction: 'up', localDate: '2026-08-15' },
    { direction: 'up', localDate: '2026-08-16' },
  ]), 0, 'duas correções não viram padrão');

  assert.equal(correctionBias([
    { direction: 'up', localDate: '2026-08-15' },
    { direction: 'up', localDate: '2026-08-15' },
    { direction: 'up', localDate: '2026-08-15' },
  ]), 0, 'três correções no mesmo dia não viram padrão');

  assert.equal(correctionBias([
    { direction: 'up', localDate: '2026-08-15' },
    { direction: 'up', localDate: '2026-08-16' },
    { direction: 'up', localDate: '2026-08-16' },
  ]), 1, 'três correções em dois dias distintos viram viés');

  assert.equal(correctionBias([
    { direction: 'up', localDate: '2026-08-14' },
    { direction: 'up', localDate: '2026-08-15' },
    { direction: 'up', localDate: '2026-08-16' },
    { direction: 'down', localDate: '2026-08-17' },
  ]), 0, 'uma correção contrária zera o contador');

  assert.equal(correctionBias([
    { direction: 'down', localDate: '2026-08-14' },
    { direction: 'down', localDate: '2026-08-15' },
    { direction: 'down', localDate: '2026-08-16' },
  ]), -1);

  // O viés desloca no máximo um nível.
  const biased = inferCapacity({
    energyScore: 6, moodScore: 6,
    correctionHistory: [
      { direction: 'down', localDate: '2026-08-14' },
      { direction: 'down', localDate: '2026-08-15' },
      { direction: 'down', localDate: '2026-08-16' },
    ],
  });
  assert.equal(biased.level, 'baixa');
  assert.equal(biased.corrected, true);

  // ── 13. A frase nunca sai vazia e carrega o número ─────────────────────────
  const samples: Array<Record<string, unknown>> = [
    {}, { energyScore: 1 }, { energyScore: 5 }, { energyScore: 9, moodScore: 9 },
    { phaseLabel: 'Turbulência' }, { phaseLabel: 'Fluindo' },
    { riskRoute: 'crisis_protocol' }, { measuredSleepMinutes: 240 },
    { energyScore: 7, declaredSleepHours: 5 },
  ];
  for (const sample of samples) {
    const reading = inferCapacity(sample);
    assert.ok(reading.reason.length > 0, 'reason nunca vazio');
    assert.ok(reading.reason.length <= 240, `reason acima de 240 chars: ${reading.reason}`);
    assert.ok(/[.!?]$/.test(reading.reason), 'reason termina como frase');
    assert.ok(LEVELS.includes(reading.level));
    // Havendo qualquer número entre os sinais, a frase mostra um número — é o
    // que separa "reduzi porque você dormiu 5h" de "reduzi porque sim".
    const hasNumericSignal = ['energyScore', 'moodScore', 'measuredSleepMinutes', 'declaredSleepHours']
      .some((key) => typeof sample[key] === 'number');
    if (hasNumericSignal && !sample.riskRoute) {
      assert.match(reading.reason, /\d/, `frase sem número: ${reading.reason}`);
    }
  }

  // ── 14. Nenhuma frase devolve decisão para a pessoa ────────────────────────
  // A tela removida em fb3d7e5 perguntava o que cabia hoje. A frase da Airia
  // não pode reintroduzir isso por outra porta.
  const forbidden = /\b(escolha|selecione|prefere|o que você (quer|prefere)|qual (deles|delas)|decida)\b/i;
  for (const sample of samples) {
    assert.doesNotMatch(inferCapacity(sample).reason, forbidden, 'a frase não devolve a escolha');
  }

  // ── 15. Adaptadores ────────────────────────────────────────────────────────
  assert.deepEqual(toDecisionFlags('protecao'), { lowCapacity: true, highCapacity: false });
  assert.deepEqual(toDecisionFlags('baixa'), { lowCapacity: true, highCapacity: false });
  assert.deepEqual(toDecisionFlags('media'), { lowCapacity: false, highCapacity: false });
  assert.deepEqual(toDecisionFlags('alta'), { lowCapacity: false, highCapacity: true });

  assert.equal(toGoalCapacity('protecao'), 'quick');
  assert.equal(toGoalCapacity('baixa'), 'quick');
  assert.equal(toGoalCapacity('media'), 'moderate');
  assert.equal(toGoalCapacity('alta'), 'heavy');

  assert.equal(toStepMinutes('protecao'), 10);
  assert.equal(toStepMinutes('alta'), 40);
  assert.ok(toStepMinutes('protecao') < toStepMinutes('baixa'));
  assert.ok(toStepMinutes('baixa') < toStepMinutes('media'));
  assert.ok(toStepMinutes('media') < toStepMinutes('alta'));

  assert.equal(capacityBasisSummary(inferCapacity()), 'nenhum sinal registrado hoje');
  assert.match(capacityBasisSummary(inferCapacity({ energyScore: 2 })), /energia está em 2/);

  console.log('capacity.test.ts OK');
}

const LEVELS: CapacityLevel[] = ['protecao', 'baixa', 'media', 'alta'];

run();
