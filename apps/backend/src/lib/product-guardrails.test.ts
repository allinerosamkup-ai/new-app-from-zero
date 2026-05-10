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
  /produto vend[aá]vel/i,
  /pitch comercial/i,
  /poss[ií]vel investidor/i,
  /poss[ií]vel investidora/i,
  /O que a Airia faz/i,
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

  for (const root of scannedRoots) {
    const files = listFiles(path.join(repoRoot, root));
    for (const file of files) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (relative === 'apps/backend/src/lib/product-guardrails.test.ts') continue;
      const content = readFileSync(file, 'utf8');

      for (const pattern of forbiddenConsumerPatterns) {
        if (pattern.test(content)) {
          offendingMatches.push(`${relative} matches ${pattern}`);
        }
      }
    }
  }

  assert.deepEqual(
    offendingMatches,
    [],
    `Consumer app must not contain demo, investor, or pitch surfaces:\n${offendingMatches.join('\n')}`,
  );

  console.log('product-guardrails tests passed');
}

run();
