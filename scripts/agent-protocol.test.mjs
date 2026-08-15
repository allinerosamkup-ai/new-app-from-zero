import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const cli = fileURLToPath(new URL('./agent-protocol.mjs', import.meta.url));

function run(args, cwd, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    ...options,
  });

  return {
    ...result,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function workspace() {
  return mkdtempSync(join(tmpdir(), 'agent-protocol-test-'));
}

function stateAt(cwd) {
  return JSON.parse(readFileSync(join(cwd, '.claude', '.state', 'agent-protocol.json'), 'utf8'));
}

function cleanup(cwd) {
  rmSync(cwd, { recursive: true, force: true });
}

function init(cwd) {
  return run(['init', '--task-id', 'task-123', '--objective', 'Entregar o contrato operacional'], cwd);
}

function assignAndPass(cwd, role, agent, score) {
  assert.equal(run(['role', '--role', role, '--agent', agent, '--status', 'assigned', '--evidence', 'Escopo recebido'], cwd).status, 0);
  assert.equal(run(['role', '--role', role, '--agent', agent, '--status', 'ready_verify', '--evidence', 'Implementação pronta para verificação'], cwd).status, 0);
  const scoreArgs = score === undefined ? [] : ['--score', String(score)];
  assert.equal(run(['role', '--role', role, '--agent', agent, '--status', 'pass', '--evidence', 'Critérios verificados', ...scoreArgs], cwd).status, 0);
}

test('init cria o contrato e recusa substituir uma tarefa ativa', () => {
  const cwd = workspace();
  try {
    const created = init(cwd);
    assert.equal(created.status, 0, created.output);

    const state = stateAt(cwd);
    assert.equal(state.task.id, 'task-123');
    assert.equal(state.task.objective, 'Entregar o contrato operacional');
    assert.equal(state.task.status, 'active');
    assert.deepEqual(state.messages, []);

    const duplicate = run(['init', '--task-id', 'task-999', '--objective', 'Substituir'], cwd);
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.output, /ativa|existente/i);

    const jsonStatus = run(['status', '--json'], cwd);
    assert.equal(jsonStatus.status, 0, jsonStatus.output);
    const response = JSON.parse(jsonStatus.stdout);
    assert.equal(response.ok, true);
    assert.equal(response.state.task.id, 'task-123');
  } finally {
    cleanup(cwd);
  }
});

test('role recusa transição inválida e exige argumentos válidos', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);

    const invalid = run([
      'role', '--role', 'executor', '--agent', 'llm-executor', '--status', 'pass',
      '--evidence', 'Tentativa sem verificação',
    ], cwd);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.output, /transição|transition/i);

    const missing = run(['role', '--role', 'executor', '--agent', 'llm-executor', '--status', 'assigned'], cwd);
    assert.notEqual(missing.status, 0);
    assert.match(missing.output, /evidence|evidência/i);

    const malformed = run([
      'role', '--role', 'unknown', '--agent', 'llm-executor', '--status', 'assigned',
      '--evidence', 'Escopo recebido',
    ], cwd);
    assert.notEqual(malformed.status, 0);

    const invalidScore = run([
      'role', '--role', 'verifier', '--agent', 'llm-verifier', '--status', 'assigned',
      '--evidence', 'Escopo recebido', '--score', 'eleven',
    ], cwd);
    assert.notEqual(invalidScore.status, 0);
    assert.match(invalidScore.output, /score.*0 e 10/i);

    const outOfRangeScore = run([
      'role', '--role', 'verifier', '--agent', 'llm-verifier', '--status', 'assigned',
      '--evidence', 'Escopo recebido', '--score', '11',
    ], cwd);
    assert.notEqual(outOfRangeScore.status, 0);

    const unsupportedScore = run([
      'init', '--task-id', 'task-score', '--objective', 'Contrato', '--score', '8',
    ], cwd);
    assert.notEqual(unsupportedScore.status, 0);
  } finally {
    cleanup(cwd);
  }
});

test('message registra comunicações horizontal e vertical', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);

    const horizontal = run([
      'message', '--channel', 'horizontal', '--type', 'finding', '--from', 'executor-a',
      '--to', 'executor-b', '--fact', 'O contrato usa um único arquivo de estado',
      '--evidence', 'Leitura do plano e do Git', '--action', 'Reutilizar o caminho existente',
    ], cwd);
    assert.equal(horizontal.status, 0, horizontal.output);

    const vertical = run([
      'message', '--channel', 'vertical', '--type', 'pass', '--from', 'verifier',
      '--to', 'coordinator', '--fact', 'Os testes focados passaram', '--evidence',
      'node --test scripts/agent-protocol.test.mjs', '--action', 'Entregar para integração',
    ], cwd);
    assert.equal(vertical.status, 0, vertical.output);

    const messages = stateAt(cwd).messages;
    assert.equal(messages.length, 2);
    assert.equal(messages[0].channel, 'horizontal');
    assert.equal(messages[0].type, 'finding');
    assert.equal(messages[1].channel, 'vertical');
    assert.equal(messages[1].type, 'pass');

    const wrongPair = run([
      'message', '--channel', 'horizontal', '--type', 'pass', '--from', 'a', '--to', 'b',
      '--fact', 'Fato', '--evidence', 'Evidência', '--action', 'Ação',
    ], cwd);
    assert.notEqual(wrongPair.status, 0);
  } finally {
    cleanup(cwd);
  }
});

