import { extractJsonValue } from './extract-json';

const JSON_OBJECT_TYPES = new Set([
  'task-content',
  'task-split',
  'weekly-insight',
  'stability-analysis',
  'home-messages',
  'checkin-response',
  'goal-capture-dialogue',
  'gtd-clarify',
  'goal-route',
  'goal-subtasks',
  'phase-transition',
  'follow-up',
]);

function normalizeStringItems(items: unknown): string[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function usesJsonObjectResponse(type: string): boolean {
  return JSON_OBJECT_TYPES.has(type);
}

export function normalizeAiSuggestion(type: string, rawSuggestion: string): unknown {
  const parsed = extractJsonValue(rawSuggestion);

  if (type === 'goal-subtasks') {
    if (Array.isArray(parsed)) {
      return { items: normalizeStringItems(parsed) };
    }

    if (parsed && typeof parsed === 'object') {
      const payload = parsed as Record<string, unknown>;
      return {
        ...payload,
        items: normalizeStringItems(payload.items),
      };
    }

    throw new Error('AI response for goal-subtasks did not contain items');
  }

  return parsed;
}
