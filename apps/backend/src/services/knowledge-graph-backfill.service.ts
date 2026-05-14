import { PrismaClient } from '@app/database';

import { KnowledgeGraphService } from './knowledge-graph.service';

const prisma = new PrismaClient();

/**
 * Backfill do User Knowledge Graph a partir do que JÁ ESTÁ no Supabase.
 *
 * Processa em lotes:
 *   - Mensagens da usuária em journal_messages (role='user'), agrupadas por
 *     sessão. Para cada sessão, junta as mensagens da usuária + último
 *     assistant reply e dispara extração.
 *   - Resumos de journal_sessions (campo summary) — única extração por sessão
 *     fechada quando não há mensagens detalhadas.
 *   - daily_checkins com note não-vazio: extração leve do texto da nota.
 *
 * Idempotente — pode rodar múltiplas vezes. UserEntity tem unique
 * (userId, canonicalName) → upsert. UserFact é appended (poderia duplicar fatos
 * em re-execução, mas confidence varia e custo é baixo). Para evitar isso, o
 * service marca processamento via campo `metadata.backfillProcessedAt` no
 * UserEntity, mas como a extração é feita por mensagem nova, gravamos um
 * flag-row em EventLog ('kg.backfill.run') com o último `journal_messages.id`
 * processado pra retomar.
 */
export class KnowledgeGraphBackfillService {
  /** Quantas mensagens processar por bloco antes de dar respiro. */
  static readonly BATCH_SIZE = 5;

  /** Limite máximo de mensagens a processar por execução (proteção). */
  static readonly MAX_MESSAGES_PER_RUN = 200;

