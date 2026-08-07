import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nenhuma ponta com modelo fixo no código.
 *
 * Já aconteceu duas vezes. O gerador de micro-passo chamava a API com
 * `model: 'gpt-4o-mini'` cravado, ignorando o `OPENAI_MODEL` — e junto vinha
 * `temperature: 0.7`, que qualquer modelo gpt-5/o-series recusa com 400. Um
 * hardcode assim não aparece em teste de unidade nem em typecheck: aparece em
 * produção, numa superfície só, com a IA calada.
 *
 * A regra: modelo sai de `getOpenAiModel()`, temperatura sai de
 * `openAiTemperature()`, limite sai de `getOpenAiMaxCompletionTokens()`.
 */

const SRC = join(__dirname, '..');

/** Onde citar um modelo é legítimo: documentação, teste e ferramenta de bench. */
const PERMITIDOS = new Set([
  'lib/openai-config.ts',
  'lib/openai-config.test.ts',
  'lib/model-consistency.test.ts',
]);

function arquivosTs(dir: string, base = ''): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    const relativo = base ? `${base}/${nome}` : nome;
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho, relativo);
    return relativo.endsWith('.ts') ? [relativo] : [];
  });
}

function run() {
  const arquivos = arquivosTs(SRC).filter((f) => !PERMITIDOS.has(f));

  const hardcodes: string[] = [];
  const temperaturasCruas: string[] = [];

  for (const relativo of arquivos) {
    const conteudo = readFileSync(join(SRC, relativo), 'utf-8');
    conteudo.split('\n').forEach((linha, index) => {
      const posicao = `${relativo}:${index + 1}`;

      // `model: 'gpt-...'` cravado numa chamada de API.
      if (/\bmodel\s*:\s*['"`](?:gpt|o[134])[\w.\-]*['"`]/i.test(linha)) {
        hardcodes.push(`${posicao} — ${linha.trim()}`);
      }

      // `temperature: 0.7` solto quebra em gpt-5/o-series; tem que passar por
      // openAiTemperature(), que omite o campo quando o modelo não aceita.
      if (/^\s*temperature\s*:\s*[\d.]+/.test(linha)) {
        temperaturasCruas.push(`${posicao} — ${linha.trim()}`);
      }
    });
  }

  assert.deepEqual(
    hardcodes,
    [],
    `modelo fixo no código (use getOpenAiModel()):\n${hardcodes.join('\n')}`,
  );
  assert.deepEqual(
    temperaturasCruas,
    [],
    `temperatura crua (use openAiTemperature(model, valor)):\n${temperaturasCruas.join('\n')}`,
  );

  assert.ok(arquivos.length > 50, 'a varredura precisa enxergar o código de verdade');
}

try {
  run();
  console.log('model-consistency tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