test('meta-approve recusa gate incompleto', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);
    assignAndPass(cwd, 'executor', 'llm-executor');
    assignAndPass(cwd, 'verifier', 'llm-verifier', 8);

    const incomplete = run(['meta-approve', '--evidence', 'Executor e verificador passaram', '--score', '8'], cwd);
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.output, /integration|integração|pass|aprov/i);
    assert.equal(stateAt(cwd).metaApproval, null);
  } finally {
    cleanup(cwd);
  }
});

test('meta-approve aprova após executor, verifier e integration passarem', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);
    assignAndPass(cwd, 'executor', 'llm-executor');
    assignAndPass(cwd, 'verifier', 'llm-verifier', 8.5);
    assignAndPass(cwd, 'integration', 'llm-integration', 9);

    const approved = run(['meta-approve', '--evidence', 'Todos os gates foram verificados', '--score', '8.5'], cwd);
    assert.equal(approved.status, 0, approved.output);

    const state = stateAt(cwd);
    assert.equal(state.task.status, 'approved');
    assert.equal(state.roles.meta.status, 'approved');
    assert.equal(state.roles.verifier.score, 8.5);
    assert.equal(state.roles.integration.score, 9);
    assert.equal(state.roles.meta.score, 8.5);
    assert.equal(state.metaApproval.evidence, 'Todos os gates foram verificados');
    assert.equal(state.metaApproval.score, 8.5);

    const readable = run(['status'], cwd);
    assert.equal(readable.status, 0, readable.output);
    assert.match(readable.stdout, /verifier: pass \(llm-verifier, score: 8\.5\)/);
    assert.match(readable.stdout, /Meta-aprovação: sim \(score: 8\.5\)/);

    const jsonStatus = run(['status', '--json'], cwd);
    assert.equal(jsonStatus.status, 0, jsonStatus.output);
    const json = JSON.parse(jsonStatus.stdout);
    assert.equal(json.state.roles.integration.score, 9);
    assert.equal(json.state.metaApproval.score, 8.5);
  } finally {
    cleanup(cwd);
  }
});

test('verifier e integration recusam pass com score abaixo de 8', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);
    for (const role of ['verifier', 'integration']) {
      assert.equal(run(['role', '--role', role, '--agent', `llm-${role}`, '--status', 'assigned', '--evidence', 'Escopo recebido'], cwd).status, 0);
      assert.equal(run(['role', '--role', role, '--agent', `llm-${role}`, '--status', 'ready_verify', '--evidence', 'Implementação pronta'], cwd).status, 0);
      const rejected = run([
        'role', '--role', role, '--agent', `llm-${role}`, '--status', 'pass',
        '--evidence', 'Resultado abaixo do limiar', '--score', '7.99',
      ], cwd);
      assert.notEqual(rejected.status, 0, rejected.output);
      assert.match(rejected.output, /score.*8/i);
    }
  } finally {
    cleanup(cwd);
  }
});

test('meta-approve recusa score abaixo de 8 e aceita score válido', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);
    assignAndPass(cwd, 'executor', 'llm-executor');
    assignAndPass(cwd, 'verifier', 'llm-verifier', 8);
    assignAndPass(cwd, 'integration', 'llm-integration', 8);

    const missingScore = run(['meta-approve', '--evidence', 'Gate sem nota'], cwd);
    assert.notEqual(missingScore.status, 0, missingScore.output);
    assert.match(missingScore.output, /score.*obrigatório/i);

    const rejected = run(['meta-approve', '--evidence', 'Gate insuficiente', '--score', '7'], cwd);
    assert.notEqual(rejected.status, 0, rejected.output);
    assert.match(rejected.output, /score.*8/i);
    assert.equal(stateAt(cwd).metaApproval, null);

    const approved = run(['meta-approve', '--evidence', 'Gate impressionante e integrado', '--score', '8'], cwd);
    assert.equal(approved.status, 0, approved.output);
    assert.equal(stateAt(cwd).metaApproval.score, 8);
  } finally {
    cleanup(cwd);
  }
});

test('reset exige --force e remove somente o estado ignorado', () => {
  const cwd = workspace();
  try {
    assert.equal(init(cwd).status, 0);
    const refused = run(['reset'], cwd);
    assert.notEqual(refused.status, 0);
    assert.match(refused.output, /force/i);

    const reset = run(['reset', '--force', '--json'], cwd);
    assert.equal(reset.status, 0, reset.output);
    assert.equal(JSON.parse(reset.stdout).ok, true);
    assert.throws(() => stateAt(cwd), /ENOENT/);
  } finally {
    cleanup(cwd);
  }
});
