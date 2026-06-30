import assert from 'node:assert/strict';

import { validateJournalReply, buildRevisionInstruction } from './journal-reply-validator';

function run() {
  // 1. ok — resposta cita âncora real e não está em loop
  const okResult = validateJournalReply(
    'Você anunciou as camas em três canais e nada moveu. Abre o anúncio do Olx agora e troca a primeira foto.',
    {
      lastAssistantReplies: ['Como você se sentiu hoje?'],
      lastUserMessages: ['Anunciei em Olx, Facebook e Instagram'],
      anchorTitles: ['Vender camas no Olx'],
    },
  );
  assert.equal(okResult.ok, true, 'resposta com âncora deve passar');

  // 2. question_loop — 3 perguntas seguidas é proibido
  const loopResult = validateJournalReply(
    'E os anúncios estão ativos ou parados?',
    {
      lastAssistantReplies: [
        'Como você se sentiu hoje?',
        'O que você está tentando fazer com isso?',
      ],
      lastUserMessages: ['Anunciei tudo já', 'Tô cansada'],
      anchorTitles: [],
    },
  );
  assert.equal(loopResult.ok, false);
  if (!loopResult.ok) {
    assert.equal(loopResult.reason, 'question_loop');
  }

  // 3. no_concrete_anchor — havia âncoras mas resposta não cita nenhuma
  const noAnchorResult = validateJournalReply(
    'Você está em um momento de pausa, talvez seja bom respirar fundo.',
    {
      lastAssistantReplies: [],
      lastUserMessages: ['Tô travada com a venda das camas e o pintor que não veio'],
      anchorTitles: ['Vender camas no Olx', 'Contratar pintor da varanda', 'Pagar conta de luz'],
    },
  );
  assert.equal(noAnchorResult.ok, false);
  if (!noAnchorResult.ok) {
    assert.equal(noAnchorResult.reason, 'no_concrete_anchor');
  }

  // 4. echo_only — resposta é eco da última fala da usuária
  const echoResult = validateJournalReply(
    'Você está cansada do frio e do dinheiro apertado, parada no meio do caminho.',
    {
      lastAssistantReplies: [],
      lastUserMessages: ['Estou cansada do frio, com dinheiro apertado e parada no caminho da pintura'],
      anchorTitles: [],
    },
  );
  assert.equal(echoResult.ok, false);
  if (!echoResult.ok) {
    assert.equal(echoResult.reason, 'echo_only');
  }

  // 5. ok mesmo sem âncoras quando lista vazia
  const okEmptyAnchors = validateJournalReply(
    'O que você está tentando fazer com essa pausa?',
    {
      lastAssistantReplies: ['Como foi sua manhã?'],
      lastUserMessages: ['Travei'],
      anchorTitles: [],
    },
  );
  assert.equal(okEmptyAnchors.ok, true);

  // 6. buildRevisionInstruction tem texto certo pra cada motivo
  assert.match(buildRevisionInstruction('question_loop', 'detalhes'), /loop de perguntas/i);
  assert.match(buildRevisionInstruction('no_concrete_anchor', 'detalhes'), /elemento concreto/i);
  assert.match(buildRevisionInstruction('echo_only', 'detalhes'), /sin[oô]nimos|reformulou/i);
  assert.match(buildRevisionInstruction('analysis_missing', 'detalhes'), /1-3 frases DECLARATIVAS|an[aá]lise pronta/i);

  // 7. analysis_missing — resposta com SÓ perguntas, nenhuma frase declarativa, é reprovada.
  // Inclui "pintura" e "camas" (âncoras) pra não cair em no_concrete_anchor antes.
  const onlyQuestionsResult = validateJournalReply(
    'O que você está tentando fazer com a pintura agora? E sobre as camas, o pintor já respondeu? Qual seria a primeira coisa pra hoje?',
    {
      lastAssistantReplies: [],
      lastUserMessages: ['Tô travada com pintura e camas'],
      anchorTitles: ['pintura', 'camas'],
    },
  );
  assert.equal(onlyQuestionsResult.ok, false);
  if (!onlyQuestionsResult.ok) {
    assert.equal(onlyQuestionsResult.reason, 'analysis_missing');
  }

  // 8. analysis_missing — resposta com 2 frases declarativas + 1 pergunta no fim → ok
  const balancedResult = validateJournalReply(
    'Você anunciou as camas em três canais e ninguém chamou. Isso indica que o gargalo é preço, não divulgação. Qual valor você colocou?',
    {
      lastAssistantReplies: [],
      lastUserMessages: ['Tô travada com a venda das camas'],
      anchorTitles: ['camas'],
    },
  );
  assert.equal(balancedResult.ok, true, 'resposta balanceada (declarativas + 1 pergunta no fim) deve passar');

  // 9. resposta curta sem ponto final mas com pergunta — não é considerada analysis_missing
  //    (heurística só dispara em respostas >= 30 chars com sentenças quebráveis)
  const shortQuestion = validateJournalReply(
    'O que tá pesando agora?',
    {
      lastAssistantReplies: ['Como foi sua manhã?'],
      lastUserMessages: ['Travei'],
      anchorTitles: [],
    },
  );
  assert.equal(shortQuestion.ok, true);
}

run();
console.log('journal-reply-validator tests passed');
