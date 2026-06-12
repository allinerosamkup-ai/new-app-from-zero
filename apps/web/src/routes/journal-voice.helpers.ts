// Diário por voz (Onda 4): helpers puros para ditado contínuo.
// Para o público-alvo, digitar em dia ruim é barreira — falar 30s tem que funcionar
// mesmo com pausas. Por isso usamos continuous + interimResults e acumulamos os finais.

export type SpeechResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

export type SpeechResultListLike = {
  length: number;
  [index: number]: SpeechResultLike;
};

export function isSpeechRecognitionSupported(win: unknown = typeof window !== "undefined" ? window : undefined): boolean {
  if (!win || typeof win !== "object") return false;
  const w = win as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Junta um novo trecho ao texto existente sem espaço duplicado nem espaço inicial.
export function mergeTranscript(previous: string, addition: string): string {
  const add = addition.trim();
  if (!add) return previous;
  const base = previous.replace(/\s+$/, "");
  return base ? `${base} ${add}` : add;
}

// Separa os resultados finais (confirmados) do interim (ainda sendo falado),
// a partir do índice de onde a sessão começou a processar.
export function extractTranscript(
  results: SpeechResultListLike,
  resultIndex = 0,
): { finalText: string; interimText: string } {
  let finalText = "";
  let interimText = "";
  for (let i = resultIndex; i < results.length; i++) {
    const result = results[i];
    if (!result || !result[0]) continue;
    const chunk = result[0].transcript ?? "";
    if (result.isFinal) {
      finalText = mergeTranscript(finalText, chunk);
    } else {
      interimText = mergeTranscript(interimText, chunk);
    }
  }
  return { finalText, interimText };
}

// Limite de segurança: ditado para sozinho depois disso para não rodar à toa.
export const VOICE_MAX_DURATION_MS = 60_000;
