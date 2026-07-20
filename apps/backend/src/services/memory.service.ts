/**
 * MemoryService — RAG (Retrieval Augmented Generation)
 *
 * Vetoriza conteúdo do usuário (journal, check-in notes, metas) e
 * recupera os fragmentos mais relevantes para enriquecer o contexto da Airia.
 *
 * Modelo: text-embedding-3-small (OpenAI) — 1536 dimensões, barato e rápido.
 */

import { PrismaClient } from '@app/database';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { CanonicalMemoryService } from './canonical-memory.service';

export type ContentType = 'journal' | 'checkin_note' | 'goal' | 'insight' | 'aura' | 'canonical';

export interface MemoryInput {
  userId: string;
  contentType: ContentType;
  contentId?: string;
  memoryId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  validUntil?: Date | null;
}

interface RelevantMemory {
  memoryId?: string | null;
  contentId?: string | null;
  contentType: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

export class MemoryService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private vectorSearchWarningShown = false;
  private readonly embedOverride?: (text: string) => Promise<number[]>;

  constructor(prisma: PrismaClient, options: { embed?: (text: string) => Promise<number[]> } = {}) {
    this.prisma = prisma;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
    this.embedOverride = options.embed;
  }

  // ── Gera embedding via OpenAI ────────────────────────────────
  async embed(text: string): Promise<number[]> {
    if (this.embedOverride) return this.embedOverride(text);
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // limite seguro
    });
    return response.data[0].embedding;
  }

  // ── Salva uma memória com embedding ─────────────────────────
  async store(input: MemoryInput): Promise<void> {
    if (!input.content.trim() || input.content.trim().length < 10) return;

    try {
      let memoryId = input.memoryId ?? null;
      let contentForEmbedding = input.content;
      if (!memoryId) {
        const contentHash = createHash('sha256').update(input.content.trim()).digest('hex');
        const observedCandidate = input.metadata?.observedAt ? new Date(String(input.metadata.observedAt)) : new Date();
        const observedAt = Number.isNaN(observedCandidate.getTime()) ? new Date() : observedCandidate;
        const canonical = await new CanonicalMemoryService(this.prisma).write({
          userId: input.userId,
          kind: 'context',
          scope: `rag.${input.contentType}`,
          canonicalKey: `rag.${input.contentType}.${input.contentId?.trim() || contentHash}`,
          content: input.content,
          structuredValue: { contentType: input.contentType, metadata: input.metadata ?? {} },
          confidence: 0.65,
          salience: 0.45,
          locale: typeof input.metadata?.locale === 'string' ? input.metadata.locale : 'und',
          actionAuthority: 'none',
          source: `rag.${input.contentType}`,
          sourceId: input.contentId?.trim() || contentHash,
          observedAt,
          validUntil: input.validUntil ?? null,
        });
        memoryId = canonical.memory?.id ?? null;
        contentForEmbedding = canonical.memory?.content ?? input.content;
      }
      const embedding = await this.embed(contentForEmbedding);

      // Upsert por contentId para evitar duplicatas
      if (input.contentId) {
        const existing = await this.prisma.memoryEmbedding.findFirst({
          where: { userId: input.userId, contentId: input.contentId, contentType: input.contentType },
        });
        if (existing) {
          // Atualiza embedding se o conteúdo mudou
          await this.prisma.$executeRaw`
            UPDATE memory_embeddings
            SET content = ${contentForEmbedding},
                memory_id = ${memoryId}::uuid,
                metadata = ${JSON.stringify(input.metadata ?? {})}::jsonb,
                embedding = ${`[${embedding.join(',')}]`}::vector
            WHERE id = ${existing.id}::uuid
          `;
          return;
        }
      }

      // Insere novo — usa $executeRaw para passar o tipo vector
      await this.prisma.$executeRaw`
        INSERT INTO memory_embeddings (id, user_id, content_type, content_id, memory_id, content, metadata, embedding)
        VALUES (
          gen_random_uuid(),
          ${input.userId}::uuid,
          ${input.contentType},
          ${input.contentId ?? null},
          ${memoryId}::uuid,
          ${contentForEmbedding},
          ${JSON.stringify(input.metadata ?? {})}::jsonb,
          ${`[${embedding.join(',')}]`}::vector
        )
      `;
    } catch (err) {
      console.error('[MemoryService.store] Error:', err);
      // Não propaga erro — memória é feature adicional, não bloqueia fluxo principal
    }
  }

  // ── Busca memórias relevantes por similaridade ───────────────
  async retrieve(userId: string, query: string, limit = 4): Promise<RelevantMemory[]> {
    try {
      const queryEmbedding = await this.embed(query);
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;

      const rows = await this.prisma.$queryRaw<RelevantMemory[]>`
        SELECT * FROM match_user_memories(
          ${userId}::uuid,
          ${vectorLiteral}::vector,
          ${limit},
          0.68
        )
      `;

      return rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('match_user_memories')) {
        try {
          const queryEmbedding = await this.embed(query);
          const vectorLiteral = `[${queryEmbedding.join(',')}]`;
          return await this.prisma.$queryRaw<RelevantMemory[]>`
            SELECT * FROM match_memories(
              ${userId}::uuid,
              ${vectorLiteral}::vector,
              ${limit},
              0.68
            )
          `;
        } catch {
          // Both projections unavailable in this environment; retry next request.
        }
        if (!this.vectorSearchWarningShown) {
          this.vectorSearchWarningShown = true;
          console.warn('[MemoryService.retrieve] busca vetorial indisponível nesta tentativa; uma próxima requisição tentará novamente.');
        }
        return [];
      }

      console.error('[MemoryService.retrieve] Error:', err);
      return [];
    }
  }

  // ── Formata memórias para injetar no prompt ──────────────────
  formatForPrompt(memories: RelevantMemory[]): string {
    if (memories.length === 0) return '';

    const formatted = memories.map(m => {
      const date = m.createdAt
        ? new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : '';
      const typeLabel: Record<string, string> = {
        journal: '💬 Diário',
        checkin_note: '📝 Nota do check-in',
        goal: '🎯 Meta',
        insight: '💡 Insight',
      };
      return `[${typeLabel[m.contentType] ?? m.contentType}${date ? ` · ${date}` : ''}]\n${m.content}`;
    });

    return `\nMEMÓRIAS RELEVANTES DE ${formatted.length > 1 ? 'MOMENTOS PASSADOS' : 'UM MOMENTO PASSADO'}:\n${formatted.join('\n\n')}`;
  }

  // ── Deleta todas as memórias de um usuário ───────────────────
  async deleteAll(userId: string): Promise<void> {
    await deleteAllMemoryData(this.prisma as any, userId);
  }
}

