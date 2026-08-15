import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const hook = fileURLToPath(new URL('../.claude/hooks/verification-guard.mjs', import.meta.url));

function workspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'verification-guard-test-'));
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

function cleanup(cwd) {
  rmSync(cwd, { recursive: true, force: true });
}

function editPayload(sessionId, cwd) {
  return {
    hook_event_name: 'PostToolUse',
    session_id: sessionId,
    tool_name: 'Edit',
    tool_input: { file_path: join(cwd, 'apps', 'web', 'src', 'App.tsx') },
  };
}

test('Stop e TaskCompleted bloqueiam alteração sem verificação', () => {
  const cwd = workspace();
  try {
    const sessionId = 'session-unverified';
    assert.equal(run(cwd, editPayload(sessionId, cwd)).status, 0);

    const stop = run(cwd, { hook_event_name: 'Stop', session_id: sessionId });
    assert.equal(stop.status, 0);
    assert.equal(JSON.parse(stop.stdout).decision, 'block');

    const completed = run(cwd, {
      hook_event_name: 'TaskCompleted',
      session_id: sessionId,
      task_subject: 'verificação isolada',
    });
    assert.equal(JSON.parse(completed.stdout).decision, 'block');
  } finally {
    cleanup(cwd);
  }
});

test('tentativa de verificação libera parada, inclusive quando falha', () => {
  const cwd = workspace();
  try {
    const sessionId = 'session-verified';
    assert.equal(run(cwd, editPayload(sessionId, cwd)).status, 0);
    assert.equal(run(cwd, {
      hook_event_name: 'PostToolUse',
      session_id: sessionId,
      tool_name: 'Bash',
      tool_input: { command: 'npm test -- --runInBand' },
    }).status, 0);

    const stop = run(cwd, { hook_event_name: 'Stop', session_id: sessionId });
    assert.equal(stop.status, 0, stop.output);
    assert.equal(stop.stdout, '');
  } finally {
    cleanup(cwd);
  }
});

test('Stop respeita stop_hook_active e entrada inválida falha aberto', () => {
  const cwd = workspace();
  try {
    const sessionId = 'session-recursive';
    assert.equal(run(cwd, editPayload(sessionId, cwd)).status, 0);
    const recursive = run(cwd, { hook_event_name: 'Stop', session_id: sessionId, stop_hook_active: true });
    assert.equal(recursive.status, 0);
    assert.equal(recursive.stdout, '');

    const malformed = spawnSync(process.execPath, [hook], {
      cwd,
      input: '{invalid json}\n',
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    });
    assert.equal(malformed.status, 0);
    assert.equal(malformed.stdout, '');
  } finally {
    cleanup(cwd);
  }
});
