import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  extractTranscript,
  isSpeechRecognitionSupported,
  mergeTranscript,
  type SpeechResultListLike,
} from "./journal-voice.helpers";

function resultList(items: Array<{ isFinal: boolean; transcript: string }>): SpeechResultListLike {
  const list: Record<string | number, unknown> = { length: items.length };
  items.forEach((item, index) => {
    list[index] = { isFinal: item.isFinal, 0: { transcript: item.transcript } };
  });
  return list as unknown as SpeechResultListLike;
}

describe("isSpeechRecognitionSupported", () => {
  it("detects standard and webkit-prefixed APIs", () => {
    assert.equal(isSpeechRecognitionSupported({ SpeechRecognition: function () {} }), true);
    assert.equal(isSpeechRecognitionSupported({ webkitSpeechRecognition: function () {} }), true);
  });

  it("returns false when unavailable", () => {
    assert.equal(isSpeechRecognitionSupported({}), false);
    assert.equal(isSpeechRecognitionSupported(undefined), false);
    assert.equal(isSpeechRecognitionSupported(null), false);
  });
});

describe("mergeTranscript", () => {
  it("appends with a single space", () => {
    assert.equal(mergeTranscript("oi", "tudo bem"), "oi tudo bem");
  });

  it("avoids leading space and trailing-space duplication", () => {
    assert.equal(mergeTranscript("", "começo"), "começo");
    assert.equal(mergeTranscript("oi ", "lá"), "oi lá");
  });

  it("ignores empty additions", () => {
    assert.equal(mergeTranscript("oi", "   "), "oi");
  });
});

describe("extractTranscript", () => {
  it("separates final from interim results", () => {
    const results = resultList([
      { isFinal: true, transcript: "hoje foi" },
      { isFinal: true, transcript: "um dia pesado" },
      { isFinal: false, transcript: "mas eu" },
    ]);
    assert.deepEqual(extractTranscript(results), {
      finalText: "hoje foi um dia pesado",
      interimText: "mas eu",
    });
  });

  it("honors the start index so already-saved finals are not re-collected", () => {
    const results = resultList([
      { isFinal: true, transcript: "trecho antigo" },
      { isFinal: false, transcript: "novo trecho" },
    ]);
    assert.deepEqual(extractTranscript(results, 1), {
      finalText: "",
      interimText: "novo trecho",
    });
  });
});
