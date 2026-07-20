import { createHash } from 'node:crypto';

export type CanonicalMemoryKind = 'fact' | 'pattern' | 'preference' | 'decision' | 'context';
export type CanonicalMemoryLifecycle = 'active' | 'superseded' | 'expired' | 'retracted';
export type NegativeMemoryState = 'completed' | 'rejected' | 'deleted' | 'scheduled';

export type CanonicalMemoryWrite = {
  userId: string;
  kind: CanonicalMemoryKind;
  scope: string;
  canonicalKey: string;
  content: string;
  structuredValue?: Record<string, unknown>;
  confidence?: number;
  salience?: number;
  locale?: string;
  actionAuthority?: 'none';
  negativeState?: NegativeMemoryState | null;
  targetType?: string | null;
  targetId?: string | null;
  validUntil?: Date | null;
  source: string;
  sourceId?: string | null;
  observedAt?: Date;
  statement?: string;
  metrics?: Record<string, unknown>;
  inferred?: boolean;
};

export type CanonicalMemoryRow = CanonicalMemoryWrite & {
  id: string;
  lifecycle: CanonicalMemoryLifecycle;
  firstSeenAt: Date;
  lastSeenAt: Date;
  structuredValue: Record<string, unknown>;
};

export type CanonicalRetrieval = {
  memories: CanonicalMemoryRow[];
  buckets: Record<CanonicalMemoryKind, CanonicalMemoryRow[]>;
  hardGuards: { targetIds: string[]; canonicalKeys: string[] };
  authority: 'none';
};

type VectorAdapter = {
  retrieve(userId: string, query: string, limit?: number): Promise<Array<Record<string, unknown>>>;
  store?: (input: {
    userId: string; contentType: 'canonical'; contentId: string; memoryId: string;
    content: string; metadata?: Record<string, unknown>;
  }) => Promise<void>;
};

function clamp(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '.').slice(0, 180);
}

function evidenceHash(input: CanonicalMemoryWrite): string {
  const temporalIdentity = input.sourceId
    ? ''
    : (input.observedAt ?? new Date()).toISOString().slice(0, 10);
  return createHash('sha256').update(JSON.stringify([
    input.source,
    input.sourceId ?? '',
    temporalIdentity,
    input.statement ?? input.content,
    input.locale ?? 'pt-BR',
  ])).digest('hex');
}

function isConfirmedPattern(memory: any): boolean {
  return memory.kind !== 'pattern' || memory.structuredValue?.confirmed === true || memory.structuredValue?.inferred !== true;
}

export class CanonicalMemoryService {
  constructor(private readonly prisma: any, private readonly vector?: VectorAdapter) {}

