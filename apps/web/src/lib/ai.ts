function extractJsonCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.search(/[\[{]/);
  if (firstBrace < 0) return null;

  const candidate = trimmed.slice(firstBrace).trim();
  const first = candidate[0];
  const last = first === "[" ? "]" : "}";
  const end = candidate.lastIndexOf(last);
  if (end < 0) return null;

  return candidate.slice(0, end + 1).trim();
}

export function parseAiSuggestion<T>(suggestion: unknown): T {
  if (typeof suggestion === "string") {
    const candidate = extractJsonCandidate(suggestion);
    if (!candidate) {
      throw new Error("AI suggestion does not contain JSON.");
    }
    return JSON.parse(candidate) as T;
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
