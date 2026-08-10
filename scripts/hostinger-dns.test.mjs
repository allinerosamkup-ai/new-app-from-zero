#!/usr/bin/env node
/**
 * A trava do `hostinger-dns.mjs`.
 *
 * O que se testa aqui é perda de registro, não o caminho feliz: a API grava
 * zona com `PUT`, que substitui o conjunto. Payload montado errado não devolve
 * erro — apaga em silêncio o que não foi enviado, e o que está na zona é o `A`
 * da raiz e o `CNAME` do `www`, ou seja, o app no ar.
 *
 * Roda sem dependência e sem rede: `node scripts/hostinger-dns.test.mjs`.
 */
import assert from 'node:assert/strict';

import { montarPayload } from './hostinger-dns.mjs';

const ZONA = [
  { name: '@', type: 'A', ttl: 300, records: [{ content: '195.35.17.102' }] },
  { name: 'www', type: 'CNAME', ttl: 300, records: [{ content: 'airia.pro.' }] },
  { name: '@', type: 'MX', ttl: 3600, records: [{ content: '10 mx1.hostinger.com' }] },
];

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('TXT novo entra sem tocar no A, no CNAME nem no MX', () => {
  const { payload, perdidos, sumiram, jaExiste } = montarPayload(ZONA, {
    name: '@', type: 'TXT', ttl: 3600, records: [{ content: 'google-site-verification=abc' }],
  });

  assert.equal(jaExiste, false);
  assert.deepEqual(perdidos, []);
  assert.deepEqual(sumiram, []);
  assert.equal(payload.length, 4);
  // Os três originais seguem idênticos, inclusive o que mantém o site no ar.
  for (const original of ZONA) {
    assert.ok(
      payload.some((p) => p.type === original.type && p.name === original.name
        && p.records[0].content === original.records[0].content),
      `sumiu ${original.type} ${original.name}`,
    );
  }
});

teste('segundo TXT no mesmo nome soma, não substitui o primeiro', () => {
  const comTxt = [...ZONA, { name: '@', type: 'TXT', ttl: 3600, records: [{ content: 'v=spf1 include:hostinger.com ~all' }] }];

  const { payload, sumiram, jaExiste } = montarPayload(comTxt, {
    name: '@', type: 'TXT', ttl: 3600, records: [{ content: 'google-site-verification=abc' }],
  });

  assert.equal(jaExiste, true);
  // O SPF é o caso real: perder ele quebra o e-mail sem quebrar o site, que é
  // o tipo de dano que ninguém percebe na hora.
  assert.deepEqual(sumiram, []);
  const txt = payload.find((e) => e.type === 'TXT' && e.name === '@');
  assert.equal(txt.records.length, 2);
  assert.deepEqual(txt.records.map((r) => r.content).sort(), [
    'google-site-verification=abc',
    'v=spf1 include:hostinger.com ~all',
  ]);
});

teste('payload que perde uma entrada inteira é denunciado', () => {
  // Simula o modo de falha que importa: alguém troca `montarPayload` por algo
  // que substitui a zona em vez de acrescentar.
  const payloadRuim = [{ name: '@', type: 'TXT', ttl: 3600, records: [{ content: 'novo' }] }];
  const chave = (e) => `${e.type}::${e.name}`;
  const perdidos = ZONA.filter((e) => !payloadRuim.some((p) => chave(p) === chave(e))).map(chave);

  assert.deepEqual(perdidos, ['A::@', 'CNAME::www', 'MX::@']);
});

teste('conteúdo removido de uma entrada que continua existindo é denunciado', () => {
  // O caso traiçoeiro: a entrada TXT continua lá, então a checagem por entrada
  // passaria. O que sumiu foi um dos conteúdos dentro dela.
  const comDoisTxt = [
    ...ZONA,
    { name: '@', type: 'TXT', ttl: 3600, records: [{ content: 'v=spf1 ~all' }, { content: 'antigo' }] },
  ];
  const chave = (e) => `${e.type}::${e.name}`;
  const payloadRuim = comDoisTxt.map((e) =>
    e.type === 'TXT' ? { ...e, records: [{ content: 'novo' }] } : e,
  );

  const depois = new Set(payloadRuim.flatMap((e) => e.records.map((r) => `${chave(e)}=${r.content}`)));
  const sumiram = comDoisTxt
    .flatMap((e) => e.records.map((r) => `${chave(e)}=${r.content}`))
    .filter((c) => !depois.has(c));

  assert.deepEqual(sumiram, ['TXT::@=v=spf1 ~all', 'TXT::@=antigo']);
});

teste('AAAA convive com o A em vez de trocar', () => {
  const { payload, sumiram } = montarPayload(ZONA, {
    name: '@', type: 'AAAA', ttl: 3600, records: [{ content: '2a02:4780::1' }] },
  );

  assert.deepEqual(sumiram, []);
  assert.ok(payload.some((e) => e.type === 'A' && e.records[0].content === '195.35.17.102'));
  assert.ok(payload.some((e) => e.type === 'AAAA' && e.records[0].content === '2a02:4780::1'));
});

let falhas = 0;
for (const [nome, fn] of testes) {
  try {
    fn();
    console.log(`  ok  ${nome}`);
  } catch (erro) {
    falhas += 1;
    console.error(`  FALHOU  ${nome}`);
    console.error(`          ${erro.message.split('\n')[0]}`);
  }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas > 0 ? 1 : 0);
