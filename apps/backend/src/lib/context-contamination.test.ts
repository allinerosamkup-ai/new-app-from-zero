import assert from 'node:assert/strict';

import { assessRelevance, classifyDomain, filterStatementsForGoal } from './context-domain';

/**
 * Teste de contaminação de contexto — regressão permanente.
 *
 * O caso base é real e foi relatado em campo: a pessoa escreveu no diário sobre
 * uma conversa com a tia e depois criou um objetivo de trabalho sobre um
 * aplicativo. A Airia juntou os dois e devolveu o objetivo profissional como se
 * fosse desdobramento do problema familiar.
 *
 * O que este teste protege não é uma string: é a regra de que **cruzar dados
 * não é misturar contextos**. Se ele quebrar, a Airia voltou a inventar relação.
 */

const DIARIO_TIA = 'Conversei com minha tia e fiquei chateada com a forma como ela falou comigo.';
const OBJETIVO_APP = 'Avançar no desenvolvimento do meu aplicativo';

function run() {
  // ── 1. Cada informação é lida no próprio contexto ──────────────────────────
  assert.equal(classifyDomain(DIARIO_TIA), 'family');
  assert.equal(classifyDomain(OBJETIVO_APP), 'work');

  // ── 2. O caso base: os dois permanecem independentes ───────────────────────
  const verdict = assessRelevance(DIARIO_TIA, OBJETIVO_APP);
  assert.equal(verdict.usable, false, 'o relato da tia não pode entrar no objetivo do app');
  assert.equal(verdict.level, 0, 'domínios distintos, sem termo em comum');

  const { relevant, excluded } = filterStatementsForGoal([DIARIO_TIA], OBJETIVO_APP);
  assert.deepEqual(relevant, [], 'nada do assunto familiar chega ao prompt do objetivo');
  assert.equal(excluded.length, 1);
  assert.match(excluded[0].reason, /dom[íi]nios distintos/);

  // ── 3. Proximidade temporal não é relação ──────────────────────────────────
  //
  // Estes três aconteceram no mesmo dia. Nenhum deles pertence ao objetivo.
  const mesmoDia = [
    DIARIO_TIA,
    'Briguei com meu namorado ontem à noite',
    'Fui na consulta com a médica e o exame veio bom',
    'O boleto do cartão venceu e eu esqueci de pagar',
  ];
  const doDia = filterStatementsForGoal(mesmoDia, OBJETIVO_APP);
  assert.deepEqual(doDia.relevant, [], 'nenhum assunto do dia entra só por ser do mesmo dia');

  // ── 4. Cruzamento correto continua acontecendo ─────────────────────────────
  //
  // Este é o outro lado, e é igualmente importante: um filtro que separa tudo
  // não é discernimento, é cegueira. Fala do mesmo assunto TEM que passar.
  const sobreOApp = [
    'Estou evitando mexer no aplicativo faz uns dias',
    'Quando penso no aplicativo eu travo e vou fazer outra coisa',
  ];
  const doApp = filterStatementsForGoal(sobreOApp, OBJETIVO_APP);
  assert.equal(doApp.relevant.length, 2, 'fala sobre o próprio objetivo tem que entrar');
  assert.deepEqual(doApp.excluded, []);

  // Referência explícita ao objetivo é o nível mais alto de relação.
  assert.equal(assessRelevance('Preciso terminar o desenvolvimento do aplicativo', OBJETIVO_APP).level, 4);

  // ── 5. Mistura: só o que pertence passa ────────────────────────────────────
  const misturado = filterStatementsForGoal(
    [DIARIO_TIA, 'Estou travada no aplicativo', 'Minha mãe ligou cobrando visita'],
    OBJETIVO_APP,
  );
  assert.deepEqual(misturado.relevant, ['Estou travada no aplicativo']);
  assert.equal(misturado.excluded.length, 2);

  // ── 6. A direção contrária também é protegida ──────────────────────────────
  //
  // Um objetivo profissional não pode contaminar a leitura de um relato pessoal.
  const objetivoFamiliar = 'Retomar meu acompanhamento com a terapeuta';
  assert.equal(
    assessRelevance('Preciso entregar o projeto do cliente até sexta', objetivoFamiliar).usable,
    false,
    'assunto de trabalho não explica um objetivo de saúde',
  );
  assert.equal(
    assessRelevance('Marquei a consulta com a psicóloga', objetivoFamiliar).usable,
    true,
    'assunto de saúde explica um objetivo de saúde',
  );

  // ── 7. A faixa perigosa: parece relação e não é ────────────────────────────
  //
  // Nível 1 existe de propósito e NÃO é usável. É onde a alucinação mora: um
  // termo em comum entre domínios diferentes parece conexão para um modelo.
  const parecido = assessRelevance('A casa está uma bagunça e isso me trava', 'Organizar a documentação do sistema');
  assert.ok(parecido.level <= 1, `esperava nível baixo, veio ${parecido.level}`);
  assert.equal(parecido.usable, false);

  // ── 8. Ausência de sinal não inventa relação ───────────────────────────────
  assert.equal(assessRelevance('', OBJETIVO_APP).usable, false);
  assert.equal(assessRelevance(DIARIO_TIA, '').usable, false);
  assert.equal(classifyDomain(''), 'other');
  assert.equal(classifyDomain('   '), 'other');

  // Frase que pertence a dois assuntos igualmente não autoriza nenhum dos dois.
  assert.equal(classifyDomain('Minha mãe me ligou no meio da reunião com o cliente'), 'other');

  // ── 9. Sem objetivo, nada é filtrado por engano ────────────────────────────
  const semObjetivo = filterStatementsForGoal([DIARIO_TIA], '');
  assert.deepEqual(semObjetivo.relevant, [], 'sem objetivo não há contexto para comparar');

  console.log('context-contamination.test.ts OK');
}

run();
