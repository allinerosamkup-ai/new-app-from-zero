import assert from 'node:assert/strict';
import { MemoryService } from './memory.service';
import { CanonicalMemoryService } from './canonical-memory.service';

async function run() {
  const memories: any[] = [];
  const evidence: any[] = [];
  let storedMemoryId: string | null = null;
  const prisma: any = {
    userMemory: {
      findFirst: async () => null,
      findMany: async ({ where, take }: any) => {
        const rows = memories.filter((item) => item.userId === where.userId
          && (!where.lifecycle || item.lifecycle === where.lifecycle)
          && (!where.id?.in || where.id.in.includes(item.id))
          && (!where.locale?.in || where.locale.in.includes(item.locale))
          && (!where.negativeState?.not || item.negativeState !== null));
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      },
      create: async ({ data }: any) => { const row = { id: '11111111-1111-4111-8111-111111111111', ...data }; memories.push(row); return row; },
      update: async ({ where, data }: any) => Object.assign(memories.find((item) => item.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        const expired = memories.filter((item) => item.userId === where.userId && item.lifecycle === where.lifecycle && item.validUntil && item.validUntil < where.validUntil.lt);
        expired.forEach((item) => Object.assign(item, data));
        return { count: expired.length };
      },
    },
    userMemoryEvidence: {
      findFirst: async () => null,
      create: async ({ data }: any) => { evidence.push(data); return data; },
      findMany: async () => evidence,
    },
    memoryEmbedding: { findFirst: async () => null, deleteMany: async () => ({ count: 0 }) },
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      if (strings.join('').includes('INSERT INTO memory_embeddings')) storedMemoryId = values.find((value) => value === '11111111-1111-4111-8111-111111111111') ?? null;
      return 1;
    },
    $queryRaw: async () => [{ memory_id: storedMemoryId, contentId: 'journal-1', contentType: 'journal', content: 'A sufficiently long journal memory', metadata: {}, similarity: 0.95, createdAt: new Date() }],
  };
  const service = new MemoryService(prisma, { embed: async () => [0.1, 0.2, 0.3] });
  const validUntil = new Date('2026-08-01T00:00:00.000Z');
  await service.store({ userId: 'user-1', contentType: 'journal', contentId: 'journal-1', content: 'A sufficiently long journal memory', metadata: { locale: 'en-US' }, validUntil });
  assert.equal(storedMemoryId, memories[0].id);
  assert.equal(memories[0].actionAuthority, 'none');
  assert.equal(memories[0].scope, 'rag.journal');
  assert.equal(new Date(memories[0].validUntil).toISOString(), validUntil.toISOString());
  const retrieved = await service.retrieve('user-1', 'journal', 4);
  assert.equal(retrieved[0]?.memoryId ?? (retrieved[0] as any)?.memory_id, storedMemoryId);
  const canonical = new CanonicalMemoryService(prisma, {
    retrieve: (userId, query, limit) => service.retrieve(userId, query, limit) as any,
  });
  const afterExpiry = await canonical.retrieve({ userId: 'user-1', query: 'journal', locale: 'en-US', now: new Date('2026-08-02T00:00:00.000Z') });
  assert.equal(afterExpiry.memories.length, 0, 'a vector hit cannot revive canonical context after validUntil');
}

run().then(() => console.log('memory.service tests passed')).catch((error) => { console.error(error); process.exit(1); });
