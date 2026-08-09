#!/usr/bin/env node
/**
 * verification-guard — barreira determinística contra conclusão prematura.
 *
 * Problema que resolve: o agente altera arquivo de código-fonte e tenta encerrar
 * a sessão sem ter rodado nenhuma verificação. Ver docs/DEVELOPMENT_ITERATION_PROTOCOL.md §21.
 *
 * Como funciona:
 *   PostToolUse (Edit/Write/...)  → registra arquivo de código alterado e "arma" o guard
 *   PostToolUse (Bash/PowerShell) → se o comando for de verificação, marca verificado
 *   PostToolUse (browser/preview) → marca verificado (inspeção de runtime/UI)
 *   Stop/SubagentStop             → se há código alterado e nada foi verificado, bloqueia UMA vez
 *   TaskCompleted                 → impede fechar subtarefa com código alterado e nada verificado
 *
 * O que ele NÃO faz, de propósito:
 *   - não executa testes (seria lento e caro a cada parada);
 *   - não julga se a verificação foi suficiente — isso é julgamento, fica no protocolo;
 *   - respeita stop_hook_active no Stop/SubagentStop;
 *   - não impede parada por bloqueio legítimo: qualquer verificação executada,
 *     mesmo falhando, libera a parada.
 *
 * Falha para o lado seguro: qualquer erro interno resulta em exit 0 sem bloquear.
 *
 * Este arquivo é .mjs de propósito: o .gitignore do repo engole `**\/*.js`.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = join(PROJECT_DIR, '.claude', '.state');

/** Arquivos cuja alteração exige verificação. */
const SOURCE_RE =
  /(apps[\\/](web|backend|mobile)[\\/]src[\\/].*\.(ts|tsx|js|jsx|css|json)|packages[\\/].*\.(ts|prisma)|apps[\\/][^\\/]+[\\/](package\.json|vite\.config\.ts|tsconfig\.json)|packages[\\/][^\\/]+[\\/]package\.json)$/i;

/** Alterações que não pedem verificação de comportamento. */
const IGNORE_RE = /([\\/]|^)(docs|\.claude|\.dummy|node_modules|dist|build|artifacts|tmp|scratch)[\\/]|\.md$/i;

/** Comandos que contam como verificação executada. */
const VERIFY_CMD_RE =
  /\b(npm\s+(run\s+)?(test|typecheck|build|lint|aura:eval|ai:smoke|ai:judge-bench|generate)|vitest|ts-node-transpile-only|ts-node|tsc\b|jest|prisma\s+(generate|db)|curl[^|]*\/(api\/)?health)/i;

/** Ferramentas de navegador/preview: inspeção de runtime e UI. */
const VERIFY_TOOL_RE = /^mcp__(playwright|Claude_Browser|claude-in-chrome|previewbridge)__|^(preview_start|preview_logs)$/;

const EDIT_TOOL_RE = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
const SHELL_TOOL_RE = /^(Bash|PowerShell)$/;

const MAX_LISTED = 12;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function statePath(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return join(STATE_DIR, `verification-guard-${safe}.json`);
}

function loadState(file) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    /* estado corrompido: recomeça limpo */
  }
  return { edits: [], verified: false, blocked: false };
}

function saveState(file, state) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch {
    /* sem estado gravável, o guard simplesmente não bloqueia */
  }
}

function commandOf(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return '';
  return String(toolInput.command ?? toolInput.cmd ?? '');
}

function filePathOf(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return '';
  return String(toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path ?? '');
}

