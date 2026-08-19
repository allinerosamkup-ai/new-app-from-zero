import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatConcreteAction,
  validateConcreteAction,
  validateVisibleConcreteAction,
} from './action-quality';

describe('contrato compartilhado de ação concreta', () => {
  it('aceita verbo executável, objeto específico e evidência de término', () => {
    assert.deepEqual(
      validateConcreteAction({
        title: 'Abrir o app do banco e anotar o saldo atual',
        doneWhen: 'o saldo estiver anotado',
      }),
      { ok: true },
    );
  });

  it('rejeita a formulação abstrata e circular reportada pela usuária', () => {
    const verdict = validateConcreteAction({
      title: 'Escolher revisar uma pendência financeira revisável',
      doneWhen: 'a pendência estiver revisada',
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok ? '' : verdict.reason, 'abstract_or_circular_action');
  });

  it('rejeita uma ação sem critério de término mesmo quando o movimento é concreto', () => {
    const verdict = validateConcreteAction({ title: 'Listar as três contas que vencem nesta semana' });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok ? '' : verdict.reason, 'missing_done_when');
  });

  it('rejeita uma ação legada abstrata mesmo quando ela traz um término aparente', () => {
    const verdict = validateConcreteAction({
      title: 'Separar uma decisão financeira reversível para hoje',
      doneWhen: 'a decisão estiver separada',
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok ? '' : verdict.reason, 'abstract_or_circular_action');
  });

  it('protege o formato textual usado pelo Check-in', () => {
    const text = formatConcreteAction({
      title: 'Listar as três contas que vencem nesta semana',
      doneWhen: 'as três contas estiverem em uma nota',
    });
    assert.equal(text, 'Listar as três contas que vencem nesta semana. Pronto quando: as três contas estiverem em uma nota.');
    assert.deepEqual(validateVisibleConcreteAction(text), { ok: true });
    assert.equal(validateVisibleConcreteAction('Revisar uma pendência financeira.').ok, false);
  });
});
