import assert from 'node:assert/strict';

import { extractJournalSignals, stripJournalSignals } from './journal-signals.service';

const OK_CHECKIN = '{"journalSignals":{"checkin":{"moodScore":3,"energyScore":7,"emotions":["anxious"],"factors":["slept_little"]}}}';

// ── Check-in ────────────────────────────────────────────────────────────────
{
  const { checkin } = extractJournalSignals(`Você está segurando muita coisa hoje.\n${OK_CHECKIN}`);
  assert.ok(checkin);
  assert.equal(checkin.moodScore, 3);
  assert.equal(checkin.energyScore, 7);
  assert.deepEqual(checkin.emotions, ['anxious']);
  assert.deepEqual(checkin.factors, ['slept_little']);
}

// Metade do par não é check-in: humor sem energia (ou o contrário) entra torto
// no histórico e contamina baseline, tendência e toda leitura de padrão.
{
  assert.equal(extractJournalSignals('{"journalSignals":{"checkin":{"moodScore":4}}}').checkin, null);
  assert.equal(extractJournalSignals('{"journalSignals":{"checkin":{"energyScore":4}}}').checkin, null);
}

// Fora da escala é ruído, não sinal.
{
  assert.equal(extractJournalSignals('{"journalSignals":{"checkin":{"moodScore":42,"energyScore":5}}}').checkin, null);
  assert.equal(extractJournalSignals('{"journalSignals":{"checkin":{"moodScore":-3,"energyScore":5}}}').checkin, null);
}

// ── Meta ────────────────────────────────────────────────────────────────────
{
  const { goal } = extractJournalSignals(
    '{"journalSignals":{"goal":{"title":"Vender as camas","subgoals":["Tirar foto nova","Revisar o preço","Reativar o anúncio"]}}}',
  );
  assert.ok(goal);
  assert.equal(goal.title, 'Vender as camas');
  assert.equal(goal.subgoals.length, 3);
}

// Meta de um passo só é tarefa, não objetivo — e vira ruído na tela.
{
  assert.equal(
    extractJournalSignals('{"journalSignals":{"goal":{"title":"Ligar","subgoals":["Ligar"]}}}').goal,
    null,
  );
  assert.equal(
    extractJournalSignals('{"journalSignals":{"goal":{"title":"","subgoals":["a","b","c"]}}}').goal,
    null,
  );
}

// ── Ausência e lixo ─────────────────────────────────────────────────────────
{
  // Conversa comum não emite nada — o caso mais frequente de todos.
  assert.deepEqual(extractJournalSignals('Hoje foi um dia difícil, mas você deu conta.'), { checkin: null, goal: null });
  // JSON quebrado é ausência de sinal, nunca chute.
  assert.deepEqual(extractJournalSignals('{"journalSignals":{"checkin":{"moodScore":'), { checkin: null, goal: null });
  assert.deepEqual(extractJournalSignals(''), { checkin: null, goal: null });
}

// Texto com chaves antes do bloco não pode confundir o recorte.
{
  const reply = 'Ela disse {isso} e {aquilo}.\n' + OK_CHECKIN;
  assert.equal(extractJournalSignals(reply).checkin?.moodScore, 3);
}

// ── Limpeza do texto visível ────────────────────────────────────────────────
{
  const visible = stripJournalSignals(`Você está segurando muita coisa hoje.\n${OK_CHECKIN}`);
  assert.equal(visible, 'Você está segurando muita coisa hoje.');
  // Mostrar JSON no diário seria vazar mecânica na cara de quem está desabafando.
  assert.doesNotMatch(visible, /journalSignals|moodScore|\{/);
}

{
  // Sem bloco, o texto passa intacto.
  const plain = 'Nada de sinal aqui.';
  assert.equal(stripJournalSignals(plain), plain);
}

console.log('journal-signals.service tests passed');
