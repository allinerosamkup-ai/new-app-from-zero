import assert from 'node:assert/strict';

import { computeMenstrualCycle, extractFlowStarts, shouldAskFlowStart } from './menstrual-cycle';

function run() {
  // ── 1. Dias seguidos de fluxo são UMA menstruação, não cinco ──────────────
  assert.deepEqual(
    extractFlowStarts(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']),
    ['2026-08-01'],
  );
  // Falha de registro no meio não parte a menstruação em duas.
  assert.deepEqual(extractFlowStarts(['2026-08-01', '2026-08-03']), ['2026-08-01']);
  // Intervalo grande é outro ciclo.
  assert.deepEqual(
    extractFlowStarts(['2026-08-01', '2026-08-02', '2026-08-29', '2026-08-30']),
    ['2026-08-01', '2026-08-29'],
  );
  assert.deepEqual(extractFlowStarts([]), []);

  // ── 2. Sem nenhum registro: nada é inventado ──────────────────────────────
  const vazio = computeMenstrualCycle({ flowingDays: [], today: '2026-08-17' });
  assert.equal(vazio.cycleDay, null);
  assert.equal(vazio.phase, 'desconhecida');
  assert.equal(vazio.prediction, null, 'sem histórico não existe previsão');
  assert.equal(vazio.confidence, 'nenhuma');
  assert.equal(vazio.askFlowStart, true);

  // ── 3. Primeiro ciclo: dia e fase existem, previsão ainda não ─────────────
  const primeiro = computeMenstrualCycle({ flowingDays: ['2026-08-10'], today: '2026-08-17' });
  assert.equal(primeiro.cycleDay, 8);
  assert.equal(primeiro.observedCycles, 0);
  assert.equal(primeiro.prediction, null, 'um início só não fecha um ciclo');
  assert.equal(primeiro.averageCycleLength, null);
  assert.match(primeiro.summary, /Dia 8/);

  // ── 4. Dois inícios: já dá para prever, com confiança declarada ───────────
  const doisCiclos = computeMenstrualCycle({
    flowingDays: ['2026-07-13', '2026-08-10'],
    today: '2026-08-17',
  });
  assert.equal(doisCiclos.averageCycleLength, 28);
  assert.equal(doisCiclos.observedCycles, 1);
  assert.equal(doisCiclos.confidence, 'provisoria');
  assert.ok(doisCiclos.prediction, 'com um ciclo fechado já há base para prever');
  assert.equal(doisCiclos.cycleDay, 8);

  // ── 5. A faixa da previsão alarga com a irregularidade ────────────────────
  const regular = computeMenstrualCycle({
    flowingDays: ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24'],
    today: '2026-08-01',
  });
  const irregular = computeMenstrualCycle({
    flowingDays: ['2026-05-01', '2026-05-23', '2026-06-26', '2026-07-24'],
    today: '2026-08-01',
  });
  const larguraRegular = new Date(regular.prediction!.nextPeriodTo).getTime()
    - new Date(regular.prediction!.nextPeriodFrom).getTime();
  const larguraIrregular = new Date(irregular.prediction!.nextPeriodTo).getTime()
    - new Date(irregular.prediction!.nextPeriodFrom).getTime();
  assert.ok(
    larguraIrregular > larguraRegular,
    'ciclo irregular precisa produzir faixa mais larga, não previsão igualmente confiante',
  );
  assert.equal(regular.confidence, 'boa');

  // ── 6. Ovulação é contada para trás, da próxima menstruação ───────────────
  //
  // A fase lútea é a estável (~14 dias); a folicular é a que varia. Contar para
  // frente a partir da última menstruação erra em quem tem ciclo longo.
  const longo = computeMenstrualCycle({
    flowingDays: ['2026-06-01', '2026-07-06', '2026-08-10'],
    today: '2026-08-17',
  });
  assert.equal(longo.averageCycleLength, 35);
  const proximaPrevista = new Date('2026-09-14'); // 2026-08-10 + 35
  const ovulacaoEsperada = new Date(proximaPrevista.getTime() - 14 * 86_400_000);
  const fertilFim = new Date(longo.prediction!.fertileTo);
  assert.equal(
    fertilFim.toISOString().slice(0, 10),
    new Date(ovulacaoEsperada.getTime() + 86_400_000).toISOString().slice(0, 10),
    'a janela fértil termina um dia depois da ovulação estimada',
  );

  // A janela fértil tem 6 dias: a ovulação e os cinco anteriores.
  const dias = Math.round(
    (new Date(longo.prediction!.fertileTo).getTime() - new Date(longo.prediction!.fertileFrom).getTime()) / 86_400_000,
  ) + 1;
  assert.equal(dias, 7, 'cinco dias antes + ovulação + o dia seguinte');

  // ── 7. Intervalo implausível é lacuna de registro, não ciclo ──────────────
  const comLacuna = computeMenstrualCycle({
    flowingDays: ['2026-01-05', '2026-07-13', '2026-08-10'],
    today: '2026-08-17',
  });
  assert.equal(comLacuna.observedCycles, 1, 'seis meses de intervalo não é um ciclo de 189 dias');
  assert.equal(comLacuna.averageCycleLength, 28);

  // ── 8. Ausência longa: o app admite que perdeu o fio ──────────────────────
  const perdido = computeMenstrualCycle({ flowingDays: ['2026-06-01'], today: '2026-08-17' });
  assert.equal(perdido.phase, 'desconhecida');
  assert.match(perdido.summary, /perdi o fio/);
  assert.equal(perdido.askFlowStart, true);

  // ── 9. A pergunta some quando o app já sabe a resposta ────────────────────
  //
  // É a razão de a feature existir: não perguntar todo dia o que já foi dito.
  assert.equal(
    shouldAskFlowStart({ lastFlowStart: '2026-08-10', averageCycleLength: 28, today: '2026-08-12' }),
    false,
    'dois dias depois do início, o app não pergunta se começou',
  );
  assert.equal(
    shouldAskFlowStart({ lastFlowStart: '2026-08-10', averageCycleLength: 28, today: '2026-09-05' }),
    true,
    'perto da janela prevista, vale perguntar',
  );
  assert.equal(
    shouldAskFlowStart({ lastFlowStart: '2026-08-10', averageCycleLength: 28, today: '2026-09-20' }),
    true,
    'atrasada: segue perguntando',
  );
  assert.equal(
    shouldAskFlowStart({ lastFlowStart: null, averageCycleLength: null, today: '2026-08-17' }),
    true,
    'sem nenhum registro, precisa perguntar',
  );

  // ── 10. Virada de mês e de ano ────────────────────────────────────────────
  const viradaDeAno = computeMenstrualCycle({
    flowingDays: ['2025-12-20', '2026-01-17'],
    today: '2026-01-20',
  });
  assert.equal(viradaDeAno.averageCycleLength, 28);
  assert.equal(viradaDeAno.cycleDay, 4);
  assert.equal(viradaDeAno.phase, 'menstruacao');

  // ── 11. Nenhuma frase sugere método contraceptivo ─────────────────────────
  //
  // Calcular janela fértil e insinuar que ela serve para evitar gravidez são
  // coisas diferentes, e a segunda é perigosa.
  const proibido = /anticoncep|contracep|evitar\s+gravidez|prote(?:ção|gida)\s+contra|seguro\s+para\s+transar|dia[s]?\s+seguro/i;
  const amostras = [vazio, primeiro, doisCiclos, regular, irregular, longo, perdido, viradaDeAno];
  for (const leitura of amostras) {
    assert.doesNotMatch(leitura.summary, proibido, `frase com leitura contraceptiva: ${leitura.summary}`);
    assert.ok(leitura.summary.length > 0);
  }

  console.log('menstrual-cycle.test.ts OK');
}

run();
