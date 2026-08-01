import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  releaseRecognition,
  stopActiveRecognition,
  TranscriptSession,
  type SpeechResultListLike,
} from "./transcript-session";

function resultList(items: Array<{ isFinal: boolean; transcript: string }>): SpeechResultListLike {
  const list: Record<string | number, unknown> = { length: items.length };
  items.forEach((item, index) => {
    list[index] = { isFinal: item.isFinal, 0: { transcript: item.transcript } };
  });
  return list as unknown as SpeechResultListLike;
}

describe("TranscriptSession", () => {
  it("keeps each final phrase once while replacing interim corrections", () => {
    const session = new TranscriptSession();

    assert.deepEqual(session.update(resultList([
      { isFinal: false, transcript: "hoje eu tenho" },
    ])), { finalText: "", interimText: "hoje eu tenho", text: "hoje eu tenho" });

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "hoje eu tenho praia" },
      { isFinal: false, transcript: "com a Erika" },
    ])), { finalText: "hoje eu tenho praia", interimText: "com a Erika", text: "hoje eu tenho praia com a Erika" });

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "hoje eu tenho praia" },
      { isFinal: true, transcript: "com a Erika" },
      { isFinal: false, transcript: "e estou cansada" },
    ])), { finalText: "hoje eu tenho praia com a Erika", interimText: "e estou cansada", text: "hoje eu tenho praia com a Erika e estou cansada" });

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "hoje eu tenho praia" },
      { isFinal: true, transcript: "com a Erika" },
      { isFinal: true, transcript: "e estou cansada" },
    ])), { finalText: "hoje eu tenho praia com a Erika e estou cansada", interimText: "", text: "hoje eu tenho praia com a Erika e estou cansada" });
  });

  it("clears all state before a restarted recording session", () => {
    const session = new TranscriptSession();
    session.update(resultList([{ isFinal: true, transcript: "trecho antigo" }]));
    session.reset();

    assert.deepEqual(session.update(resultList([{ isFinal: true, transcript: "nova sessao" }])), {
      finalText: "nova sessao",
      interimText: "",
      text: "nova sessao",
    });
  });
});

describe("recognition lifecycle", () => {
  it("clears the active reference before stopping so a second recording cannot overlap", () => {
    const ref: { current: { stop: () => void } | null } = { current: null };
    let stopCalls = 0;
    const oldRecognition = {
      stop: () => {
        assert.equal(ref.current, null);
        stopCalls += 1;
      },
    };
    ref.current = oldRecognition;

    assert.equal(stopActiveRecognition(ref), oldRecognition);
    assert.equal(stopCalls, 1);
    assert.equal(ref.current, null);
  });

  it("does not let an old end event clear a newer recording", () => {
    const oldRecognition = { stop: () => undefined };
    const newRecognition = { stop: () => undefined };
    const ref: { current: typeof oldRecognition | null } = { current: newRecognition };

    assert.equal(releaseRecognition(ref, oldRecognition), false);
    assert.equal(ref.current, newRecognition);
    assert.equal(releaseRecognition(ref, newRecognition), true);
    assert.equal(ref.current, null);
  });
});