/** Memory-only privacy erasure. This intentionally does not purge the account. */
export async function deleteAllMemoryData(prisma: any, userId: string): Promise<void> {
  const erase = async (db: any) => {
  await db.memoryEmbedding?.deleteMany?.({ where: { userId } });
  // Canonical evidence is cascaded, but explicit deletion also works in test/local schemas.
  await db.userMemoryEvidence?.deleteMany?.({ where: { userId } });
  await db.userMemory?.deleteMany?.({ where: { userId } });
  await db.userFact?.deleteMany?.({ where: { userId } });
  await db.userPattern?.deleteMany?.({ where: { userId } });
  await db.userOpenDecision?.deleteMany?.({ where: { userId } });
  await db.userEntity?.deleteMany?.({ where: { userId } });
  const onboarding = await db.onboardingResponse?.findUnique?.({
    where: { userId },
    select: { aiProfilePayload: true },
  });
  if (onboarding?.aiProfilePayload && typeof onboarding.aiProfilePayload === 'object' && !Array.isArray(onboarding.aiProfilePayload)) {
    const {
      aiActionFeedback: _removedFeedback,
      longTermMemory: _removedLongTermMemory,
      longTermMemoryRaw: _removedLongTermMemoryRaw,
      ...preservedPayload
    } = onboarding.aiProfilePayload as Record<string, unknown>;
    if (db.onboardingResponse?.update) {
      await db.onboardingResponse.update({ where: { userId }, data: { aiProfilePayload: preservedPayload } });
    } else {
      await db.onboardingResponse?.upsert?.({
        where: { userId },
        update: { aiProfilePayload: preservedPayload },
        create: { userId, aiProfilePayload: preservedPayload },
      });
    }
  }
  };
  if (!prisma.$transaction) {
    await erase(prisma);
    return;
  }
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$transaction((tx: any) => erase(tx), { isolationLevel: 'Serializable' });
      return;
    } catch (error) {
      const isSerializationConflict = Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034');
      if (!isSerializationConflict || attempt === maxAttempts) throw error;
    }
  }
}
