/**
 * TICKET-004 — a frase-robô da falha da IA não é ação concreta.
 */
import assert from 'node:assert/strict';
import { isRobotFallbackPhrase, validateConcreteAction } from '../lib/action-quality';

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
assert.equal(
  validateConcreteAction({
    title: 'Abrir o app do banco e anotar o saldo atual',
    doneWhen: 'o saldo estiver anotado',
  }).ok,
  true,
);

console.log('fallback dignity tests passed');
