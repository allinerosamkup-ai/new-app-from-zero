export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-nano';
export const DEFAULT_OPENAI_MAX_COMPLETION_TOKENS = 3000;

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
