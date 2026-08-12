#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_FILE = join(PROJECT_DIR, '.claude', '.state', 'agent-protocol.json');
const ROLES = ['coordinator', 'executor', 'verifier', 'integration', 'meta'];
const ROLE_STATUSES = ['assigned', 'ready_verify', 'pass', 'fail', 'blocked', 'approved'];
const CHANNELS = ['horizontal', 'vertical'];
const MESSAGE_TYPES = ['finding', 'dependency', 'conflict', 'pass', 'fail', 'blocked'];
const HORIZONTAL_TYPES = new Set(['finding', 'dependency', 'conflict']);
const VERTICAL_TYPES = new Set(['pass', 'fail', 'blocked']);

const ROLE_TRANSITIONS = {
  assigned: new Set(['assigned', 'ready_verify', 'fail', 'blocked']),
  ready_verify: new Set(['ready_verify', 'pass', 'fail', 'blocked']),
  pass: new Set(['pass']),
  fail: new Set(['fail', 'assigned', 'blocked']),
  blocked: new Set(['blocked', 'assigned']),
  approved: new Set(['approved']),
};

const SECRET_PATTERN = /(?:-----BEGIN [A-Z ]+PRIVATE KEY-----|bearer\s+[a-z0-9._~+/=-]{12,}|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\s*[:=]\s*\S+|\bsk-[a-z0-9]{16,}\b|\bgh[pousr]_[a-z0-9_]{20,}\b)/i;
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
  }
}

function fail(message) {
  throw new ProtocolError(message);
}