function relative(p) {
  return p.startsWith(PROJECT_DIR) ? p.slice(PROJECT_DIR.length).replace(/^[\\/]/, '') : p;
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

  const event = payload.hook_event_name;
  const file = statePath(payload.session_id);
  const state = loadState(file);

  if (event === 'PostToolUse') {
    const tool = String(payload.tool_name || '');
    const input = payload.tool_input;

    if (EDIT_TOOL_RE.test(tool)) {
      const path = filePathOf(input);
      if (path && SOURCE_RE.test(path) && !IGNORE_RE.test(path)) {
        const rel = relative(path);
        if (!state.edits.includes(rel)) state.edits.push(rel);
        // Alteração nova re-arma o guard: verificação anterior não cobre código novo.
        state.verified = false;
        state.blocked = false;
        saveState(file, state);
      }
      return;
    }

    if (SHELL_TOOL_RE.test(tool)) {
      if (VERIFY_CMD_RE.test(commandOf(input))) {
        state.verified = true;
        saveState(file, state);
      }
      return;
    }

    if (VERIFY_TOOL_RE.test(tool)) {
      state.verified = true;
      saveState(file, state);
    }
    return;
  }

  if (event === 'TaskCompleted') {
    const pendingTask = state.edits.length > 0 && !state.verified;
    if (!pendingTask) return;

    const subject = String(payload.task_subject || 'subtarefa sem título');
    const description = String(payload.task_description || '').trim();
    const taskLine = description
      ? `\nTarefa: ${subject}\nEscopo: ${description}`
      : `\nTarefa: ${subject}`;
    const listed = state.edits.slice(0, MAX_LISTED);
    const extra = state.edits.length - listed.length;
    const fileList =
      listed.map((f) => `  - ${f}`).join('\n') + (extra > 0 ? `\n  - ...e mais ${extra}` : '');
    const reason = [
      'TASK COMPLETION BLOQUEADA: alteração de código ainda não foi verificada.',
      taskLine,
      '',
      `Foram alterados ${state.edits.length} arquivo(s) de código-fonte nesta sessão e nenhuma`,
      'verificação foi tentada — nem teste, nem typecheck, nem build, nem navegador.',
      '',
      fileList,
      '',
      'Execute a verificação mais barata que prove o comportamento e tente concluir novamente.',
      'Se houver bloqueio externo genuíno, execute a verificação relevante, registre a falha',
      'como evidência e declare BLOQUEADO; não declare DONE.',
      '',
      'Consulte docs/agent-memory/VERIFICATION.md e docs/DEVELOPMENT_ITERATION_PROTOCOL.md.',
    ].join('\n');
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    return;
  }

  if (event !== 'Stop' && event !== 'SubagentStop') return;

  // Proteção contra laço: se esta parada já é consequência de um bloqueio, libera.
  if (payload.stop_hook_active === true) return;

  const pending = state.edits.length > 0 && !state.verified && !state.blocked;
  if (!pending) return;

  state.blocked = true;
  saveState(file, state);

  const listed = state.edits.slice(0, MAX_LISTED);
  const extra = state.edits.length - listed.length;
  const fileList =
    listed.map((f) => `  - ${f}`).join('\n') + (extra > 0 ? `\n  - ...e mais ${extra}` : '');

  const reason = [
    'ALTERAR ARQUIVO NÃO CONCLUI TAREFA (docs/DEVELOPMENT_ITERATION_PROTOCOL.md).',
    '',
    `Foram alterados ${state.edits.length} arquivo(s) de código-fonte nesta sessão e nenhuma`,
    'verificação foi executada — nem teste, nem typecheck, nem build, nem navegador.',
    '',
    fileList,
    '',
    'Antes de parar, faça uma destas coisas:',
    '',
    '1. Rode a verificação mais barata que prove a mudança:',
    '   - teste único do backend: npx ts-node-transpile-only apps/backend/src/<arquivo>.test.ts  (~2,5s)',
    '   - teste único do web:     npx vitest run <arquivo> --root apps/web',
    '   - tipos do web:           npm run typecheck -w apps/web',
    '   - tipos do backend:       npm run build -w apps/backend',
    '2. Se a mudança é visível na tela, abra o app (preview_start) e verifique o',
    '   comportamento real — build passando não prova funcionamento.',
    '3. Se existir bloqueio externo genuíno (credencial ausente, serviço fora,',
    '   decisão da usuária), NÃO diga "concluído": declare BLOQUEADO, com o que',
    '   foi feito, o que não pôde ser verificado e a evidência do bloqueio.',
    '',
    'Consulte docs/agent-memory/VERIFICATION.md para escolher a verificação certa.',
    'Este aviso não se repete nesta pendência.',
  ].join('\n');

  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

try {
  main();
} catch {
  // fail-open: o guard nunca pode travar a sessão
}
process.exit(0);
