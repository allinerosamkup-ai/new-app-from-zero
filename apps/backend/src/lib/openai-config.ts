/**
 * O padrão não é "nano" de propósito.
 *
 * Medido contra a decomposição de objetivo, com 5 rodadas por modelo e gabarito
 * conhecido (uma decomposição correta que precisa ser aprovada e uma cheia de
 * fato inventado que precisa ser reprovada):
 *
 *   modelo          aprova-a-boa  reprova-a-ruim   US$/1M in-out
 *   gpt-5.4-nano        1/5            5/5           0,20 / 1,25
 *   gpt-4o-mini         0/5            5/5           0,15 / 0,60
 *   gpt-5.4-mini        5/5            5/5           0,75 / 4,50   ← em uso
 *   gpt-4.1-mini        5/5            5/5           0,40 / 1,60
 *   gpt-4.1             5/5            5/5           2,00 / 8,00
 *   gpt-4o              5/5            5/5           2,50 / 10,00
 *   gpt-5.4             5/5            5/5
 *
 * O nano GERA bem e JULGA mal: reprovava "retire da sala o que não deveria
 * estar ali" alegando que o passo inventa a existência de itens. Como toda
 * revisão reprovava, a camada de validação virou enfeite e a Airia caía em
 * "não tenho informação suficiente" com a informação toda na mão.
 *
 * Qualquer modelo escolhido aqui precisa julgar, não só escrever. Os dois mais
 * baratos da tabela — gpt-4o-mini e gpt-5.4-nano — são justamente os que falham,
 * então economizar por aqui reintroduz o bug. Se o custo apertar, gpt-4.1-mini é
 * a troca segura: passa 5/5 e custa metade do atual.
 *
 * Reproduza com `npm run ai:judge-bench` antes de trocar qualquer coisa aqui.
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
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
