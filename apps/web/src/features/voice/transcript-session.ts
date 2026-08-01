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

export type SpeechResultEventLike = {
  results: SpeechResultListLike;
  resultIndex: number;
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

/** Requests a normal stop while preserving the ref so the current onend can commit the transcript. */
export function requestRecognitionStop<T extends RecognitionLike>(ref: MutableRecognitionRef<T>): T | null {
  const active = ref.current;
  if (!active) return null;
  try {
    active.stop();
  } catch {
    // The browser may already be ending; onend still owns releasing this ref.
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
    .replace(/^\p{P}+|\p{P}+$/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const TERMINAL_PUNCTUATION = /([.!?]+)$/u;

function comparableTokens(tokens: string[]): string[] {
  return tokens.map(comparisonToken);
}

function hasPrefix(values: string[], prefix: string[]): boolean {
  return prefix.length <= values.length && prefix.every((value, index) => values[index] === value);
}

type TranscriptMerge = { text: string; absorbed: boolean };

/**
 * One or two repeated words can be intentional emphasis ("eu não, eu não consigo").
 * Treat them as cumulative only when the recognizer adds at least two new words;
 * overlaps of three or more words are strong enough evidence by themselves.
 */
function hasCumulativeEvidence(overlap: number, addedTokens: number): boolean {
  return overlap > 2 || addedTokens > 1;
}

function mergeWithOverlap(leftTokens: string[], rightTokens: string[], overlap: number): string {
  const preservedLeft = [...leftTokens];
  const rightRemainder = rightTokens.slice(overlap);
  const lastLeftIndex = preservedLeft.length - 1;
  const inheritedPunctuation = preservedLeft[lastLeftIndex]?.match(TERMINAL_PUNCTUATION)?.[1] ?? "";

  if (rightRemainder.length && inheritedPunctuation) {
    preservedLeft[lastLeftIndex] = preservedLeft[lastLeftIndex]?.replace(TERMINAL_PUNCTUATION, "") ?? "";
  }

  const merged = [...preservedLeft, ...rightRemainder];
  const lastMergedIndex = merged.length - 1;
  if (rightRemainder.length && inheritedPunctuation && !TERMINAL_PUNCTUATION.test(merged[lastMergedIndex] ?? "")) {
    merged[lastMergedIndex] = `${merged[lastMergedIndex]}${inheritedPunctuation}`;
  }
  return merged.join(" ");
}

function mergeTranscript(left: string, right: string): TranscriptMerge {
  const leftTokens = transcriptTokens(left);
  const rightTokens = transcriptTokens(right);
  if (!leftTokens.length) return { text: rightTokens.join(" "), absorbed: false };
  if (!rightTokens.length) return { text: leftTokens.join(" "), absorbed: true };

  const comparableLeft = comparableTokens(leftTokens);
  const comparableRight = comparableTokens(rightTokens);

  const rightGrowth = rightTokens.length - leftTokens.length;
  if (hasCumulativeEvidence(leftTokens.length, rightGrowth) && hasPrefix(comparableRight, comparableLeft)) {
    return { text: mergeWithOverlap(leftTokens, rightTokens, leftTokens.length), absorbed: true };
  }
  if (hasCumulativeEvidence(rightTokens.length, 0) && hasPrefix(comparableLeft, comparableRight)) {
    return { text: leftTokens.join(" "), absorbed: true };
  }

  const maximumOverlap = Math.min(leftTokens.length, rightTokens.length);
  for (let overlap = maximumOverlap; overlap > 0; overlap -= 1) {
    const leftSuffix = comparableLeft.slice(-overlap);
    const rightPrefix = comparableRight.slice(0, overlap);
    const addedTokens = rightTokens.length - overlap;
    if (hasCumulativeEvidence(overlap, addedTokens)
      && leftSuffix.every((value, index) => value === rightPrefix[index])) {
      return { text: mergeWithOverlap(leftTokens, rightTokens, overlap), absorbed: true };
    }
  }

  return { text: [...leftTokens, ...rightTokens].join(" "), absorbed: false };
}

function mergeTranscripts(parts: string[]): string {
  return parts.reduce((merged, part) => mergeTranscript(merged, part).text, "");
}

function compactTranscriptEntries(entries: Map<number, string>): void {
  const compacted: Array<[number, string]> = [];
  const ordered = [...entries.entries()].sort(([left], [right]) => left - right);

  for (const [index, transcript] of ordered) {
    const previous = compacted[compacted.length - 1];
    if (!previous) {
      compacted.push([index, transcript]);
      continue;
    }

    const merged = mergeTranscript(previous[1], transcript);
    if (merged.absorbed) compacted[compacted.length - 1] = [index, merged.text];
    else compacted.push([index, transcript]);
  }

  entries.clear();
  compacted.forEach(([index, transcript]) => entries.set(index, transcript));
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

  update(results: SpeechResultListLike, resultIndex = 0): TranscriptSnapshot {
    for (const index of this.interimByIndex.keys()) {
      if (index >= results.length) this.interimByIndex.delete(index);
    }

    for (let index = Math.max(0, resultIndex); index < results.length; index += 1) {
      const result = results[index];
      if (!result) continue;
      const transcript = result[0]?.transcript?.trim() ?? "";

      if (result.isFinal) {
        if (transcript) this.finalByIndex.set(index, transcript);
        else this.finalByIndex.delete(index);
        this.interimByIndex.delete(index);
      } else if (!this.finalByIndex.has(index)) {
        if (transcript) this.interimByIndex.set(index, transcript);
        else this.interimByIndex.delete(index);
      }
    }

    compactTranscriptEntries(this.finalByIndex);
    compactTranscriptEntries(this.interimByIndex);

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

export function createTranscriptResultHandler(
  session: TranscriptSession,
  onSnapshot: (snapshot: TranscriptSnapshot) => void,
): (event: SpeechResultEventLike) => void {
  return (event) => onSnapshot(session.update(event.results, event.resultIndex));
}
