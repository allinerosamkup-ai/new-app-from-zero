import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

const forbiddenConsumerPatterns = [
  /VITE_AIRIA_DEMO_MODE/i,
  /\/api\/demo/i,
  /demo_mode_loaded/i,
  /Airia demo/i,
  /airia-demo/i,
  /carregar demo/i,
  /carregar demonstra[cç][aã]o/i,
  /modo demo/i,
  /produto vend[aá]vel/i,
  /prova comercial/i,
  /pitch comercial/i,
  /material de venda/i,
  /narrativa de investimento/i,
  /lista de espera/i,
  /poss[ií]vel investidor/i,
  /poss[ií]vel investidora/i,
  /\binvestidor(?:a|es|as)?\b/i,
  /O que a Airia faz/i,
];

const fakeFlowPatterns = [
  /user-temp-id/i,
  /mock user/i,
  /fake success/i,
  /coming soon/i,
  /TODO implementar/i,
  /placeholder de sucesso/i,
  /bot[aã]o morto/i,
  /navega[cç][aã]o simulada/i,
];

const unsafeClinicalClaimPatterns = [
  /\b(?:voc[eê]|voce)\s+tem\s+(?:bipolaridade|depress[aã]o|tdah|transtorno)/i,
  /\b(?:eu|n[oó]s|a\s+Airia)\s+diagnostic(?:o|amos|a)\b/i,
  /\bdiagn[oó]stico\s+da\s+Airia\b/i,
  /\b(?:cura|curar|curamos)\s+(?:sua\s+)?(?:bipolaridade|depress[aã]o|tdah|ansiedade)/i,
  /\btratamento\s+(?:da|pela)\s+Airia\b/i,
  /\b(?:sou|somos|serei|a\s+Airia\s+[eé])\s+(?:sua\s+)?(?:psic[oó]loga|terapeuta|psiquiatra)\b/i,
  /\b(?:substituo|substitu[ií]mos|a\s+Airia\s+substitui)\s+(?:psic[oó]loga|psiquiatra|terapia|emerg[eê]ncia)\b/i,
];

const backendAgendaFilesWithUtcTimePolicy = [
  'apps/backend/src/services/planner.service.ts',
  'apps/backend/src/services/agenda-adaptation.service.ts',
  'apps/backend/src/services/adaptive-agenda-engine.service.ts',
];

const scannedRoots = [
  'apps/web/src',
  'apps/backend/src',
];

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);
const ignoredDirs = new Set(['dist', 'node_modules', '.next', 'coverage']);

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (ignoredDirs.has(entry)) return [];
      return listFiles(fullPath);
    }

    if (!allowedExtensions.has(path.extname(entry))) return [];
    return [fullPath];
  });
}

function run() {
  const offendingMatches: string[] = [];
  const fakeFlowMatches: string[] = [];
  const unsafeClinicalMatches: string[] = [];
  const timezoneMatches: string[] = [];

  for (const root of scannedRoots) {
    const files = listFiles(path.join(repoRoot, root));
    for (const file of files) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (relative === 'apps/backend/src/lib/product-guardrails.test.ts') continue;
      if (relative.endsWith('.test.ts') || relative.endsWith('.test.tsx')) continue;
      const content = readFileSync(file, 'utf8');

      for (const pattern of forbiddenConsumerPatterns) {
        if (pattern.test(content)) {
          offendingMatches.push(`${relative} matches ${pattern}`);
        }
      }

      for (const pattern of fakeFlowPatterns) {
        if (pattern.test(content)) {
          fakeFlowMatches.push(`${relative} matches ${pattern}`);
        }
      }

      for (const pattern of unsafeClinicalClaimPatterns) {
        if (pattern.test(content)) {
          unsafeClinicalMatches.push(`${relative} matches ${pattern}`);
        }
      }

      if (backendAgendaFilesWithUtcTimePolicy.includes(relative) && /\bsetHours\s*\(/.test(content)) {
        timezoneMatches.push(`${relative} uses setHours(); agenda backend code must use UTC-consistent helpers such as setUTCHours()`);
      }
    }
  }

  assert.deepEqual(
    offendingMatches,
    [],
    `Consumer app must not contain demo, investor, or pitch surfaces:\n${offendingMatches.join('\n')}`,
  );

  assert.deepEqual(
    fakeFlowMatches,
    [],
    `Consumer flows must not ship fake users, placeholders, dead buttons, or simulated success:\n${fakeFlowMatches.join('\n')}`,
  );

  assert.deepEqual(
    unsafeClinicalMatches,
    [],
    `Airia must not make diagnostic, cure, treatment, or clinical-substitution claims:\n${unsafeClinicalMatches.join('\n')}`,
  );

  assert.deepEqual(
    timezoneMatches,
    [],
    `Planner and agenda backend services must preserve UTC-consistent time semantics:\n${timezoneMatches.join('\n')}`,
  );

  console.log('product-guardrails tests passed');
}

run();
