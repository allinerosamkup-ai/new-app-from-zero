/**
 * O padrão não é "nano" de propósito.
 *
 * Medido contra a decomposição de objetivo, com 5 rodadas por modelo e gabarito
 * conhecido (uma decomposição correta que precisa ser aprovada e uma cheia de
 * fato inventado que precisa ser reprovada):
 *
 *   modelo                 papel no catálogo ativo
 *   gpt-5-nano             volume alto com tolerância menor de qualidade
 *   gpt-5-mini             raciocínio de trabalho, com latência variável
 *   claude-haiku-4-5       respostas rápidas, porém menos criteriosas
 *   claude-sonnet-4-6      qualidade e latência adequadas ao uso interativo ← em uso
 *
 * O nano gera bem, mas falhou em julgamentos de equivalência e revisão de
 * passos concretos. O modelo padrão precisa sustentar o julgamento e entregar
 * resposta interativa em tempo adequado; por isso não usa um ID histórico que
 * o provedor não aceita nem o modelo de maior latência observado na candidata.
 *
 * Qualquer modelo escolhido aqui precisa julgar, não só escrever. Se for
 * necessário alterar esta escolha, primeiro consulte o catálogo vivo do
 * provedor e depois execute o benchmark de julgamento.
 *
 * Reproduza com `npm run ai:judge-bench` antes de trocar qualquer coisa aqui.
 */
export const DEFAULT_OPENAI_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_OPENAI_MAX_COMPLETION_TOKENS = 6000;

/**
 * Modelos que não sustentam julgamento adversarial.
 *
 * Não bloqueia — a escolha continua sendo de quem opera o `.env` — mas deixa
 * rastro no log em vez de deixar a validação morrer em silêncio.
 */
export function isJudgingCapableModel(model: string): boolean {
  return !/nano/i.test(model || '');
}

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
 * O proxy aceita famílias diferentes de parâmetros para o teto de saída.
 * Claude e Gemini usam `max_tokens`; GPT usa `max_completion_tokens`.
 */
export function getOpenAiOutputLimit(
  model: string,
  preferred = DEFAULT_OPENAI_MAX_COMPLETION_TOKENS,
): { max_tokens: number } | { max_completion_tokens: number } {
  const limit = getOpenAiMaxCompletionTokens(preferred);
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('claude') || normalized.startsWith('gemini')
    ? { max_tokens: limit }
    : { max_completion_tokens: limit };
}

/**
 * Opções para uma resposta JSON que precisa de raciocínio antes da saída.
 * Claude exige um orçamento explícito e um `max_tokens` estritamente maior;
 * o piso preserva espaço para o JSON final, mesmo em chamadas originalmente curtas.
 */
export function getOpenAiStructuredResponseOptions(
  model: string,
  preferred = DEFAULT_OPENAI_MAX_COMPLETION_TOKENS,
): Record<string, unknown> {
  const normalized = model.trim().toLowerCase();
  if (!normalized.startsWith('claude')) return getOpenAiOutputLimit(model, preferred);

  const maxTokens = Math.max(getOpenAiMaxCompletionTokens(preferred), 1536);
  return {
    max_tokens: maxTokens,
    thinking: { type: 'enabled', budget_tokens: 1024 },
  };
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
