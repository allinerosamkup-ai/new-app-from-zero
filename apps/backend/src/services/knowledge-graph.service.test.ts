import assert from 'node:assert/strict';

import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphExtractionSchema } from '../contracts/knowledge-graph.contract';
import { CanonicalMemoryService } from './canonical-memory.service';

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

  const canonicalRows: any[] = [];
  const evidenceRows: any[] = [];
  const projections: any[] = [];
  const canonicalPrisma = {
    userMemory: {
      findFirst: async ({ where }: any) => canonicalRows.find((row) => row.canonicalKey === where.canonicalKey && row.lifecycle === 'active') ?? null,
      create: async ({ data }: any) => { const row = { id: 'canonical-fact-1', ...data }; canonicalRows.push(row); return row; },
      update: async ({ data }: any) => Object.assign(canonicalRows[0], data),
    },
    userMemoryEvidence: {
      findFirst: async ({ where }: any) => evidenceRows.find((row) => row.memoryId === where.memoryId && row.hash === where.hash) ?? null,
      create: async ({ data }: any) => { evidenceRows.push(data); return data; },
      findMany: async () => evidenceRows,
    },
  };
  const canonical = new CanonicalMemoryService(canonicalPrisma as any, {
    retrieve: async () => [],
    store: async (input: any) => { projections.push(input); },
  });
  let legacyFactCreates = 0;
  const legacyFacts: any[] = [];
  const retryExtraction = KnowledgeGraphExtractionSchema.parse({
    facts: [{ statement: 'Trabalha melhor depois das dez horas', confidence: 0.9 }],
  });
  const retryOptions = {
    source: 'aura', locale: 'pt-BR', allowDecisions: true, canonicalMemoryService: canonical, sourceId: 'aura-message-1', observedAt: new Date('2026-07-14T10:00:00Z'),
    prismaClient: {
      userFact: {
        findFirst: async ({ where }: any) => legacyFacts.find((row) => row.userId === where.userId && row.statement === where.statement && row.source === where.source && row.occurredAt.getTime() === where.occurredAt.getTime()) ?? null,
        create: async ({ data }: any) => { legacyFactCreates += 1; const row = { id: 'legacy-fact-1', ...data }; legacyFacts.push(row); return row; },
      },
      userEntity: { upsert: async () => ({ id: 'entity-1' }) },
      userPattern: { findFirst: async () => null, create: async () => ({}), update: async () => ({}) },
      userOpenDecision: { findFirst: async () => null, create: async () => ({}) },
    },
  };
  await KnowledgeGraphService.persistExtraction('user-1', retryExtraction, retryOptions);
  await KnowledgeGraphService.persistExtraction('user-1', retryExtraction, retryOptions);
  assert.equal(projections[0]?.memoryId, 'canonical-fact-1', 'KG fact must use the injected vector-enabled canonical service');
  assert.equal(legacyFactCreates, 1, 'retry with the same provenance does not duplicate the KG projection');
  assert.equal(projections.length, 1, 'retry reuses the canonical embedding');

  const repaired = { facts: [] as any[], patterns: [] as any[], decisions: [] as any[] };
  const repairExtraction = KnowledgeGraphExtractionSchema.parse({
    facts: [{ statement: 'Mantem reuniao fixa na segunda', confidence: 0.9 }],
    patterns: [{ pattern: 'Energia cai depois de reunioes longas', evidenceFactStatements: ['Cansou depois da reuniao semanal'] }],
    decisions: [{ question: 'Deve mover a reuniao semanal?', context: 'Ela compromete o foco' }],
  });
  const duplicateCanonical = {
    write: async () => ({ accepted: true, evidenceCreated: false, memory: { id: 'canonical-existing', firstSeenAt: new Date('2026-07-14T12:00:00Z') } }),
  } as any;
  const repairDb: any = {
    userEntity: { upsert: async () => ({ id: 'unused' }) },
    userFact: {
      findFirst: async ({ where }: any) => repaired.facts.find((row) => row.statement === where.statement && row.source === where.source && row.occurredAt.getTime() === where.occurredAt.getTime()) ?? null,
      create: async ({ data }: any) => { repaired.facts.push({ id: `fact-${repaired.facts.length + 1}`, ...data }); return repaired.facts.at(-1); },
    },
    userPattern: {
      findFirst: async ({ where }: any) => repaired.patterns.find((row) => row.pattern === where.pattern) ?? null,
      create: async ({ data }: any) => { repaired.patterns.push({ id: `pattern-${repaired.patterns.length + 1}`, ...data }); return repaired.patterns.at(-1); },
      update: async ({ where, data }: any) => Object.assign(repaired.patterns.find((row) => row.id === where.id), data),
    },
    userOpenDecision: {
      findFirst: async ({ where }: any) => repaired.decisions.find((row) => row.question === where.question
        && (!Object.prototype.hasOwnProperty.call(where, 'resolvedAt') || row.resolvedAt === where.resolvedAt)) ?? null,
      create: async ({ data }: any) => { repaired.decisions.push({ id: `decision-${repaired.decisions.length + 1}`, resolvedAt: null, ...data }); return repaired.decisions.at(-1); },
    },
  };
  const repairOptions = {
    source: 'aura', locale: 'pt-BR', allowDecisions: true, canonicalMemoryService: duplicateCanonical,
    sourceId: 'aura-repair-1', observedAt: new Date('2026-07-14T12:00:00Z'), prismaClient: repairDb,
  };
  await KnowledgeGraphService.persistExtraction('user-1', repairExtraction, repairOptions);
  assert.equal(repaired.facts.length, 1, 'duplicate canonical evidence repairs a missing fact projection');
  assert.equal(repaired.patterns.length, 1, 'duplicate canonical evidence repairs a missing pattern projection');
  assert.equal(repaired.decisions.length, 1, 'duplicate canonical evidence repairs a missing decision projection');
  const resolvedAt = new Date('2026-07-15T09:00:00Z');
  repaired.decisions[0].resolvedAt = resolvedAt;
  await KnowledgeGraphService.persistExtraction('user-1', repairExtraction, {
    ...repairOptions,
    observedAt: new Date('2026-07-20T18:00:00Z'),
  });
  assert.deepEqual({ facts: repaired.facts.length, patterns: repaired.patterns.length, decisions: repaired.decisions.length }, { facts: 1, patterns: 1, decisions: 1 }, 'projection repair remains idempotent');
  assert.equal(repaired.decisions[0].resolvedAt, resolvedAt, 'retrying the same extraction never reopens an already resolved decision');

  const resolutionTime = new Date('2026-07-16T09:00:00Z');
  const canonicalDecision = {
    id: 'memory-decision-1',
    userId: 'user-resolution',
    kind: 'decision',
    scope: 'open_decision',
    content: 'Devo aceitar a proposta?',
    structuredValue: { context: 'A proposta vence hoje', open: true } as Record<string, any>,
    lifecycle: 'active',
    negativeState: null,
    actionAuthority: 'none',
    lastSeenAt: new Date('2026-07-15T08:00:00Z'),
  };
  const legacyDecision = {
    id: 'decision-resolution-1',
    userId: 'user-resolution',
    question: 'Devo aceitar a proposta?',
    context: 'A proposta vence hoje',
    resolvedAt: null as Date | null,
    resolution: null as string | null,
  };
  const resolutionDb: any = {
    $transaction: async (operation: (tx: any) => Promise<unknown>) => operation(resolutionDb),
    userOpenDecision: {
      findUnique: async ({ where }: any) => where.id === legacyDecision.id ? { ...legacyDecision } : null,
      update: async ({ data }: any) => { Object.assign(legacyDecision, data); return { ...legacyDecision }; },
    },
    userMemory: {
      findMany: async ({ where }: any) => canonicalDecision.userId === where.userId
        && canonicalDecision.kind === where.kind
        && canonicalDecision.scope === where.scope
        && canonicalDecision.content === where.content
        ? [{ ...canonicalDecision }]
        : [],
      update: async ({ data }: any) => { Object.assign(canonicalDecision, data); return { ...canonicalDecision }; },
    },
  };
  await KnowledgeGraphService.markDecisionResolved(legacyDecision.id, 'Aceitei a proposta', {
    prismaClient: resolutionDb,
    now: resolutionTime,
  });
  assert.equal(legacyDecision.resolvedAt?.toISOString(), resolutionTime.toISOString(), 'legacy decision is resolved');
  assert.equal(legacyDecision.resolution, 'Aceitei a proposta');
  assert.equal(canonicalDecision.structuredValue.open, false, 'canonical open decision is closed');
  assert.equal(canonicalDecision.structuredValue.resolution, 'Aceitei a proposta');
  assert.equal(canonicalDecision.lifecycle, 'retracted', 'resolved canonical decision no longer participates in active retrieval');
  assert.equal(canonicalDecision.negativeState, 'completed', 'resolution is retained as a completed guard');
  assert.equal(canonicalDecision.actionAuthority, 'none', 'canonical memory never gains action authority');

  await KnowledgeGraphService.markDecisionResolved(legacyDecision.id, 'retry should not rewrite history', {
    prismaClient: resolutionDb,
    now: new Date('2026-07-20T18:00:00Z'),
  });
  assert.equal(legacyDecision.resolvedAt?.toISOString(), resolutionTime.toISOString(), 'resolution retry preserves the original resolution timestamp');
  assert.equal(legacyDecision.resolution, 'Aceitei a proposta', 'resolution retry preserves the original resolution text');
  assert.equal(canonicalDecision.structuredValue.resolvedAt, resolutionTime.toISOString(), 'canonical retry does not make an old resolution look recent');

  let canonicalDecisionRetryWrites = 0;
  await KnowledgeGraphService.persistExtraction('user-resolution', KnowledgeGraphExtractionSchema.parse({
    decisions: [{ question: legacyDecision.question, context: legacyDecision.context }],
  }), {
    source: 'aura',
    locale: 'pt-BR',
    allowDecisions: true,
    sourceId: 'original-aura-message',
    observedAt: new Date('2026-07-20T18:00:00Z'),
    canonicalMemoryService: { write: async () => { canonicalDecisionRetryWrites += 1; return { accepted: true, evidenceCreated: true }; } } as any,
    prismaClient: {
      userEntity: { upsert: async () => ({ id: 'unused' }) },
      userFact: { findFirst: async () => null, create: async () => ({}) },
      userPattern: { findFirst: async () => null, create: async () => ({}), update: async () => ({}) },
      userOpenDecision: { findFirst: async () => ({ ...legacyDecision }), create: async () => assert.fail('must not duplicate a resolved decision') },
    },
  });
  assert.equal(canonicalDecisionRetryWrites, 0, 'retrying an extraction after resolution cannot recreate an active canonical decision');

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
