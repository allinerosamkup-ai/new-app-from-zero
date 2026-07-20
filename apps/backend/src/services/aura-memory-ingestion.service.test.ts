import assert from 'node:assert/strict';
import { AuraMemoryIngestionService } from './aura-memory-ingestion.service';

async function run() {
  const writes: any[] = [];
  const stores: any[] = [];
  let graphOptions: any = null;
  const service = new AuraMemoryIngestionService({
    canonical: { write: async (input: any) => { writes.push(input); return { accepted: true, memory: { id: 'canonical-aura-a1' } }; } } as any,
    vector: { store: async (input: any) => { stores.push(input); } } as any,
    extractor: { extract: async () => [{ kind: 'decision', scope: 'aura', canonicalKey: 'decision.advice', content: 'Give advice' }] as any },
    graphExtract: async (_userId, _message, _reply, options) => { graphOptions = options; return null; },
  });
  await service.ingest({ userId: 'u1', messageId: 'a1', message: "I don't want advice, just listen.", assistantReply: 'I hear you.', locale: 'en-US', history: [] });
  assert.equal(writes[0].kind, 'context');
  assert.equal(writes[0].actionAuthority, 'none');
  assert.equal(writes.some((w) => w.kind === 'decision'), false, 'vent must not become decision/task authority');
  assert.equal(stores[0].contentType, 'aura');
  assert.equal(stores[0].memoryId, 'canonical-aura-a1', 'Aura vector and canonical context must share one memory id');
  assert.equal(stores[0].validUntil.toISOString(), writes[0].validUntil.toISOString(), 'vector fallback keeps the same finite retention');
  assert.equal(graphOptions.allowDecisions, false, 'vent guard must cross the knowledge-graph boundary');
  assert.equal(graphOptions.locale, 'en-US');
  assert.ok(writes[0].validUntil instanceof Date);

  const fallbackStores: any[] = [];
  const fallback = new AuraMemoryIngestionService({
    canonical: { write: async () => { throw new Error('canonical temporarily unavailable'); } } as any,
    vector: { store: async (input: any) => { fallbackStores.push(input); } } as any,
    extractor: { extract: async () => [] },
    graphExtract: async () => null,
  });
  await fallback.ingest({ userId: 'u1', messageId: 'a-fallback', message: 'Contexto suficiente para armazenar', locale: 'pt-BR', history: [] });
  assert.ok(fallbackStores[0].validUntil instanceof Date, 'vector auto-canonicalization must never create infinite Aura context');
  assert.ok(fallbackStores[0].validUntil.getTime() > Date.now());

  const resilient = new AuraMemoryIngestionService({
    canonical: { write: async () => { throw new Error('db unavailable'); } } as any,
    vector: { store: async () => { throw new Error('embed unavailable'); } } as any,
    extractor: { extract: async () => { throw new Error('extract unavailable'); } },
    graphExtract: async () => { throw new Error('graph unavailable'); },
  });
  await assert.doesNotReject(() => resilient.ingest({ userId: 'u1', messageId: 'a2', message: 'Oi', locale: 'pt-BR', history: [] }));
}

run().then(() => console.log('aura-memory-ingestion.service tests passed')).catch((error) => { console.error(error); process.exit(1); });
