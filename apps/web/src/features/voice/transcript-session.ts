export type SpeechResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

export type SpeechResultListLike = {
  length: number;
  [index: number]: SpeechResultLike;
};

export type TranscriptSnapshot = {
  finalText: string;
  interimText: string;
  text: string;
};

export type RecognitionLike = { stop: () => void };
export type MutableRecognitionRef<T> = { current: T | null };

/** Clears before stopping: browser end events cannot leave a stale recognizer active. */
export function stopActiveRecognition<T extends RecognitionLike>(ref: MutableRecognitionRef<T>): T | null {
  const active = ref.current;
  ref.current = null;
  if (!active) return null;
  try {
    active.stop();
  } catch {
    // The browser can already have ended the recognizer; the ref is still clean.
  }
  return active;
}

/** Ignores late end/error events from an older recognizer after a restart. */
export function releaseRecognition<T>(ref: MutableRecognitionRef<T>, recognition: T): boolean {
  if (ref.current !== recognition) return false;
  ref.current = null;
  return true;
}

function transcriptTokens(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function comparisonToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function hasPrefix(values: string[], prefix: string[]): boolean {
  return prefix.length <= values.length && prefix.every((value, index) => values[index] === value);
}

function mergeTranscript(left: string, right: string): string {
  const leftTokens = transcriptTokens(left);
  const rightTokens = transcriptTokens(right);
  if (!leftTokens.length) return rightTokens.join(" ");
  if (!rightTokens.length) return leftTokens.join(" ");

  const comparableLeft = leftTokens.map(comparisonToken);
  const comparableRight = rightTokens.map(comparisonToken);

  if (hasPrefix(comparableRight, comparableLeft)) {
    return [...leftTokens, ...rightTokens.slice(leftTokens.length)].join(" ");
  }
  if (hasPrefix(comparableLeft, comparableRight)) {
    return leftTokens.join(" ");
  }

  const maximumOverlap = Math.min(leftTokens.length, rightTokens.length);
  for (let overlap = maximumOverlap; overlap > 0; overlap -= 1) {
    const leftSuffix = comparableLeft.slice(-overlap);
    const rightPrefix = comparableRight.slice(0, overlap);
    if (leftSuffix.every((value, index) => value === rightPrefix[index])) {
      return [...leftTokens, ...rightTokens.slice(overlap)].join(" ");
    }
  }

  return [...leftTokens, ...rightTokens].join(" ");
}

function mergeTranscripts(parts: string[]): string {
  return parts.reduce(mergeTranscript, "");
}

/**
 * Web Speech returns the complete result list on every event. This stateful
 * accumulator replaces each index with its latest value and also merges textual
 * overlap. Some Android recognizers repeat or grow the same phrase under a new
 * index, so index identity alone cannot prevent duplicated text.
 */
export class TranscriptSession {
  private readonly finalByIndex = new Map<number, string>();
  private readonly interimByIndex = new Map<number, string>();

  update(results: SpeechResultListLike): TranscriptSnapshot {
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (!result) continue;
      const transcript = result[0]?.transcript?.trim() ?? "";

      if (result.isFinal) {
        if (transcript) {
          this.finalByIndex.set(index, transcript);
        }
        this.interimByIndex.delete(index);
      } else if (!this.finalByIndex.has(index)) {
        if (transcript) this.interimByIndex.set(index, transcript);
        else this.interimByIndex.delete(index);
      }
    }

    return this.snapshot();
  }

  snapshot(): TranscriptSnapshot {
    const ordered = (entries: Map<number, string>) => [...entries.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, text]) => text);
    const finalText = mergeTranscripts(ordered(this.finalByIndex));
    const text = mergeTranscripts([finalText, ...ordered(this.interimByIndex)]);
    const interimText = transcriptTokens(text)
      .slice(transcriptTokens(finalText).length)
      .join(" ");

    return {
      finalText,
      interimText,
      text,
    };
  }

  reset(): void {
    this.finalByIndex.clear();
    this.interimByIndex.clear();
  }
}