function requireText(value, label, maxLength = 4000) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} é obrigatório.`);
  }
  if (value.length > maxLength) {
    fail(`${label} excede o limite de ${maxLength} caracteres.`);
  }
  if (CONTROL_PATTERN.test(value)) {
    fail(`${label} contém caracteres de controle inválidos.`);
  }
  if (SECRET_PATTERN.test(value)) {
    fail(`${label} parece conter um segredo; nenhum segredo pode ser gravado.`);
  }
  return value.trim();
}

function requireEnum(value, label, allowed) {
  if (!allowed.includes(value)) {
    fail(`${label} inválido: ${value ?? '(ausente)'}. Valores aceitos: ${allowed.join(', ')}.`);
  }
  return value;
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  if (!command) {
    fail(`comando ausente. Uso: init | role | message | meta-approve | status | reset.`);
  }

  const options = {};
  const definitions = {
    '--task-id': { key: 'taskId', takesValue: true },
    '--objective': { key: 'objective', takesValue: true },
    '--role': { key: 'role', takesValue: true },
    '--agent': { key: 'agent', takesValue: true },
    '--status': { key: 'status', takesValue: true },
    '--evidence': { key: 'evidence', takesValue: true },
    '--channel': { key: 'channel', takesValue: true },
    '--type': { key: 'type', takesValue: true },
    '--from': { key: 'from', takesValue: true },
    '--to': { key: 'to', takesValue: true },
    '--fact': { key: 'fact', takesValue: true },
    '--action': { key: 'action', takesValue: true },
    '--force': { key: 'force', takesValue: false },
    '--json': { key: 'json', takesValue: false },
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const definition = definitions[token];
    if (!definition) {
      fail(`argumento desconhecido: ${token}.`);
    }
    if (Object.hasOwn(options, definition.key)) {
      fail(`argumento repetido: ${token}.`);
    }
    if (definition.takesValue) {
      const value = tokens[index + 1];
      if (!value || value.startsWith('--')) {
        fail(`${token} exige um valor.`);
      }
      options[definition.key] = value;
      index += 1;
    } else {
      options[definition.key] = true;
    }
  }

  const allowedByCommand = {
    init: ['taskId', 'objective', 'json'],
    role: ['role', 'agent', 'status', 'evidence', 'json'],
    message: ['channel', 'type', 'from', 'to', 'fact', 'evidence', 'action', 'json'],
    'meta-approve': ['evidence', 'json'],
    status: ['json'],
    reset: ['force', 'json'],
  };
  if (!allowedByCommand[command]) {
    fail(`comando desconhecido: ${command}.`);
  }
  for (const key of Object.keys(options)) {
    if (!allowedByCommand[command].includes(key)) {
      fail(`argumento --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} não é aceito por ${command}.`);
    }
  }

  return { command, options };
}

function stateOrNull() {
  if (!existsSync(STATE_FILE)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch (error) {
    fail(`estado inválido ou ilegível em ${STATE_FILE}: ${error.message}`);
  }
  if (!parsed || parsed.version !== 1 || !parsed.task || !parsed.roles || !Array.isArray(parsed.messages)) {
    fail(`estado inválido em ${STATE_FILE}: formato de contrato não reconhecido.`);
  }
  return parsed;
}

function requireState() {
  const state = stateOrNull();
  if (!state) fail('nenhuma tarefa inicializada. Execute init primeiro.');
  return state;
}

function writeState(state) {
  const directory = dirname(STATE_FILE);
  mkdirSync(directory, { recursive: true });
  const temporaryFile = join(directory, `.agent-protocol.${process.pid}.${randomUUID()}.tmp`);
  const content = `${JSON.stringify(state, null, 2)}\n`;
  let descriptor;
  try {
    writeFileSync(temporaryFile, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    descriptor = openSync(temporaryFile, 'r+');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryFile, STATE_FILE);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      unlinkSync(temporaryFile);
    } catch {
      // O erro original é mais útil do que uma falha de limpeza do temporário.
    }
    fail(`não foi possível gravar o estado atomicamente: ${error.message}`);
  }
}

function now() {
  return new Date().toISOString();
}

function baseState(taskId, objective) {
  const timestamp = now();
  return {
    version: 1,
    task: {
      id: requireText(taskId, 'task-id', 128),
      objective: requireText(objective, 'objective'),
      status: 'active',
      initializedAt: timestamp,
      updatedAt: timestamp,
    },
    roles: Object.fromEntries(ROLES.map((role) => [role, null])),
    messages: [],
    metaApproval: null,
  };
}

function touch(state) {
  state.task.updatedAt = now();
}

function createContract(options) {
  if (stateOrNull()) fail('já existe uma tarefa ativa ou um contrato existente; use reset --force antes de iniciar outra.');
  const state = baseState(options.taskId, options.objective);
  writeState(state);
  return { state, message: `Contrato criado para a tarefa ${state.task.id}.` };
}

function recordRole(options) {
  const state = requireState();
  const role = requireEnum(options.role, 'role', ROLES);
  const status = requireEnum(options.status, 'status', ROLE_STATUSES);
  const agent = requireText(options.agent, 'agent', 200);
  const evidence = requireText(options.evidence, 'evidence');
  if (status === 'approved') {
    fail('approved só pode ser registrado por meta-approve após o gate completo.');
  }
  if (role === 'meta' && status === 'pass') {
    fail('o papel meta deve ser aprovado por meta-approve, não por role --status pass.');
  }
  if (state.task.status === 'approved') fail('a tarefa já foi meta-aprovada e não aceita novas transições.');

  const previous = state.roles[role];
  if (!previous && status !== 'assigned') {
    fail(`transição inválida para ${role}: uma atribuição nova deve começar em assigned.`);
  }
  if (previous && !ROLE_TRANSITIONS[previous.status]?.has(status)) {
    fail(`transição inválida para ${role}: ${previous.status} → ${status}.`);
  }
  state.roles[role] = {
    agent,
    status,
    evidence,
    updatedAt: now(),
  };
  touch(state);
  writeState(state);
  return { state, message: `Papel ${role} registrado como ${status}.` };
}

function recordMessage(options) {
  const state = requireState();
  const channel = requireEnum(options.channel, 'channel', CHANNELS);
  const type = requireEnum(options.type, 'type', MESSAGE_TYPES);
  const validTypes = channel === 'horizontal' ? HORIZONTAL_TYPES : VERTICAL_TYPES;
  if (!validTypes.has(type)) {
    fail(`tipo ${type} não é válido para o canal ${channel}.`);
  }
  const message = {
    id: randomUUID(),
    channel,
    type,
    from: requireText(options.from, 'from', 200),
    to: requireText(options.to, 'to', 200),
    fact: requireText(options.fact, 'fact'),
    evidence: requireText(options.evidence, 'evidence'),
    action: requireText(options.action, 'action'),
    createdAt: now(),
  };
  state.messages.push(message);
  touch(state);
  writeState(state);
  return { state, message: `Mensagem ${channel}/${type} registrada.` };
}

function metaApprove(options) {
  const state = requireState();
  if (state.task.status === 'approved') fail('a tarefa já foi meta-aprovada.');
  const evidence = requireText(options.evidence, 'evidence');
  const requiredRoles = ['executor', 'verifier', 'integration'];
  const missing = requiredRoles.filter((role) => {
    const entry = state.roles[role];
    return !entry || !['pass', 'approved'].includes(entry.status) || !entry.evidence;
  });
  if (missing.length > 0) {
    fail(`meta-aprovação recusada; papéis sem pass/approved e evidência: ${missing.join(', ')}.`);
  }

  const timestamp = now();
  state.roles.meta = {
    agent: state.roles.meta?.agent ?? 'meta-verifier',
    status: 'approved',
    evidence,
    updatedAt: timestamp,
  };
  state.metaApproval = { evidence, approvedAt: timestamp };
  state.task.status = 'approved';
  touch(state);
  writeState(state);
  return { state, message: 'Meta-aprovação registrada; tarefa aprovada.' };
}

function resetState(options) {
  if (!options.force) fail('reset exige confirmação explícita com --force.');
  if (!stateOrNull()) fail('não há estado de tarefa para remover.');
  unlinkSync(STATE_FILE);
  return { state: null, message: 'Estado da tarefa atual removido.' };
}

function readableStatus(state) {
  const roles = ROLES
    .map((role) => {
      const entry = state.roles[role];
      return `  ${role}: ${entry ? `${entry.status} (${entry.agent})` : 'não atribuído'}`;
    })
    .join('\n');
  return [
    `Tarefa: ${state.task.id}`,
    `Objetivo: ${state.task.objective}`,
    `Estado: ${state.task.status}`,
    'Papéis:',
    roles,
    `Mensagens: ${state.messages.length}`,
    `Meta-aprovação: ${state.metaApproval ? 'sim' : 'não'}`,
  ].join('\n');
}

function statusCommand() {
  const state = requireState();
  return { state, message: readableStatus(state) };
}

function output(result, json) {
  const payload = { ok: true, ...result };
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(result.message);
  if (result.state && result.message.startsWith('Tarefa:') === false && result.state.task.status === 'approved') {
    console.log(`Estado da tarefa: ${result.state.task.status}.`);
  }
}

export function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
    let result;
    switch (parsed.command) {
      case 'init':
        result = createContract(parsed.options);
        break;
      case 'role':
        result = recordRole(parsed.options);
        break;
      case 'message':
        result = recordMessage(parsed.options);
        break;
      case 'meta-approve':
        result = metaApprove(parsed.options);
        break;
      case 'status':
        result = statusCommand();
        break;
      case 'reset':
        result = resetState(parsed.options);
        break;
      default:
        fail(`comando desconhecido: ${parsed.command}.`);
    }
    output(result, parsed.options.json);
    return 0;
  } catch (error) {
    const message = error instanceof ProtocolError ? error.message : `falha inesperada: ${error.message}`;
    const json = parsed?.options?.json ?? argv.includes('--json');
    if (json) console.error(JSON.stringify({ ok: false, error: message }));
    else console.error(`ERRO: ${message}`);
    return 1;
  }
}

if (process.argv[1] && join(process.cwd(), process.argv[1]) === join(process.cwd(), import.meta.filename ?? '')) {
  process.exitCode = main();
}
