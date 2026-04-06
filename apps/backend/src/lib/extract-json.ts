function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export function extractJsonValue(raw: string): unknown {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('AI returned an empty response');
  }

  const direct = tryParseJson(trimmed);
  if (direct.ok) {
    return direct.value;
  }

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (withoutFence && withoutFence !== trimmed) {
    const fenced = tryParseJson(withoutFence);
    if (fenced.ok) {
      return fenced.value;
    }
  }

  const source = withoutFence || trimmed;
  const firstBrace = source.search(/[\[{]/);
  if (firstBrace === -1) {
    throw new Error('AI response did not contain JSON');
  }

  const startChar = source[firstBrace];
  const endChar = startChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < source.length; index++) {
    const current = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (current === '\\') {
        escaped = true;
        continue;
      }

      if (current === '"') {
        inString = false;
      }

      continue;
    }

    if (current === '"') {
      inString = true;
      continue;
    }

    if (current === startChar) depth++;
    if (current === endChar) depth--;

    if (depth === 0) {
      return JSON.parse(source.slice(firstBrace, index + 1));
    }
  }

  throw new Error('AI response contained incomplete JSON');
}
