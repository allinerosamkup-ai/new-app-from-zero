import { PrismaClient } from '@app/database';

import { KnowledgeGraphService } from './knowledge-graph.service';
import { CanonicalMemoryService } from './canonical-memory.service';
import { MemoryService } from './memory.service';
import { prisma } from '../lib/prisma';

type BackfillDependencies = {
  prisma?: any;
  memoryService?: Pick<MemoryService, 'store' | 'retrieve'>;
  canonicalMemoryService?: CanonicalMemoryService;
  extractFromMessage?: typeof KnowledgeGraphService.extractFromMessage;
};

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
  private static dependencyOverrides: BackfillDependencies | null = null;

  static configureForTests(dependencies: BackfillDependencies | null): void {
    this.dependencyOverrides = dependencies;
  }

  private static resolveDependencies() {
    const db = this.dependencyOverrides?.prisma ?? prisma;
    const memory = this.dependencyOverrides?.memoryService ?? new MemoryService(db);
    const canonical = this.dependencyOverrides?.canonicalMemoryService ?? new CanonicalMemoryService(db, {
      retrieve: (userId, query, limit) => memory.retrieve(userId, query, limit) as any,
      store: (input) => memory.store(input),
    });
    return {
      db,
      canonical,
      extractFromMessage: this.dependencyOverrides?.extractFromMessage ?? KnowledgeGraphService.extractFromMessage.bind(KnowledgeGraphService),
    };
  }
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
    const { db, canonical, extractFromMessage } = this.resolveDependencies();
    const limit = Math.min(options.limit ?? this.MAX_MESSAGES_PER_RUN, this.MAX_MESSAGES_PER_RUN);
    const sinceFilter = options.sinceDate
      ? { gte: new Date(`${options.sinceDate}T00:00:00.000Z`) }
      : undefined;

    // 1. Recupera cursores da última execução (mensagem + checkin processados)
    let lastProcessedId: string | null = null;
    let lastProcessedCheckinId: string | null = null;
    let lastProcessedMessageAt: string | null = null;
    let lastProcessedCheckinAt: string | null = null;
    if (!options.forceFromScratch) {
      const lastEvent = await db.eventLog.findFirst({
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
        if (typeof props.lastMessageCreatedAt === 'string') lastProcessedMessageAt = props.lastMessageCreatedAt;
        if (typeof props.lastCheckinRecordedAt === 'string') lastProcessedCheckinAt = props.lastCheckinRecordedAt;
      }
    }

    // Eventos antigos guardavam apenas o UUID. UUID não expressa ordem
    // temporal, então convertemos esse cursor uma vez para o par estável
    // (timestamp,id) antes de consultar o próximo lote.
    if (lastProcessedId && !lastProcessedMessageAt) {
      const cursorMessage = db.journalMessage.findUnique
        ? await db.journalMessage.findUnique({
          where: { id: lastProcessedId },
          select: { createdAt: true },
        }).catch?.(() => null)
        : null;
      lastProcessedMessageAt = cursorMessage?.createdAt?.toISOString?.() ?? null;
      // An orphaned legacy cursor has no trustworthy temporal meaning. Restart
      // safely and rely on provenance idempotency instead of comparing UUIDs.
      if (!lastProcessedMessageAt) lastProcessedId = null;
    }
    if (lastProcessedCheckinId && !lastProcessedCheckinAt) {
      const cursorCheckin = db.dailyCheckin.findUnique
        ? await db.dailyCheckin.findUnique({
          where: { id: lastProcessedCheckinId },
          select: { recordedAt: true },
        }).catch?.(() => null)
        : null;
      lastProcessedCheckinAt = cursorCheckin?.recordedAt?.toISOString?.() ?? null;
      if (!lastProcessedCheckinAt) lastProcessedCheckinId = null;
    }

    let sessionsProcessed = 0;
    let checkinsProcessed = 0;
    let extractionsAttempted = 0;
    let extractionsSucceeded = 0;
    let lastIdInRun: string | null = null;
    let lastCheckinIdInRun: string | null = null;
    let lastMessageAtInRun: string | null = null;
    let lastCheckinAtInRun: string | null = null;

    const afterCursor = (item: { id: string; createdAt?: Date; recordedAt?: Date }, timestamp: string | null, id: string | null, field: 'createdAt' | 'recordedAt') => {
      if (!timestamp) return true;
      const value = item[field]?.toISOString?.() ?? '';
      return value > timestamp || (value === timestamp && (!id || item.id > id));
    };

    // 2. Pagina DIRETAMENTE mensagens por (createdAt,id). Agrupar depois da
    // query evita ficar preso nas primeiras sessões quando há muitas antigas.
    const journalMessages = await db.journalMessage.findMany({
      where: {
        userId,
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
        ...(lastProcessedMessageAt ? { OR: [
          { createdAt: { gt: new Date(lastProcessedMessageAt) } },
          { createdAt: new Date(lastProcessedMessageAt), id: { gt: lastProcessedId ?? '' } },
        ] } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    const messagesBySession = new Map<string, any[]>();
    for (const message of journalMessages) {
      const key = String(message.sessionId);
      messagesBySession.set(key, [...(messagesBySession.get(key) ?? []), message]);
    }

    for (const messages of messagesBySession.values()) {

      // Junta a conversa em texto pra extração
      const userText = messages
        .filter((m: any) => m.role === 'user')
        .map((m: any) => m.content)
        .join('\n');
      const lastAssistantText = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant')?.content;

      if (!userText.trim()) continue;

      extractionsAttempted += 1;
      const result = await extractFromMessage(userId, userText, {
        assistantReply: lastAssistantText,
        source: 'journal',
        canonicalMemoryService: canonical,
        sourceId: messages[messages.length - 1].id,
        observedAt: messages[messages.length - 1].createdAt ?? new Date(),
      });
      if (result.saved) extractionsSucceeded += 1;

      sessionsProcessed += 1;
    }
    const lastJournalMessage = journalMessages.at(-1);
    if (lastJournalMessage) {
      lastIdInRun = lastJournalMessage.id;
      lastMessageAtInRun = lastJournalMessage.createdAt?.toISOString?.() ?? null;
    }

    // 3. Processa CHECK-INS com nota textual (note != '') a partir do cursor
    const checkins = await db.dailyCheckin.findMany({
      where: {
        userId,
        note: { not: null },
        ...(sinceFilter ? { recordedAt: sinceFilter } : {}),
        ...(lastProcessedCheckinAt ? { OR: [
          { recordedAt: { gt: new Date(lastProcessedCheckinAt) } },
          { recordedAt: new Date(lastProcessedCheckinAt), id: { gt: lastProcessedCheckinId ?? '' } },
        ] } : {}),
      },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      take: Math.floor(limit / 4), // até ~50 check-ins
    });

    for (const checkin of checkins
      .filter((item: any) => afterCursor(item, lastProcessedCheckinAt, lastProcessedCheckinId, 'recordedAt'))
      .sort((a: any, b: any) => (a.recordedAt?.getTime?.() ?? 0) - (b.recordedAt?.getTime?.() ?? 0) || String(a.id).localeCompare(String(b.id)))) {
      // O cursor representa leitura, não extração bem-sucedida. Se uma nota
      // curta/ignorada não avançar o cursor, um lote cheio delas bloqueia para
      // sempre os check-ins válidos que vêm depois.
      lastCheckinIdInRun = checkin.id;
      lastCheckinAtInRun = checkin.recordedAt?.toISOString?.() ?? null;
      const note = (checkin.note ?? '').trim();
      if (note.length < 12) continue;
      extractionsAttempted += 1;
      const result = await extractFromMessage(userId, note, {
        source: 'checkin',
        canonicalMemoryService: canonical,
        sourceId: checkin.id,
        observedAt: checkin.recordedAt ?? new Date(),
      });
      if (result.saved) extractionsSucceeded += 1;
      checkinsProcessed += 1;
    }

    // 4. Salva cursores pra retomar próxima execução. Sempre escreve evento
    //    (mesmo sem cursor novo) pra registrar a execução automática.
    if (lastIdInRun || lastCheckinIdInRun || sessionsProcessed > 0 || checkinsProcessed > 0) {
      // Carrega cursores existentes pra preservar quando esta execução não avançou um deles
      const existingCursors = await db.eventLog.findFirst({
        where: { userId, eventName: 'kg.backfill.run' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null);
      const prevProps = (existingCursors?.properties ?? {}) as Record<string, unknown>;
      await db.eventLog.create({
        data: {
          userId,
          eventName: 'kg.backfill.run',
          properties: {
            lastMessageId: lastIdInRun ?? prevProps.lastMessageId ?? null,
            lastMessageCreatedAt: lastMessageAtInRun ?? prevProps.lastMessageCreatedAt ?? null,
            lastCheckinId: lastCheckinIdInRun ?? prevProps.lastCheckinId ?? null,
            lastCheckinRecordedAt: lastCheckinAtInRun ?? prevProps.lastCheckinRecordedAt ?? null,
            sessionsProcessed,
            checkinsProcessed,
            extractionsSucceeded,
            ranAt: new Date().toISOString(),
          },
        },
      }).catch((err: unknown) => console.warn('[kg/backfill] falha ao gravar cursor:', err));
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
    const { db } = this.resolveDependencies();
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
      db.journalMessage.count({ where: { userId, role: 'user' } }),
      db.journalSession.count({ where: { userId } }),
      db.dailyCheckin.count({ where: { userId, note: { not: null } } }),
      db.userEntity.count({ where: { userId } }),
      db.userFact.count({ where: { userId } }),
      db.userPattern.count({ where: { userId } }),
      db.userOpenDecision.count({ where: { userId, resolvedAt: null } }),
      db.eventLog.findFirst({
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
