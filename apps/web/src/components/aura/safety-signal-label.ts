const SIGNAL_LABELS: Record<string, readonly [string, string]> = {
  "linguagem de crise ou autoagressao": ["linguagem de crise ou autoagressão", "language indicating crisis or self-harm"],
  "sofrimento intenso ou risco contextual": ["sofrimento intenso ou risco contextual", "intense distress or contextual risk"],
  "sinal de desregulacao emocional": ["sinal de desregulação emocional", "sign of emotional dysregulation"],
  "humor e energia muito baixos": ["humor e energia muito baixos", "very low mood and energy"],
  "sono muito baixo": ["sono muito baixo", "very poor sleep"],
  "irritabilidade muito alta": ["irritabilidade muito alta", "very high irritability"],
};

/** Localizes existing safety labels without changing detection or recorded signals. */
export function safetySignalLabel(signal: string, language: string): string {
  const labels = SIGNAL_LABELS[signal];
  return labels ? labels[language.toLowerCase().startsWith("en") ? 1 : 0] : signal;
}
