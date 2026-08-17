import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CHECKIN_FACTORS, factorLabel, isNegativeFactor, splitFactors } from './checkin-factors';

const repoRoot = path.resolve(__dirname, '../../../..');

/** Lê os ids canônicos direto da tela, que é quem define o que existe. */
function canonicalIdsFromWeb(): string[] {
  const source = readFileSync(
    path.join(repoRoot, 'apps/web/src/routes/checkin-form-model.ts'),
    'utf8',
  );
  const block = source.match(/export const CHECKIN_FACTOR_IDS = \[([\s\S]*?)\] as const;/);
  assert.ok(block, 'CHECKIN_FACTOR_IDS não encontrado em checkin-form-model.ts');
  return [...block[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

function run() {
  const canonical = canonicalIdsFromWeb();
  assert.ok(canonical.length >= 30, `esperava a lista completa, li ${canonical.length}`);

  // ── Paridade: nenhuma pergunta da tela pode chegar ao prompt sem rótulo ────
  //
  // Esta é a asserção que impede a volta do defeito. O mapa antigo do backend
  // tinha `good_sleep` e `bad_sleep`, que não existem na tela, e não tinha
  // `slept_well` nem `slept_little`, que existem — então o id cru vazava para
  // dentro do prompt.
  const semRotulo = canonical.filter((id) => !CHECKIN_FACTORS[id]);
  assert.deepEqual(semRotulo, [], `fatores da tela sem rótulo no backend: ${semRotulo.join(', ')}`);

  const inventados = Object.keys(CHECKIN_FACTORS).filter((id) => !canonical.includes(id));
  assert.deepEqual(inventados, [], `rótulos para ids que não existem na tela: ${inventados.join(', ')}`);

  // ── Valência: o que pesou nunca pode chegar como o que ajudou ─────────────
  //
  // Estes treze entravam invertidos. "Esqueci a medicação" era anunciado ao
  // modelo dentro de "Fatores que ajudaram".
  const precisamSerNegativos = [
    'slept_little', 'woke_up_night', 'no_exercise', 'skipped_meals', 'forgot_meds',
    'social_drain', 'loneliness', 'relationship_conflict', 'hyperfocus_stuck',
    'work_pressure', 'plan_changed', 'hard_decision', 'dissociated', 'low_dopamine',
    'stuck', 'overwhelmed', 'financial_stress', 'bad_news', 'pms_symptoms', 'heavy_period',
  ];
  for (const id of precisamSerNegativos) {
    assert.equal(isNegativeFactor(id), true, `${id} tem que contar como fator que pesou`);
  }

  const precisamSerPositivos = [
    'slept_well', 'exercise', 'healthy_meal', 'took_meds', 'fresh_air', 'good_talk',
    'kind_words', 'support', 'focused_session', 'small_win', 'finished_task',
    'feeling_valued', 'self_trust', 'rest', 'fiz_algo_gosto',
  ];
  for (const id of precisamSerPositivos) {
    assert.equal(isNegativeFactor(id), false, `${id} tem que contar como fator que ajudou`);
  }

  // Toda a lista canônica está classificada — nenhum fator fica sem valência.
  assert.equal(precisamSerNegativos.length + precisamSerPositivos.length, canonical.length);

  // ── Rótulo, não id cru ────────────────────────────────────────────────────
  assert.equal(factorLabel('forgot_meds'), 'Esqueci a medicação');
  assert.equal(factorLabel('slept_little'), 'Dormi pouco (<6h)');
  for (const id of canonical) {
    assert.notEqual(factorLabel(id), id, `${id} chegaria ao prompt como id cru`);
  }
  // Id desconhecido devolve ele mesmo em vez de quebrar a leitura do dia.
  assert.equal(factorLabel('id_que_nao_existe'), 'id_que_nao_existe');

  // ── A separação que o prompt consome ──────────────────────────────────────
  const { helped, weighed } = splitFactors(['slept_well', 'forgot_meds', 'small_win', 'overwhelmed']);
  assert.deepEqual(helped, ['Dormi bem (7h+)', 'Pequena vitória']);
  assert.deepEqual(weighed, ['Esqueci a medicação', 'Sobrecarga mental']);

  const vazio = splitFactors([]);
  assert.deepEqual(vazio, { helped: [], weighed: [] });

  console.log('checkin-factors.test.ts OK');
}

run();
