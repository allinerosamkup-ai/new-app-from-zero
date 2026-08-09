#!/usr/bin/env node
/**
 * Roda todo `src/**\/*.test.ts`, descobrindo os arquivos em vez de listá-los.
 *
 * O `npm test` era uma corrente de 76 comandos escritos à mão. Arquivo de teste
 * novo não entrava sozinho, e ninguém percebia: 17 suítes existiam no
 * repositório e nunca rodaram uma vez na CI — entre elas as três do check-in
 * (`checkin-application`, `checkin-understanding`, `checkin-draft.contract`),
 * justamente a área onde um campo silenciosamente parou de ser gravado.
 *
 * Cada suíte roda em processo próprio, como antes, porque várias mexem em
 * estado global de módulo e passar a compartilhar processo mudaria o que elas
 * testam. A diferença é que a lista agora vem do disco.
 *
 * O `&&` da versão anterior parava na primeira falha. Aqui tudo roda e o
 * relatório vem junto no fim: com muitas suítes, descobrir uma quebra por
 * execução transforma conserto de meia hora em tarde inteira.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collect(full));
    else if (entry.name.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

const only = process.argv.slice(2);
const files = collect(srcDir)
  .map((file) => path.relative(root, file).split(path.sep).join('/'))
  .filter((file) => only.length === 0 || only.some((needle) => file.includes(needle)))
  .sort();

if (files.length === 0) {
  console.error(only.length > 0 ? `Nenhum teste bate com: ${only.join(', ')}` : 'Nenhum teste encontrado.');
  process.exit(1);
}

console.log(`Rodando ${files.length} suíte(s).\n`);

const failed = [];
for (const file of files) {
  const result = spawnSync('npx', ['ts-node-transpile-only', file], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) failed.push(file);
}

console.log('');
if (failed.length === 0) {
  console.log(`✓ ${files.length} suíte(s) passaram.`);
  process.exit(0);
}

console.log(`✗ ${failed.length} de ${files.length} suíte(s) falharam:`);
for (const file of failed) console.log(`  ${file}`);
process.exit(1);
