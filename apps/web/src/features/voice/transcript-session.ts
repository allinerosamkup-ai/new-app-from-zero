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

function joinTranscript(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Web Speech returns the complete result list on every event. This stateful
 * accumulator makes each final index immutable and replaces only the current
 * interim text, so an old phrase cannot be appended again on later events.
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
        if (!this.finalByIndex.has(index) && transcript) {
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
    const finalText = joinTranscript(ordered(this.finalByIndex));
    const interimText = joinTranscript(ordered(this.interimByIndex));

    return {
      finalText,
      interimText,
      text: joinTranscript([finalText, interimText]),
    };
  }

  reset(): void {
    this.finalByIndex.clear();
    this.interimByIndex.clear();
  }
}
