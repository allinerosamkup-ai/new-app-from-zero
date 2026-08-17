import assert from 'node:assert/strict';

import { computeMenstrualCycle, extractFlowStarts, phaseFor, shouldAskFlowStart } from './menstrual-cycle';

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
  assert.equal(vazio.phase, 'unknown');
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
  // A segunda metade do ciclo tem DURAÇÃO estável (~14 dias) e a primeira é a
  // que estica ou encolhe — por isso a âncora é a próxima menstruação, não a
  // última. Contar para frente erra em quem tem ciclo longo.
  //
  // Atenção à palavra: duração estável não é humor estável. A fase de humor
  // estável é a pós-ovulação; a reta final é a TPM, que puxa para baixo.
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
  assert.equal(perdido.phase, 'unknown');
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
  assert.equal(viradaDeAno.phase, 'menstrual');

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

  // ── 12. As fronteiras seguem a duração dela, não um ciclo de 28 ───────────
  //
  // Este é o bug que o modulador antigo tinha: cortes fixos (menstruação até 5,
  // ovulação 14-16, TPM a partir de 23) só valem para quem tem exatamente 28
  // dias. Num ciclo de 35, o dia 21 é ovulação — e as fronteiras fixas o
  // chamavam de pós-ovulação, e o dia 23 de TPM, invertendo o sinal do
  // modificador bem no pico de energia.
  assert.equal(phaseFor(21, 35), 'ovulatory', 'ciclo de 35: ovulação por volta do dia 21');
  assert.equal(phaseFor(15, 35), 'follicular', 'ciclo de 35: dia 15 ainda é pós-menstruação');
  assert.equal(phaseFor(10, 24), 'ovulatory', 'ciclo de 24: ovulação por volta do dia 10');
  assert.equal(phaseFor(15, 28), 'ovulatory', 'ciclo de 28 continua correto');

  // TPM é sempre a reta final, seja qual for a duração.
  assert.equal(phaseFor(25, 28), 'luteal_late');
  assert.equal(phaseFor(32, 35), 'luteal_late');
  assert.equal(phaseFor(21, 24), 'luteal_late');
  // ...e o mesmo dia 25 é a fase estável em quem tem ciclo longo.
  assert.equal(phaseFor(25, 35), 'luteal_early');

  // O mesmo dia do ciclo produz efeitos diferentes conforme a duração — é a
  // prova de que o cálculo é dela, e não de um ciclo de manual.
  const dia21 = [24, 28, 35].map((length) => phaseFor(21, length));
  assert.deepEqual(dia21, ['luteal_late', 'luteal_early', 'ovulatory']);

  // ── 13. Vocabulário único, sem jargão clínico ─────────────────────────────
  //
  // "Fase lútea" não diz nada para quem lê. O produto já tinha nomes humanos e
  // agora existe um conjunto só, aqui e no motor da web.
  const rotulos = new Set<string>();
  for (const length of [24, 28, 35]) {
    for (let day = 1; day <= length; day += 1) {
      rotulos.add(computeMenstrualCycle({
        flowingDays: ['2026-07-01', '2026-08-01'],
        today: '2026-08-01',
      }).phaseLabel);
      void phaseFor(day, length);
    }
  }
  for (const proibido of [/l[úu]tea/i, /folicular/i, /fase\s+lut/i]) {
    for (const rotulo of rotulos) assert.doesNotMatch(rotulo, proibido);
  }

  // ── 14. A frase entrega o efeito, não o nome da fase ──────────────────────
  const tpm = computeMenstrualCycle({
    flowingDays: ['2026-06-08', '2026-07-06', '2026-08-03'],
    today: '2026-08-28', // dia 26 de um ciclo de 28
  });
  assert.equal(tpm.phase, 'luteal_late');
  assert.match(tpm.summary, /irritabilidade/, 'a frase diz o que a fase faz');
  assert.doesNotMatch(tpm.summary, /l[úu]tea/i);
  assert.ok(tpm.moodModifier < 0, 'TPM puxa o humor para baixo');

  const fertil = computeMenstrualCycle({
    flowingDays: ['2026-06-08', '2026-07-06', '2026-08-03'],
    today: '2026-08-17', // dia 15 de um ciclo de 28
  });
  assert.equal(fertil.phase, 'ovulatory');
  assert.ok(fertil.energyModifier > 0, 'a janela fértil é o pico de energia');
  assert.match(fertil.summary, /pico de energia/);

  // A fase estável de humor é a pós-ovulação, e ela não empurra nada.
  const estavel = computeMenstrualCycle({
    flowingDays: ['2026-06-08', '2026-07-06', '2026-08-03'],
    today: '2026-08-22', // dia 20 de um ciclo de 28
  });
  assert.equal(estavel.phase, 'luteal_early');
  assert.equal(estavel.energyModifier, 0);
  assert.equal(estavel.moodModifier, 0);
  assert.match(estavel.summary, /est[áa]vel/);

  // ── 15. Sem duração medida, o app declara que é estimativa ────────────────
  const semHistorico = computeMenstrualCycle({ flowingDays: ['2026-08-10'], today: '2026-08-17' });
  assert.equal(semHistorico.averageCycleLength, null);
  assert.match(semHistorico.summary, /estimativa/, 'não apresenta 28 dias como se fosse o ciclo dela');

  console.log('menstrual-cycle.test.ts OK');
}

run();
