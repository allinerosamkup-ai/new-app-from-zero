export const DEFAULT_OPENAI_MODEL = 'gpt-5-nano';
export const DEFAULT_OPENAI_MAX_COMPLETION_TOKENS = 6000;

export function getOpenAiModel(): string {
  const configuredModel = process.env.OPENAI_MODEL?.trim();
  return configuredModel || DEFAULT_OPENAI_MODEL;
}

export function getOpenAiMaxCompletionTokens(
  preferred = DEFAULT_OPENAI_MAX_COMPLETION_TOKENS,
): number {
  const configuredRaw = process.env.OPENAI_MAX_COMPLETION_TOKENS?.trim();
  const configuredLimit = configuredRaw ? Number.parseInt(configuredRaw, 10) : Number.NaN;
  const cap = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_OPENAI_MAX_COMPLETION_TOKENS;

  return Math.min(preferred, cap);
}

/**
 * Reasoning models in the gpt-5 / o-series only accept the default
 * `temperature` of 1 and reject any custom value with a 400
 * ("Unsupported value: 'temperature' does not support X with this model").
 * For those models the parameter must be omitted entirely.
 */
export function modelSupportsCustomTemperature(model: string): boolean {
  const m = (model || '').toLowerCase();
  return !(
    m.startsWith('gpt-5') ||
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4')
  );
}

/**
 * Spread into a `chat.completions.create()` payload. Yields `{ temperature }`
 * only when the active model accepts a custom value; otherwise yields `{}` so
 * the request falls back to the model default (1) instead of 400-ing into the
 * canned fallback path.
 */
export function openAiTemperature(
  model: string,
  temperature: number,
): { temperature?: number } {
  return modelSupportsCustomTemperature(model) ? { temperature } : {};
}
