import assert from 'node:assert/strict';
import { assessRiskSafety } from './risk-safety';

function run() {
  const crisis = assessRiskSafety({
    text: 'eu nao quero mais viver',
    moodScore: 1,
    energyScore: 1,
  });
  assert.equal(crisis.riskLevel, 'crisis');
  assert.equal(crisis.route, 'crisis_protocol');

  const explicitSelfHarm = assessRiskSafety({
    text: 'eu vou me matar hoje',
    moodScore: 1,
    energyScore: 2,
  });
  assert.equal(explicitSelfHarm.riskLevel, 'crisis');
  assert.equal(explicitSelfHarm.route, 'crisis_protocol');

  const high = assessRiskSafety({
    text: 'estou sem saida e nao aguento mais',
    moodScore: 2,
    energyScore: 2,
    sleepScore: 2,
  });
  assert.equal(high.riskLevel, 'high');
  assert.equal(high.route, 'human_support');

  const violence = assessRiskSafety({
    text: 'estou vivendo violencia e abuso',
    moodScore: 5,
    energyScore: 4,
  });
  assert.equal(violence.riskLevel, 'high');
  assert.equal(violence.route, 'human_support');

  const hopelessness = assessRiskSafety({
    text: 'sinto uma desesperanca enorme e perdi o controle',
    moodScore: 3,
    energyScore: 3,
  });
  assert.equal(hopelessness.riskLevel, 'high');
  assert.equal(hopelessness.route, 'human_support');

  const moderate = assessRiskSafety({
    text: 'estou em crise e com insonia',
    moodScore: 4,
    energyScore: 4,
  });
  assert.equal(moderate.riskLevel, 'moderate');
  assert.equal(moderate.route, 'adapt_day');

  const acceleration = assessRiskSafety({
    text: 'acho que estou em hipomania e dormi quase nada',
    moodScore: 7,
    energyScore: 9,
  });
  assert.equal(acceleration.riskLevel, 'moderate');
  assert.equal(acceleration.route, 'adapt_day');

  const lowSleepWithoutCrisis = assessRiskSafety({
    text: 'dormi muito mal mas consigo trabalhar se reduzir carga',
    moodScore: 6,
    energyScore: 4,
    sleepScore: 1,
  });
  assert.equal(lowSleepWithoutCrisis.riskLevel, 'low');
  assert.equal(lowSleepWithoutCrisis.route, 'adapt_day');

  const moderateDistress = assessRiskSafety({
    text: 'estou em panico e preciso diminuir o dia',
    moodScore: 5,
    energyScore: 5,
  });
  assert.equal(moderateDistress.riskLevel, 'moderate');
  assert.equal(moderateDistress.route, 'adapt_day');

  const none = assessRiskSafety({
    text: 'estou bem e focada',
    moodScore: 8,
    energyScore: 8,
  });
  assert.equal(none.riskLevel, 'none');
  assert.equal(none.route, 'self_support');

  console.log('risk-safety tests passed');
}

run();
