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
