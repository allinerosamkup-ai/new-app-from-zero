type AiActionFeedbackStatus = 'shown' | 'accepted' | 'done' | 'dismissed' | 'deleted' | 'scheduled' | 'rejected';

export type AiActionFeedbackItem = {
  key: string;
  title: string;
  status: AiActionFeedbackStatus;
  surface: string;
  sourceType?: string | null;
  localDate?: string | null;
  createdAt: string;
};

const PAYLOAD_KEY = 'aiActionFeedback';
const MAX_ITEMS = 80;
const DEFAULT_LIMIT = 40;

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
    const item: AiActionFeedbackItem = {
      key,
      title,
      status: normalizeStatus(input.status),
      surface: cleanText(input.surface) || 'unknown',
      sourceType: cleanText(input.sourceType) || null,
      localDate: normalizeDate(input.localDate),
      createdAt: new Date().toISOString(),
    };

    const nextItems = [
      item,
      ...existingItems.filter((entry) => `${entry.surface}:${entry.key}` !== `${item.surface}:${item.key}`),
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
