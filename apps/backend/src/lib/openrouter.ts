export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_MAX_COMPLETION_TOKENS = 3000;

export function getOpenRouterModel(): string {
  const configuredModel = process.env.OPENAI_MODEL?.trim();
  return configuredModel || DEFAULT_OPENROUTER_MODEL;
}

export function getOpenRouterMaxCompletionTokens(
  preferred = DEFAULT_OPENROUTER_MAX_COMPLETION_TOKENS,
): number {
  const configuredRaw = process.env.OPENAI_MAX_COMPLETION_TOKENS?.trim();
  const configuredLimit = configuredRaw ? Number.parseInt(configuredRaw, 10) : Number.NaN;
  const cap = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_OPENROUTER_MAX_COMPLETION_TOKENS;

  return Math.min(preferred, cap);
}
