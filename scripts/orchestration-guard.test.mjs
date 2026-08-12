import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const hook = fileURLToPath(new URL('../.claude/hooks/orchestration-guard.mjs', import.meta.url));

function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'orchestration-guard-test-'));
  mkdirSync(join(cwd, 'apps', 'web', 'src'), { recursive: true });
  writeFileSync(join(cwd, 'apps', 'web', 'src', 'App.tsx'), 'export {}\n');
  return cwd;
}

function run(cwd, payload) {
  const result = spawnSync(process.execPath, [hook], {
    cwd,
    input: `${JSON.stringify(payload)}\n`,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function writeState(cwd, metaApproval = null) {
  mkdirSync(join(cwd, '.claude', '.state'), { recursive: true });
  writeFileSync(join(cwd, '.claude', '.state', 'agent-protocol.json'), JSON.stringify({
    version: 1,
    task: { id: 'guard-test', objective: 'Testar enforcement', status: metaApproval ? 'approved' : 'active' },
    roles: {},
    messages: [],
    metaApproval,
  }));
}

function cleanup(cwd) {
  rmSync(cwd, { recursive: true, force: true });
}

test('PreToolUse bloqueia código sem contrato inicializado', () => {
  const cwd = workspace();
  try {
    const result = run(cwd, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: join(cwd, 'apps', 'web', 'src', 'App.tsx') },
    });
    assert.equal(result.status, 2, result.output);
    assert.match(result.output, /inicialize o contrato/i);
  } finally {
    cleanup(cwd);
  }
});

test('SubagentStart injeta contexto mesmo antes da inicialização', () => {
  const cwd = workspace();
  try {
    const result = run(cwd, { hook_event_name: 'SubagentStart', agent_id: 'executor-1' });
    assert.equal(result.status, 0, result.output);
    const response = JSON.parse(result.stdout);
    assert.match(response.hookSpecificOutput.additionalContext, /PROTOCOLO OPERACIONAL OBRIGATÓRIO/);
  } finally {
    cleanup(cwd);
  }
});

test('TaskCompleted bloqueia contrato sem meta-aprovação', () => {
  const cwd = workspace();
  try {
    writeState(cwd);
    const result = run(cwd, { hook_event_name: 'TaskCompleted' });
    assert.equal(result.status, 0, result.output);
    assert.equal(JSON.parse(result.stdout).decision, 'block');
    assert.match(result.stdout, /meta-aprova/i);
  } finally {
    cleanup(cwd);
  }
});

test('Stop respeita stop_hook_active e bloqueia encerramento sem meta-aprovação', () => {
  const cwd = workspace();
  try {
    writeState(cwd);
    const recursive = run(cwd, { hook_event_name: 'Stop', stop_hook_active: true });
    assert.equal(recursive.status, 0);
    assert.equal(recursive.stdout, '');

    const blocked = run(cwd, { hook_event_name: 'Stop' });
    assert.equal(JSON.parse(blocked.stdout).decision, 'block');
  } finally {
    cleanup(cwd);
  }
});

test('Stop libera encerramento depois da meta-aprovação', () => {
  const cwd = workspace();
  try {
    writeState(cwd, { evidence: 'executor, verifier e integration aprovados' });
    const result = run(cwd, { hook_event_name: 'Stop' });
    assert.equal(result.status, 0, result.output);
    assert.equal(result.stdout, '');
  } finally {
    cleanup(cwd);
  }
});

test('SubagentStop exige estado e evidência, mas aceita handoff reportado', () => {
  const cwd = workspace();
  try {
    writeState(cwd);
    const blocked = run(cwd, { hook_event_name: 'SubagentStop', agent_id: 'executor-1', last_assistant_message: 'Terminei.' });
    assert.equal(JSON.parse(blocked.stdout).decision, 'block');

    const accepted = run(cwd, {
      hook_event_name: 'SubagentStop',
      agent_id: 'executor-1',
      last_assistant_message: 'PASS. Evidência: node --test scripts/agent-protocol.test.mjs. HANDOFF_ACCEPTED para integração.',
    });
    assert.equal(accepted.status, 0, accepted.output);
    assert.equal(accepted.stdout, '');
    assert.match(JSON.stringify(readState(cwd)), /reported/);
  } finally {
    cleanup(cwd);
  }
});

function readState(cwd) {
  return JSON.parse(readFileSync(join(cwd, '.claude', '.state', 'agent-protocol.json'), 'utf8'));
}
