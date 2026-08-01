import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  createTranscriptResultHandler,
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

  it("merges cumulative final phrases reported under different Android indexes", () => {
    const session = new TranscriptSession();

    session.update(resultList([
      { isFinal: true, transcript: "Hoje eu tenho praia" },
    ]));

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "Hoje eu tenho praia" },
      { isFinal: true, transcript: "Hoje eu tenho praia com a Erica" },
    ])), {
      finalText: "Hoje eu tenho praia com a Erica",
      interimText: "",
      text: "Hoje eu tenho praia com a Erica",
    });
  });

  it("ignores an exact phrase repeated under a new result index", () => {
    const session = new TranscriptSession();

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "Estou muito cansada hoje" },
      { isFinal: true, transcript: "Estou muito cansada hoje" },
    ])), {
      finalText: "Estou muito cansada hoje",
      interimText: "",
      text: "Estou muito cansada hoje",
    });
  });

  it("merges suffix and prefix overlap while preserving the original spelling", () => {
    const session = new TranscriptSession();

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "Eu tenho praia com a Érica" },
      { isFinal: true, transcript: "com a Erica e estou cansada" },
    ])), {
      finalText: "Eu tenho praia com a Érica e estou cansada",
      interimText: "",
      text: "Eu tenho praia com a Érica e estou cansada",
    });
  });

  it("accepts a corrected final phrase for the same result index", () => {
    const session = new TranscriptSession();

    session.update(resultList([
      { isFinal: true, transcript: "Hoje eu tenho prala" },
    ]));

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "Hoje eu tenho praia" },
    ])), {
      finalText: "Hoje eu tenho praia",
      interimText: "",
      text: "Hoje eu tenho praia",
    });
  });

  it("keeps only the new interim suffix when Android repeats the final phrase cumulatively", () => {
    const session = new TranscriptSession();

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "Hoje eu tenho praia" },
      { isFinal: false, transcript: "hoje eu tenho praia com a Erica" },
    ])), {
      finalText: "Hoje eu tenho praia",
      interimText: "com a Erica",
      text: "Hoje eu tenho praia com a Erica",
    });
  });

  it("moves Android automatic punctuation to the end of a cumulative phrase", () => {
    const session = new TranscriptSession();

    assert.deepEqual(session.update(resultList([
      { isFinal: true, transcript: "Hoje eu tenho praia." },
      { isFinal: true, transcript: "Hoje eu tenho praia com a Erica" },
    ])), {
      finalText: "Hoje eu tenho praia com a Erica.",
      interimText: "",
      text: "Hoje eu tenho praia com a Erica.",
    });
  });

  it("preserves legitimate one-word emotional repetition between independent results", () => {
    const emphasis = new TranscriptSession();
    const paralysis = new TranscriptSession();

    assert.equal(emphasis.update(resultList([
      { isFinal: true, transcript: "muito" },
      { isFinal: true, transcript: "muito cansada" },
    ])).finalText, "muito muito cansada");

    assert.equal(paralysis.update(resultList([
      { isFinal: true, transcript: "não" },
      { isFinal: true, transcript: "não consigo" },
    ])).finalText, "não não consigo");
  });

  it("compacts final entries absorbed by a long cumulative Android sequence", () => {
    const session = new TranscriptSession();
    const cumulative = Array.from({ length: 200 }, (_, index) => ({
      isFinal: true,
      transcript: ["Hoje", "eu", "contei", ...Array.from({ length: index + 1 }, (__, part) => `parte${part}`)].join(" "),
    }));

    const snapshot = session.update(resultList(cumulative));
    const storedFinals = (session as unknown as { finalByIndex: Map<number, string> }).finalByIndex;

    assert.equal(snapshot.finalText, cumulative.at(-1)?.transcript);
    assert.equal(storedFinals.size, 1);
  });

  it("removes the latest hypothesis when the same final index becomes empty", () => {
    const session = new TranscriptSession();
    session.update(resultList([{ isFinal: true, transcript: "hipótese incorreta" }]));

    assert.deepEqual(session.update(resultList([{ isFinal: true, transcript: "   " }])), {
      finalText: "",
      interimText: "",
      text: "",
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

describe("recognition onresult integration", () => {
  it("delivers one merged snapshot through the handler used by the central Airia consumer", () => {
    let received: ReturnType<TranscriptSession["snapshot"]> | null = null;
    const handler = createTranscriptResultHandler(new TranscriptSession(), (snapshot) => {
      received = snapshot;
    });
    handler({
      results: resultList([
        { isFinal: true, transcript: "Hoje eu tenho praia." },
        { isFinal: true, transcript: "Hoje eu tenho praia com a Erica" },
      ]),
    });

    assert.deepEqual(received, {
      finalText: "Hoje eu tenho praia com a Erica.",
      interimText: "",
      text: "Hoje eu tenho praia com a Erica.",
    });
  });
});
