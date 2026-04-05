/**
 * MemoryService — RAG (Retrieval Augmented Generation)
 *
 * Vetoriza conteúdo do usuário (journal, check-in notes, metas) e
 * recupera os fragmentos mais relevantes para enriquecer o contexto da Aura.
 *
 * Modelo: text-embedding-3-small (OpenAI) — 1536 dimensões, barato e rápido.
 */

import { PrismaClient } from '@app/database';
import OpenAI from 'openai';

type ContentType = 'journal' | 'checkin_note' | 'goal' | 'insight';

interface MemoryInput {
  userId: string;
  contentType: ContentType;
  contentId?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface RelevantMemory {
  contentType: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

export class MemoryService {
  private openai: OpenAI;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ── Gera embedding via OpenAI ────────────────────────────────
  async embed(text: string): Promise<number[]> {
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
      const embedding = await this.embed(input.content);

      // Upsert por contentId para evitar duplicatas
      if (input.contentId) {
        const existing = await this.prisma.memoryEmbedding.findFirst({
          where: { userId: input.userId, contentId: input.contentId },
        });
        if (existing) {
          // Atualiza embedding se o conteúdo mudou
          await this.prisma.$executeRaw`
            UPDATE memory_embeddings
            SET content = ${input.content},
                metadata = ${JSON.stringify(input.metadata ?? {})}::jsonb,
                embedding = ${`[${embedding.join(',')}]`}::vector
            WHERE id = ${existing.id}::uuid
          `;
          return;
        }
      }

      // Insere novo — usa $executeRaw para passar o tipo vector
      await this.prisma.$executeRaw`
        INSERT INTO memory_embeddings (id, user_id, content_type, content_id, content, metadata, embedding)
        VALUES (
          gen_random_uuid(),
          ${input.userId}::uuid,
          ${input.contentType},
          ${input.contentId ?? null},
          ${input.content},
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
        SELECT * FROM match_memories(
          ${userId}::uuid,
          ${vectorLiteral}::vector,
          ${limit},
          0.68
        )
      `;

      return rows;
    } catch (err) {
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
    await this.prisma.memoryEmbedding.deleteMany({ where: { userId } });
  }
}
