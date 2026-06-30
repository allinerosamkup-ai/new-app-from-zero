import assert from 'node:assert/strict';

import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphExtractionSchema } from '../contracts/knowledge-graph.contract';

async function run() {
  // 1. Schema valida estrutura mínima e aplica defaults
  const validExtraction = KnowledgeGraphExtractionSchema.parse({});
  assert.deepEqual(validExtraction.entities, []);
  assert.deepEqual(validExtraction.facts, []);
  assert.deepEqual(validExtraction.patterns, []);
  assert.deepEqual(validExtraction.decisions, []);

  // 2. Schema valida extração completa
  const fullExtraction = KnowledgeGraphExtractionSchema.parse({
    entities: [
      {
        canonicalName: 'venda das camas',
        aliases: ['camas', 'as camas'],
        type: 'project',
        status: 'active',
      },
    ],
    facts: [
      {
        entityCanonicalName: 'venda das camas',
        statement: 'Anúncio postado em Olx, Facebook e Instagram em 12/05, 0 respostas em 24h',
        occurredAt: '2026-05-12T10:00:00Z',
        confidence: 0.9,
      },
    ],
    patterns: [
      {
        pattern: 'Vende rápido pelo Olx quando preço alinhado',
        evidenceFactStatements: ['Estante vendida em 7 dias 28/04'],
      },
    ],
    decisions: [
      {
        question: 'Qual preço usar nas camas?',
        context: 'Anúncio sem resposta sugere preço fora do mercado',
      },
    ],
  });
  assert.equal(fullExtraction.entities.length, 1);
  assert.equal(fullExtraction.entities[0]?.canonicalName, 'venda das camas');
  assert.equal(fullExtraction.facts[0]?.confidence, 0.9);

  // 3. formatContextForPrompt — contexto vazio devolve string vazia
  const emptyFormatted = KnowledgeGraphService.formatContextForPrompt({
    entitiesActive: [],
    factsRecent: [],
    patternsRelevant: [],
    openDecisions: [],
  });
  assert.equal(emptyFormatted, '');

  // 4. formatContextForPrompt — contexto completo tem todos os blocos
  const now = new Date('2026-05-13T15:00:00Z');
  const formatted = KnowledgeGraphService.formatContextForPrompt({
    entitiesActive: [
      {
        canonicalName: 'venda das camas',
        type: 'project',
        status: 'active',
        lastMentionAt: new Date('2026-05-12T10:00:00Z'),
      },
      {
        canonicalName: 'pintor',
        type: 'person',
        status: 'paused',
        lastMentionAt: new Date('2026-05-13T09:00:00Z'),
      },
    ],
    factsRecent: [
      {
        statement: 'Anúncio das camas postado em 3 canais, 0 respostas em 24h',
        entityName: 'venda das camas',
        occurredAt: new Date('2026-05-12T10:00:00Z'),
      },
      {
        statement: 'Pintor indisponível para a semana',
        entityName: 'pintor',
        occurredAt: new Date('2026-05-13T09:00:00Z'),
      },
    ],
    patternsRelevant: [
      { pattern: 'Vende rápido pelo Olx quando preço alinhado', strength: 0.75 },
      { pattern: 'Trava ao cobrar resposta de cliente', strength: 0.65 },
    ],
    openDecisions: [
      { question: 'Qual preço usar nas camas?', raisedAt: new Date('2026-05-12T10:00:00Z') },
    ],
  });

  assert.match(formatted, /CONTEXTO ESTRUTURADO DA USUÁRIA/);
  assert.match(formatted, /PROJETOS\/EVENTOS\/PESSOAS ATIVOS/);
  assert.match(formatted, /venda das camas \(project, active/);
  assert.match(formatted, /pintor \(person, paused/);
  assert.match(formatted, /FATOS RECENTES/);
  assert.match(formatted, /Anúncio das camas postado em 3 canais/);
  assert.match(formatted, /PADRÕES OBSERVADOS/);
  assert.match(formatted, /Vende rápido pelo Olx/);
  assert.match(formatted, /DECISÕES EM ABERTO/);
  assert.match(formatted, /Qual preço usar nas camas/);
  // garante que o uso é RACIOCÍNIO interno (não citação literal)
  assert.match(formatted, /NÃO cite literalmente/);

  // 5. Schema rejeita type inválido
  try {
    KnowledgeGraphExtractionSchema.parse({
      entities: [{ canonicalName: 'x', aliases: [], type: 'invalid-type' }],
    });
    assert.fail('deveria ter lançado por type inválido');
  } catch (err) {
    // ok — Zod lançou
  }

  // 6. Schema rejeita statement muito curto (< 5 chars)
  try {
    KnowledgeGraphExtractionSchema.parse({
      facts: [{ statement: 'no', confidence: 0.5 }],
    });
    assert.fail('deveria ter lançado por statement curto');
  } catch (err) {
    // ok
  }
}

run()
  .then(() => console.log('knowledge-graph.service tests passed'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