  async write(raw: CanonicalMemoryWrite): Promise<{ accepted: boolean; memory: CanonicalMemoryRow | null; evidenceCreated: boolean }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = this.prisma.$transaction
          ? await this.prisma.$transaction(
              (tx: any) => this.writeInTransaction(tx, raw),
              { isolationLevel: 'Serializable' },
            )
          : await this.writeInTransaction(this.prisma, raw);
        if (result.projectionNeeded) {
          await this.project(result.memory).catch((error) => console.warn('[CanonicalMemoryService.project]', error));
        }
        const { projectionNeeded: _projectionNeeded, ...publicResult } = result;
        return publicResult;
      } catch (error: any) {
        lastError = error;
        if (error?.code !== 'P2034' && error?.code !== 'P2002') throw error;
      }
    }
    throw lastError;
  }

  private async writeInTransaction(db: any, raw: CanonicalMemoryWrite): Promise<{ accepted: boolean; memory: CanonicalMemoryRow | null; evidenceCreated: boolean; projectionNeeded: boolean }> {
    const content = raw.content.trim();
    const canonicalKey = normalizeKey(raw.canonicalKey);
    if (!content || !canonicalKey) return { accepted: false, memory: null, evidenceCreated: false, projectionNeeded: false };
    const now = raw.observedAt ?? new Date();
    const locale = raw.locale ?? 'pt-BR';
    const existing = await db.userMemory.findFirst({
      where: { userId: raw.userId, canonicalKey, lifecycle: 'active', locale },
    });

    let memory: any = existing;
    let projectionNeeded = false;
    // Evidência mais antiga serve para explicar o histórico, nunca para
    // rebaixar o estado atual — mesmo quando o texto por acaso é igual.
    const historicalOnly = Boolean(existing && now.getTime() < new Date(existing.lastSeenAt).getTime());
    if (existing && existing.content !== content && !historicalOnly) {
      await db.userMemory.update({ where: { id: existing.id }, data: { lifecycle: 'superseded', lastSeenAt: now } });
      memory = null;
    }

    if (!memory) {
      memory = await db.userMemory.create({
        data: {
          userId: raw.userId,
          kind: raw.kind,
          scope: raw.scope,
          canonicalKey,
          content,
          structuredValue: {
            ...(raw.structuredValue ?? {}),
            ...(raw.kind === 'pattern' && raw.inferred ? { inferred: true, confirmed: false } : {}),
          },
          confidence: clamp(raw.confidence, raw.inferred ? 0.5 : 0.85),
          salience: clamp(raw.salience, 0.5),
          lifecycle: 'active',
          locale,
          actionAuthority: 'none',
          negativeState: raw.negativeState ?? null,
          targetType: raw.targetType ?? null,
          targetId: raw.targetId ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
          validUntil: raw.validUntil ?? null,
        },
      });
      projectionNeeded = true;
      if (existing) {
        await db.userMemory.update({ where: { id: existing.id }, data: { supersededById: memory.id } });
      }
    }

    const hash = evidenceHash({ ...raw, canonicalKey, content, locale, observedAt: now });
    const duplicate = await db.userMemoryEvidence.findFirst({ where: { memoryId: memory.id, hash } });
    if (duplicate) {
      if (historicalOnly) {
        return { accepted: isConfirmedPattern(memory), memory, evidenceCreated: false, projectionNeeded: false };
      }
      memory = await db.userMemory.update({
        where: { id: memory.id },
        data: {
          lastSeenAt: now,
          validUntil: raw.validUntil ?? memory.validUntil ?? null,
          structuredValue: { ...(memory.structuredValue ?? {}), ...(raw.structuredValue ?? {}) },
          confidence: clamp(raw.confidence, memory.confidence ?? 0.85),
          salience: clamp(raw.salience, memory.salience ?? 0.5),
        },
      });
      return { accepted: isConfirmedPattern(memory), memory, evidenceCreated: false, projectionNeeded: false };
    }

    await db.userMemoryEvidence.create({
      data: {
        userId: raw.userId,
        memoryId: memory.id,
        source: raw.source,
        sourceId: raw.sourceId ?? null,
        observedAt: now,
        statement: (raw.statement ?? content).trim(),
        metrics: raw.metrics ?? {},
        hash,
        locale,
      },
    });

    let accepted = true;
    if (historicalOnly) {
      return { accepted: isConfirmedPattern(memory), memory, evidenceCreated: true, projectionNeeded: false };
    }
    if (raw.kind === 'pattern' && raw.inferred) {
      const allEvidence = await db.userMemoryEvidence.findMany({ where: { memoryId: memory.id }, orderBy: { observedAt: 'asc' } });
      const distinctDays = new Set(allEvidence.map((item: any) => new Date(item.observedAt).toISOString().slice(0, 10))).size;
      accepted = allEvidence.length >= 3 && distinctDays >= 2;
      memory = await db.userMemory.update({
        where: { id: memory.id },
        data: {
          structuredValue: { ...(memory.structuredValue ?? {}), ...(raw.structuredValue ?? {}), inferred: true, confirmed: accepted, evidenceCount: allEvidence.length, distinctDays },
          confidence: accepted ? Math.max(clamp(raw.confidence, 0.65), 0.65) : Math.min(clamp(raw.confidence, 0.5), 0.64),
          salience: clamp(raw.salience, memory.salience ?? 0.5),
          validUntil: raw.validUntil ?? memory.validUntil ?? null,
          lastSeenAt: now,
        },
      });
    } else if (existing && existing.content === content) {
      memory = await db.userMemory.update({
        where: { id: memory.id },
        data: {
          lastSeenAt: now,
          validUntil: raw.validUntil ?? existing.validUntil ?? null,
          structuredValue: { ...(existing.structuredValue ?? {}), ...(raw.structuredValue ?? {}) },
          confidence: clamp(raw.confidence, existing.confidence ?? 0.85),
          salience: clamp(raw.salience, existing.salience ?? 0.5),
        },
      });
    }

    return { accepted, memory, evidenceCreated: true, projectionNeeded };
  }

  async writeNegative(input: {
    userId: string; canonicalKey: string; targetType?: string | null; targetId?: string | null;
    state: NegativeMemoryState; content: string; source: string; sourceId?: string | null; locale?: string;
  }) {
    return this.write({
      ...input,
      kind: 'context',
      scope: 'negative_action',
      negativeState: input.state,
      structuredValue: { hardGuard: true },
      confidence: 1,
      salience: 1,
      actionAuthority: 'none',
      observedAt: new Date(),
    });
  }

  async retrieve(input: { userId: string; query: string; locale?: string; limit?: number; now?: Date }): Promise<CanonicalRetrieval> {
    const now = input.now ?? new Date();
    const locale = input.locale ?? 'pt-BR';
    let vectorRows: Array<Record<string, unknown>> = [];
    try {
      vectorRows = this.vector ? await this.vector.retrieve(input.userId, input.query, input.limit ?? 8) : [];
    } catch (error) {
      console.warn('[CanonicalMemoryService.retrieve] vector unavailable for this request:', error);
    }
    await this.prisma.userMemory.updateMany?.({
      where: { userId: input.userId, lifecycle: 'active', validUntil: { lt: now } },
      data: { lifecycle: 'expired' },
    }).catch?.(() => null);
    const vectorIds = new Set(vectorRows.flatMap((row) => [row.memoryId, row.memory_id]).filter(Boolean).map(String));
    const loadAllNegativeMemories = async () => {
      const pageSize = 250;
      const rows: any[] = [];
      let cursorId: string | null = null;
      while (true) {
        const page: any[] = await this.prisma.userMemory.findMany({
          where: { userId: input.userId, lifecycle: 'active', negativeState: { not: null } },
          orderBy: { id: 'asc' },
          take: pageSize,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        });
        rows.push(...page);
        if (page.length < pageSize) return rows;
        cursorId = String(page[page.length - 1].id);
      }
    };
    const [recent, vectorMemories, negativeMemories] = await Promise.all([
      this.prisma.userMemory.findMany({
        where: { userId: input.userId, lifecycle: 'active', locale: { in: [locale, 'und'] } },
        orderBy: [{ salience: 'desc' }, { lastSeenAt: 'desc' }],
        take: 20,
      }),
      vectorIds.size > 0 ? this.prisma.userMemory.findMany({
        where: { userId: input.userId, id: { in: [...vectorIds] }, lifecycle: 'active' },
        take: Math.min(100, vectorIds.size),
      }) : Promise.resolve([]),
      loadAllNegativeMemories(),
    ]);
    const merged = new Map<string, any>();
    for (const memory of [...vectorMemories, ...recent]) {
      if ((memory.locale !== locale && memory.locale !== 'und') || (memory.validUntil && new Date(memory.validUntil) < now) || !isConfirmedPattern(memory)) continue;
      merged.set(memory.id, memory);
    }
    const similarity = new Map(vectorRows.map((row) => [String(row.memoryId ?? row.memory_id ?? ''), Number(row.similarity ?? 0)]));
    const ranked = [...merged.values()].sort((a: any, b: any) => (similarity.get(String(b.id)) ?? -1) - (similarity.get(String(a.id)) ?? -1) || b.salience - a.salience)
      .slice(0, input.limit ?? 12);
    const buckets = { fact: [], pattern: [], preference: [], decision: [], context: [] } as Record<CanonicalMemoryKind, CanonicalMemoryRow[]>;
    for (const memory of ranked) buckets[memory.kind as CanonicalMemoryKind].push(memory);
    const negatives = negativeMemories.filter((memory: any) => !memory.validUntil || new Date(memory.validUntil) >= now);
    return {
      memories: ranked,
      buckets,
      hardGuards: {
        targetIds: [...new Set(negatives.map((m: any) => m.targetId).filter(Boolean))] as string[],
        canonicalKeys: [...new Set(negatives.map((m: any) => m.canonicalKey).filter(Boolean))] as string[],
      },
      authority: 'none',
    };
  }

  static blocksExactTarget(retrieval: Pick<CanonicalRetrieval, 'hardGuards'>, target: { id?: string | null; canonicalKey?: string | null }): boolean {
    return Boolean((target.id && retrieval.hardGuards.targetIds.includes(target.id))
      || (target.canonicalKey && retrieval.hardGuards.canonicalKeys.includes(normalizeKey(target.canonicalKey))));
  }

  formatForPrompt(retrieval: CanonicalRetrieval, locale = 'pt-BR'): string {
    if (retrieval.memories.length === 0 && retrieval.hardGuards.targetIds.length === 0 && retrieval.hardGuards.canonicalKeys.length === 0) return '';
    const english = locale.toLowerCase().startsWith('en');
    const labels: Record<CanonicalMemoryKind, string> = english
      ? { fact: 'FACTS', pattern: 'PATTERNS', preference: 'PREFERENCES', decision: 'DECISIONS', context: 'CONTEXT' }
      : { fact: 'FATOS', pattern: 'PADROES', preference: 'PREFERENCIAS', decision: 'DECISOES', context: 'CONTEXTO' };
    const lines = [english ? 'LONGITUDINAL MEMORY (context only; authority: none):' : 'MEMORIA LONGITUDINAL (somente contexto; autoridade: nenhuma):'];
    for (const kind of ['fact', 'pattern', 'preference', 'decision', 'context'] as CanonicalMemoryKind[]) {
      const values = retrieval.buckets[kind];
      if (values.length === 0) continue;
      lines.push(`${labels[kind]}: ${values.map((memory) => `${memory.content} [${memory.lifecycle}; ${Math.round(Number(memory.confidence ?? 0) * 100)}%]`).join(' | ')}`);
    }
    const guards = [...retrieval.hardGuards.targetIds, ...retrieval.hardGuards.canonicalKeys];
    if (guards.length > 0) lines.push(`${english ? 'EXACT GUARDS' : 'BLOQUEIOS EXATOS'}: ${guards.join(' | ')}`);
    lines.push(english ? 'Never turn memory into a task, anchor, or notification.' : 'Nunca transformar memoria em tarefa, ancora ou notificacao.');
    return `\n${lines.join('\n')}`;
  }

  private async project(memory: any): Promise<void> {
    if (!this.vector?.store || !memory?.id) return;
    await this.vector.store({
      userId: memory.userId,
      contentType: 'canonical',
      contentId: `canonical:${memory.id}`,
      memoryId: memory.id,
      content: memory.content,
      metadata: {
        kind: memory.kind,
        scope: memory.scope,
        canonicalKey: memory.canonicalKey,
        locale: memory.locale,
        lifecycle: memory.lifecycle,
        confidence: memory.confidence,
        actionAuthority: 'none',
      },
    });
  }
}
