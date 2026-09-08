/**
 * TICKET-004 — falha honesta.
 *
 * Quando a IA estoura o prazo, o sistema não pode gravar "Escreva o resultado…"
 * nem um pack genérico como se fosse decomposição. Este arquivo trava isso.
 */
import assert from 'node:assert/strict';
import {
  buildFailedGoalDecomposition,
  buildFallbackGoalDecomposition,
  isConversationalPhrase,
} from './goal-intelligence.service';
import { isRobotFallbackPhrase, validateConcreteAction } from '../lib/action-quality';

assert.equal(isConversationalPhrase('Olá tudo bem'), true);
assert.equal(isConversationalPhrase('Obrigada'), true);
assert.equal(isConversationalPhrase('Correr 3 vezes na semana'), false);

const failed = buildFailedGoalDecomposition('decomposition_deadline');
assert.equal(failed.mode, 'failed');
assert.equal(failed.steps.length, 0);
assert.equal(failed.question, null);

const untitled = buildFallbackGoalDecomposition({ goalTitle: '   ' });
assert.equal(untitled.mode, 'question');

const named = buildFallbackGoalDecomposition({ goalTitle: 'Correr 3 x na semana' });
assert.equal(named.mode, 'failed');
assert.equal(named.steps.length, 0);

assert.equal(
  isRobotFallbackPhrase('Escreva o resultado que fará Organizar a semana avançar'),
  true,
);
assert.equal(
  validateConcreteAction({
    title: 'Escreva o resultado que fará Correr 3 x na semana avançar',
    doneWhen: 'o resultado estiver escrito',
  }).ok,
  false,
);
assert.equal(
  validateConcreteAction({
    title: 'Analise o que impede Organizar minhas finanças agora',
    doneWhen: 'a análise estiver feita',
  }).ok,
  false,
);

console.log('fallback dignity tests passed');
