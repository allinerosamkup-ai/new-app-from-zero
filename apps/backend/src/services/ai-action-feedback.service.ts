type AiActionFeedbackStatus = 'shown' | 'accepted' | 'done' | 'dismissed' | 'deleted' | 'scheduled' | 'rejected';

export type AiActionFeedbackItem = {
  key: string;
  title: string;
  status: AiActionFeedbackStatus;
  surface: string;
  sourceType?: string | null;
  localDate?: string | null;
  createdAt: string;
  /**
   * Número de vezes que essa sugestão foi mostrada sem aceite/dismiss explícito.
   * Ao atingir SHOWN_THRESHOLD_TO_BLOCK, o status é auto-promovido para 'dismissed'
   * (com auto=true), bloqueando repetição em futuras gerações.
   */
  shownCount?: number;
  /**
   * True quando o status foi promovido automaticamente (ex.: 3 'shown' sem ação).
   * Diferencia de uma rejeição explícita feita pela usuária.
   */
  auto?: boolean;
};

const PAYLOAD_KEY = 'aiActionFeedback';
const MAX_ITEMS = 80;
const DEFAULT_LIMIT = 40;
const SHOWN_THRESHOLD_TO_BLOCK = 3;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeStatus(value: unknown): AiActionFeedbackStatus {
  const status = cleanText(value).toLowerCase();
  if (
    status === 'shown' ||
    status === 'accepted' ||
    status === 'done' ||
    status === 'dismissed' ||
    status === 'deleted' ||
    status === 'scheduled' ||
    status === 'rejected'
  ) {
    return status;
  }
  return 'shown';
}

function normalizeDate(value: unknown): string | null {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isFeedbackItem(value: unknown): value is AiActionFeedbackItem {
  return !!value &&
    typeof value === 'object' &&
    typeof (value as AiActionFeedbackItem).key === 'string' &&
    typeof (value as AiActionFeedbackItem).title === 'string' &&
    typeof (value as AiActionFeedbackItem).status === 'string' &&
    typeof (value as AiActionFeedbackItem).surface === 'string' &&
    typeof (value as AiActionFeedbackItem).createdAt === 'string';
}

export class AiActionFeedbackService {
  static buildKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static blocksFutureSuggestion(status: string): boolean {
    return status === 'done' || status === 'dismissed' || status === 'deleted' || status === 'scheduled' || status === 'rejected';
  }

  static async getRecent(prisma: any, userId: string, limit = DEFAULT_LIMIT): Promise<AiActionFeedbackItem[]> {
    const row = await prisma.onboardingResponse?.findUnique?.({
      where: { userId },
      select: { aiProfilePayload: true },
    }).catch(() => null);

    const payload = (row?.aiProfilePayload ?? {}) as Record<string, unknown>;
    const raw = Array.isArray(payload[PAYLOAD_KEY]) ? payload[PAYLOAD_KEY] : [];

    return raw
      .filter(isFeedbackItem)
      .slice(0, limit);
  }

  static async append(prisma: any, userId: string, input: {
    title: unknown;
    status: unknown;
    surface?: unknown;
    sourceType?: unknown;
    localDate?: unknown;
  }): Promise<AiActionFeedbackItem | null> {
    const title = cleanText(input.title);
    const key = this.buildKey(title);
    if (!title || !key) return null;

    const existing = await prisma.onboardingResponse?.findUnique?.({
      where: { userId },
      select: { aiProfilePayload: true },
    }).catch(() => null);

    const existingPayload = ((existing?.aiProfilePayload ?? {}) as Record<string, unknown>);
    const existingItems = await this.getRecent(prisma, userId, MAX_ITEMS);
    const surface = cleanText(input.surface) || 'unknown';
    const incomingStatus = normalizeStatus(input.status);
    const matchKey = `${surface}:${key}`;
    const previousEntry = existingItems.find((entry) => `${entry.surface}:${entry.key}` === matchKey) ?? null;

    // Auto-bloqueio: se a sugestão foi exibida (shown) >= SHOWN_THRESHOLD_TO_BLOCK
    // vezes consecutivas SEM ação explícita da usuária, promove para 'dismissed'.
    // Status explícito (done/dismissed/deleted/scheduled/rejected/accepted) sempre
    // sobrescreve a contagem.
    let resolvedStatus: AiActionFeedbackStatus = incomingStatus;
    let shownCount: number | undefined;
    let auto: boolean | undefined;

    if (incomingStatus === 'shown') {
      const previousShown = previousEntry?.status === 'shown'
        ? Math.max(1, Number(previousEntry.shownCount ?? 1))
        : 0;
      shownCount = previousShown + 1;
      if (shownCount >= SHOWN_THRESHOLD_TO_BLOCK) {
        resolvedStatus = 'dismissed';
        auto = true;
      }
    }

    const item: AiActionFeedbackItem = {
      key,
      title,
      status: resolvedStatus,
      surface,
      sourceType: cleanText(input.sourceType) || null,
      localDate: normalizeDate(input.localDate),
      createdAt: new Date().toISOString(),
      ...(shownCount !== undefined ? { shownCount } : {}),
      ...(auto ? { auto: true } : {}),
    };

    const nextItems = [
      item,
      ...existingItems.filter((entry) => `${entry.surface}:${entry.key}` !== matchKey),
    ].slice(0, MAX_ITEMS);

    await prisma.onboardingResponse?.upsert?.({
      where: { userId },
      update: {
        aiProfilePayload: {
          ...existingPayload,
          [PAYLOAD_KEY]: nextItems,
        },
      },
      create: {
        userId,
        aiProfilePayload: {
          [PAYLOAD_KEY]: nextItems,
        },
      },
    }).catch((error: unknown) => {
      console.warn('[AiActionFeedbackService.append] failed:', error);
    });

    return item;
  }
}
