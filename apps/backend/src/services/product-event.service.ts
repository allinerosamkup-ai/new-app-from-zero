import type { ProductEventCreateInput } from '../contracts/event-log.contract';

export type ProductEventWriteResult =
  | { status: 'created'; event: unknown }
  | { status: 'duplicate'; event: unknown }
  | { status: 'rate_limited' };

export type ProductEventRepository = {
  findByEventId(userId: string, eventId: string): Promise<unknown | null>;
  countRecent(userId: string, since: Date): Promise<number>;
  create(data: {
    userId: string;
    eventId: string;
    eventName: string;
    eventVersion: number;
    occurredAt: Date;
    surface: string;
    properties: unknown;
    path: string | null;
    expiresAt: Date;
    userAgent: null;
  }): Promise<unknown>;
};

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}

/**
 * Persiste telemetria de produto de modo idempotente por (usuário, eventId).
 * O índice único no banco cobre a corrida entre a leitura e a criação; em caso
 * de colisão, a resposta preserva a semântica de repetição bem-sucedida.
 */
export async function recordProductEvent(
  repository: ProductEventRepository,
  userId: string,
  data: ProductEventCreateInput,
  now = new Date(),
): Promise<ProductEventWriteResult> {
  const existing = await repository.findByEventId(userId, data.eventId);
  if (existing) return { status: 'duplicate', event: existing };

  const recentCount = await repository.countRecent(userId, new Date(now.getTime() - 60_000));
  if (recentCount >= 120) return { status: 'rate_limited' };

  const occurredAt = new Date(data.occurredAt);
  const createData = {
    userId,
    eventId: data.eventId,
    eventName: data.eventName,
    eventVersion: 1,
    occurredAt,
    surface: data.surface,
    properties: data.properties,
    path: data.path ?? null,
    expiresAt: new Date(occurredAt.getTime() + 180 * 24 * 60 * 60_000),
    userAgent: null,
  };

  try {
    return { status: 'created', event: await repository.create(createData) };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrentExisting = await repository.findByEventId(userId, data.eventId);
    if (concurrentExisting) return { status: 'duplicate', event: concurrentExisting };
    throw error;
  }
}
