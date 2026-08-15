#!/usr/bin/env node
/**
 * orchestration-guard — enforcement do contrato de subagentes/LLMs.
 *
 * Regras determinísticas:
 * - edição de código exige contrato inicializado pelo agent-protocol.mjs;
 * - subagentes recebem contexto operacional comum;
 * - SubagentStop exige entrega com estado/evidência;
 * - TaskCompleted/Stop exigem meta-aprovação registrada.
 *
 * Não tenta decidir qualidade de produto. Isso continua sendo responsabilidade
 * do verificador, do verificador de integração e do meta-verificador.
 * Entrada inválida ou estado ilegível falha aberto para não travar a sessão.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_FILE = join(PROJECT_DIR, '.claude', '.state', 'agent-protocol.json');

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SOURCE_RE = /(?:^|[\\/])(apps[\\/](?:web|backend|mobile)[\\/]src[\\/]|packages[\\/].*\.(?:ts|tsx|js|jsx|css|prisma)$|apps[\\/][^\\/]+[\\/](?:package\.json|vite\.config\.ts|tsconfig\.json))/i;
const STATUS_RE = /\b(PASS|FAIL|BLOCKED|BLOQUEADO|HANDOFF_ACCEPTED|HANDOFF_REJECTED|READY_VERIFY|READY_INTEGRATION)\b/i;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    if (!state?.version || !state.task || !state.roles) return null;
    return state;
  } catch {
    return null;
  }
}

function hasApprovedQuality(state) {
  if (!state?.metaApproval || Number(state.metaApproval.score) < 8) return false;
  if (state.roles?.meta?.status !== 'approved' || Number(state.roles.meta.score) < 8) return false;
  return ['verifier', 'integration'].every((role) => {
    const entry = state.roles?.[role];
    return entry && ['pass', 'approved'].includes(entry.status)
      && Number(entry.score) >= 8 && Boolean(entry.evidence);
  });
}

function writeState(state) {
  const directory = dirname(STATE_FILE);
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.agent-protocol-hook.${process.pid}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporary, STATE_FILE);
  } catch {
    try { unlinkSync(temporary); } catch { /* fail open */ }
  }
}

function pathOf(input) {
  if (!input || typeof input !== 'object') return '';
  return String(input.file_path || input.notebook_path || input.path || '');
}

function isSourceEdit(payload) {
  return EDIT_TOOLS.has(String(payload.tool_name || '')) && SOURCE_RE.test(pathOf(payload.tool_input));
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

function protocolContext() {
  return [
    'PROTOCOLO OPERACIONAL OBRIGATÓRIO:',
    '1. Use o contrato em .claude/.state/agent-protocol.json via scripts/agent-protocol.mjs.',
    '2. Entregue evidência com PASS/FAIL/BLOCKED; não aprove o próprio trabalho.',
    '3. Registre handoffs e comunicação entre LLMs com contexto, evidência, decisão e próxima ação.',
    '4. O meta-verificador deve registrar meta-approve antes de DONE.',
    '5. Consulte docs/DEVELOPMENT_ITERATION_PROTOCOL.md e a memória relevante.',
    '6. Se a tarefa afetar produto, UX, IA, fluxo ou arquitetura, consulte docs/product/PRODUCT_CONSTITUTION.md.',
  ].join('\n');
}

function main() {
  const raw = readStdin();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const event = String(payload.hook_event_name || '');
  const state = loadState();

  if (event === 'PreToolUse') {
    if (isSourceEdit(payload) && !state) {
      process.stderr.write(
        'PROTOCOLO BLOQUEOU A EDIÇÃO: inicialize o contrato antes de escrever código.\n' +
        'Execute: node scripts/agent-protocol.mjs init --task-id <id> --objective "<objetivo>"\n',
      );
      process.exitCode = 2;
    }
    return;
  }

  if (event === 'SubagentStart') {
    if (!state) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SubagentStart',
          additionalContext: protocolContext(),
        },
      }));
      return;
    }
    const agentId = String(payload.agent_id || 'unknown');
    state.agents = state.agents || {};
    state.agents[agentId] = {
      agentType: String(payload.agent_type || 'unknown'),
      startedAt: new Date().toISOString(),
      status: 'running',
    };
    writeState(state);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: protocolContext(),
      },
    }));
    return;
  }

  if (event === 'SubagentStop') {
    if (!state || payload.stop_hook_active === true) return;
    const agentId = String(payload.agent_id || 'unknown');
    const lastMessage = String(payload.last_assistant_message || '');
    if (!STATUS_RE.test(lastMessage)) {
      block(`SUBAGENTSTOP BLOQUEADO: o LLM ${agentId} encerrou sem entregar estado e evidência. Responda com PASS, FAIL ou BLOCKED e registre o handoff no contrato.`);
      return;
    }
    state.agents = state.agents || {};
    state.agents[agentId] = {
      ...(state.agents[agentId] || {}),
      stoppedAt: new Date().toISOString(),
      status: 'reported',
      report: lastMessage.slice(-4000),
    };
    writeState(state);
    return;
  }

  if (event === 'TaskCompleted') {
    if (!hasApprovedQuality(state)) {
      block('TASK COMPLETION BLOQUEADA: a tarefa não tem meta-aprovação registrada. O verificador, o verificador de integração e o meta-verificador precisam registrar evidência antes de concluir.');
    }
    return;
  }

  if (event === 'Stop') {
    if (payload.stop_hook_active === true) return;
    if (state && !hasApprovedQuality(state)) {
      block('STOP BLOQUEADO: existe contrato ativo sem meta-aprovação de qualidade. Registre PASS do verificador e da integração com score >= 8, depois execute meta-approve com score >= 8 e evidência.');
    }
  }
}

try {
  main();
} catch {
  // Hook fail-open para entrada/estado inesperado.
}
