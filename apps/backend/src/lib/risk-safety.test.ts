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

  const high = assessRiskSafety({
    text: 'estou sem saida e nao aguento mais',
    moodScore: 2,
    energyScore: 2,
    sleepScore: 2,
  });
  assert.equal(high.riskLevel, 'high');
  assert.equal(high.route, 'human_support');

  const moderate = assessRiskSafety({
    text: 'estou em crise e com insonia',
    moodScore: 4,
    energyScore: 4,
  });
  assert.equal(moderate.riskLevel, 'moderate');
  assert.equal(moderate.route, 'adapt_day');

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
