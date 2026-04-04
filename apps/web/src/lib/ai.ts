export function parseAiSuggestion<T>(suggestion: unknown): T {
  if (typeof suggestion === "string") {
    return JSON.parse(suggestion) as T;
  }

  return suggestion as T;
}

export function tryParseAiSuggestion<T>(suggestion: unknown): T | null {
  try {
    return parseAiSuggestion<T>(suggestion);
  } catch {
    return null;
  }
}