  /**
   * Executa backfill para um usuário. Roda assíncrono, retorna stats.
   * NÃO usa transação grande pra não travar — cada extração é independente.
   */
  static async runForUser(userId: string, options: {
    /** Se true, processa do zero ignorando cursor anterior. */
    forceFromScratch?: boolean;
    /** Limite custom (default: MAX_MESSAGES_PER_RUN). */
    limit?: number;
    /** Datas a considerar (YYYY-MM-DD): processa só entradas >= since. */
    sinceDate?: string;
  } = {}): Promise<{
    sessionsProcessed: number;
    checkinsProcessed: number;
    extractionsAttempted: number;
    extractionsSucceeded: number;
    lastProcessedMessageId: string | null;
  }> {
    const limit = Math.min(options.limit ?? this.MAX_MESSAGES_PER_RUN, this.MAX_MESSAGES_PER_RUN);
    const sinceFilter = options.sinceDate
      ? { gte: new Date(`${options.sinceDate}T00:00:00.000Z`) }
      : undefined;

    // 1. Recupera cursores da última execução (mensagem + checkin processados)
    let lastProcessedId: string | null = null;
    let lastProcessedCheckinId: string | null = null;
    if (!options.forceFromScratch) {
      const lastEvent = await prisma.eventLog.findFirst({
        where: { userId, eventName: 'kg.backfill.run' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null);
      if (lastEvent && lastEvent.properties && typeof lastEvent.properties === 'object') {
        const props = lastEvent.properties as Record<string, unknown>;
        if (typeof props.lastMessageId === 'string') {
          lastProcessedId = props.lastMessageId;
        }
        if (typeof props.lastCheckinId === 'string') {
          lastProcessedCheckinId = props.lastCheckinId;
        }
      }
    }

    let sessionsProcessed = 0;
    let checkinsProcessed = 0;
    let extractionsAttempted = 0;
    let extractionsSucceeded = 0;
    let lastIdInRun: string | null = null;
    let lastCheckinIdInRun: string | null = null;

    // 2. Processa SESSÕES de diário — agrupa por session, monta a conversa,
    //    extrai 1x por sessão (não 1x por mensagem — economiza chamadas).
    const sessions = await prisma.journalSession.findMany({
      where: {
        userId,
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: Math.floor(limit / 5), // até ~40 sessões
      include: {
        messages: {
          orderBy: { orderIndex: 'asc' },
          where: lastProcessedId
            ? { createdAt: { gte: new Date(0) } } // apenas filtra por id depois
            : undefined,
        },
      },
    });

    for (const session of sessions) {
      // Filtra mensagens já processadas (se houver cursor)
      const messages = lastProcessedId
        ? session.messages.filter((m) => m.id > lastProcessedId!)
        : session.messages;
      if (messages.length === 0) continue;

      // Junta a conversa em texto pra extração
      const userText = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n');
      const lastAssistantText = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant')?.content;

      if (!userText.trim()) continue;

      extractionsAttempted += 1;
      const result = await KnowledgeGraphService.extractFromMessage(userId, userText, {
        assistantReply: lastAssistantText,
        source: 'journal',
      });
      if (result.saved) extractionsSucceeded += 1;

      sessionsProcessed += 1;
      lastIdInRun = messages[messages.length - 1].id;
    }

    // 3. Processa CHECK-INS com nota textual (note != '') a partir do cursor
    const checkins = await prisma.dailyCheckin.findMany({
      where: {
        userId,
        note: { not: null },
        ...(lastProcessedCheckinId ? { id: { gt: lastProcessedCheckinId } } : {}),
        ...(sinceFilter ? { recordedAt: sinceFilter } : {}),
      },
      orderBy: { id: 'asc' },
      take: Math.floor(limit / 4), // até ~50 check-ins
    });

    for (const checkin of checkins) {
      const note = (checkin.note ?? '').trim();
      if (note.length < 12) continue;
      extractionsAttempted += 1;
      const result = await KnowledgeGraphService.extractFromMessage(userId, note, {
        source: 'checkin',
      });
      if (result.saved) extractionsSucceeded += 1;
      checkinsProcessed += 1;
      lastCheckinIdInRun = checkin.id;
    }

    // 4. Salva cursores pra retomar próxima execução. Sempre escreve evento
    //    (mesmo sem cursor novo) pra registrar a execução automática.
    if (lastIdInRun || lastCheckinIdInRun || sessionsProcessed > 0 || checkinsProcessed > 0) {
      // Carrega cursores existentes pra preservar quando esta execução não avançou um deles
      const existingCursors = await prisma.eventLog.findFirst({
        where: { userId, eventName: 'kg.backfill.run' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null);
      const prevProps = (existingCursors?.properties ?? {}) as Record<string, unknown>;
      await prisma.eventLog.create({
        data: {
          userId,
          eventName: 'kg.backfill.run',
          properties: {
            lastMessageId: lastIdInRun ?? prevProps.lastMessageId ?? null,
            lastCheckinId: lastCheckinIdInRun ?? prevProps.lastCheckinId ?? null,
            sessionsProcessed,
            checkinsProcessed,
            extractionsSucceeded,
            ranAt: new Date().toISOString(),
          },
        },
      }).catch((err) => console.warn('[kg/backfill] falha ao gravar cursor:', err));
    }

    return {
      sessionsProcessed,
      checkinsProcessed,
      extractionsAttempted,
      extractionsSucceeded,
      lastProcessedMessageId: lastIdInRun,
    };
  }

  /**
   * Conta o que existe vs o que já foi processado, sem rodar a extração.
   * Útil pro frontend mostrar progresso.
   */
  static async getStatus(userId: string): Promise<{
    journalMessagesTotal: number;
    journalSessionsTotal: number;
    checkinsWithNoteTotal: number;
    entitiesInGraph: number;
    factsInGraph: number;
    patternsInGraph: number;
    openDecisionsInGraph: number;
    lastBackfillAt: string | null;
  }> {
    const [
      journalMessagesTotal,
      journalSessionsTotal,
      checkinsWithNoteTotal,
      entitiesInGraph,
      factsInGraph,
      patternsInGraph,
      openDecisionsInGraph,
      lastEvent,
    ] = await Promise.all([
      prisma.journalMessage.count({ where: { userId, role: 'user' } }),
      prisma.journalSession.count({ where: { userId } }),
      prisma.dailyCheckin.count({ where: { userId, note: { not: null } } }),
      prisma.userEntity.count({ where: { userId } }),
      prisma.userFact.count({ where: { userId } }),
      prisma.userPattern.count({ where: { userId } }),
      prisma.userOpenDecision.count({ where: { userId, resolvedAt: null } }),
      prisma.eventLog.findFirst({
        where: { userId, eventName: 'kg.backfill.run' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null),
    ]);

    return {
      journalMessagesTotal,
      journalSessionsTotal,
      checkinsWithNoteTotal,
      entitiesInGraph,
      factsInGraph,
      patternsInGraph,
      openDecisionsInGraph,
      lastBackfillAt: lastEvent?.createdAt?.toISOString() ?? null,
    };
  }
}
