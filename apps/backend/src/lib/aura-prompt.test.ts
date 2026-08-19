import assert from 'node:assert/strict';

import { buildAuraSystemPrompt, resolveBrevityDirective } from './aura-prompt';

async function run() {
  const base = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'checkin',
    profileSummary: 'Prefere passos curtos quando a energia cai.',
    moodCycleContext: 'Humor em queda leve nos últimos três dias.',
    contextualMemory: 'RAG: Ana trava quando precisa enviar proposta.',
    activeGoalsContext: 'Objetivo ativo: enviar a proposta comercial. Próxima ação: abrir a proposta e escrever o primeiro tópico.',
    reasoningTraceContext: 'Decisão: agir na ação concreta do Objetivo.',
    currentHour: 10,
    currentMinute: 20,
  });

  assert.match(base, /Você é Airia/i);
  assert.match(base, /Check-in, Diário, Objetivos e Padrões/i);
  assert.match(base, /LEITURA TOTAL/i);
  assert.match(base, /POLITICA DE SUGESTAO CONCRETA/i);
  assert.match(base, /verbo executável, cite objeto identificável/i);
  assert.match(base, /Pronto quando/i);
  assert.match(base, /10:20 \(manhã\)/);
  assert.match(base, /Humor em queda leve/i);
  assert.match(base, /enviar a proposta comercial/i);
  assert.doesNotMatch(base, /planner|agenda|hábitos/i);

  const journal = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'journal-live',
    currentHour: 21,
    currentMinute: 5,
  });
  assert.match(journal, /DIARIO AO VIVO/i);
  assert.match(journal, /ANALISE PRONTA/i);
  assert.match(journal, /SINAL DE CHECK-IN/i);
  assert.match(journal, /SINAL DE META/i);
  assert.match(journal, /"doneWhen"/i);
  assert.match(journal, /objeto seguro/i);
  assert.doesNotMatch(journal, /planner|agenda|hábitos/i);

  const command = buildAuraSystemPrompt({
    userName: 'Ana',
    domain: 'aura-command',
    currentHour: 9,
    currentMinute: 0,
  });
  assert.match(command, /AIRIA CHAT EXECUTOR/i);
  assert.match(command, /Objetivo/i);
  assert.match(command, /alvo de uma alteração protegida/i);
  assert.doesNotMatch(command, /planner|agenda|hábitos/i);

  const low = buildAuraSystemPrompt({ userName: 'Ana', domain: 'checkin', phase: 'low', currentHour: 16, currentMinute: 0 });
  assert.match(low, /BREVIDADE ADAPTATIVA/i);
  assert.match(low, /no maximo 2 a 3 frases/i);
  assert.ok(resolveBrevityDirective('low'));
  assert.equal(resolveBrevityDirective('stable'), null);
}

run()
  .then(() => console.log('aura-prompt tests passed'))
  .catch((error) => { console.error(error); process.exit(1); });
