import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";

import {
  createTranscriptResultHandler,
  releaseRecognition,
  stopActiveRecognition,
  TranscriptSession,
  type SpeechResultListLike,
} from "./transcript-session";

function resultList(
  items: Array<{ isFinal: boolean; transcript: string }>,
  onRead?: () => void,
): SpeechResultListLike {
  const list: Record<string | number, unknown> = { length: items.length };
  items.forEach((item, index) => {
    Object.defineProperty(list, index, {
      enumerable: true,
      get: () => {
        onRead?.();
        return { isFinal: item.isFinal, 0: { transcript: item.transcript } };
      },
    });
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

  it("removes interim indexes that disappear while preserving confirmed finals", () => {
    const interimOnly = new TranscriptSession();
    interimOnly.update(resultList([{ isFinal: false, transcript: "frase provisória" }]));

    assert.deepEqual(interimOnly.update(resultList([])), {
      finalText: "",
      interimText: "",
      text: "",
    });

    const withFinal = new TranscriptSession();
    withFinal.update(resultList([
      { isFinal: true, transcript: "frase confirmada" },
      { isFinal: false, transcript: "continuação provisória" },
    ]));

    assert.deepEqual(withFinal.update(resultList([
      { isFinal: true, transcript: "frase confirmada" },
    ]), 1), {
      finalText: "frase confirmada",
      interimText: "",
      text: "frase confirmada",
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

  it("preserves short emotional prefix and exact repetition with at most one new token", () => {
    const paralysis = new TranscriptSession();
    const repeated = new TranscriptSession();

    assert.equal(paralysis.update(resultList([
      { isFinal: true, transcript: "eu não" },
      { isFinal: true, transcript: "eu não consigo" },
    ])).finalText, "eu não eu não consigo");

    assert.equal(repeated.update(resultList([
      { isFinal: true, transcript: "não consigo" },
      { isFinal: true, transcript: "não consigo" },
    ])).finalText, "não consigo não consigo");
  });

  it("ignores Unicode edge punctuation only for comparison while preserving displayed punctuation", () => {
    const prefix = new TranscriptSession();
    const overlap = new TranscriptSession();

    assert.equal(prefix.update(resultList([
      { isFinal: true, transcript: "Hoje, eu tenho praia" },
      { isFinal: true, transcript: "“Hoje” eu tenho praia com a Erica" },
    ])).finalText, "Hoje, eu tenho praia com a Erica");

    assert.equal(overlap.update(resultList([
      { isFinal: true, transcript: "Eu falei: com a Érica;" },
      { isFinal: true, transcript: "“com a Erica” e descansei" },
    ])).finalText, "Eu falei: com a Érica; e descansei");
  });

  it("processes and compacts 200 successive cumulative Android events from resultIndex", () => {
    const session = new TranscriptSession();
    const cumulative: Array<{ isFinal: boolean; transcript: string }> = [];
    let resultReads = 0;
    let snapshot = session.snapshot();

    for (let index = 0; index < 200; index += 1) {
      cumulative.push({
        isFinal: true,
        transcript: ["Hoje", "eu", "contei", ...Array.from({ length: index + 1 }, (__, part) => `parte${part}`)].join(" "),
      });
      snapshot = session.update(resultList(cumulative, () => { resultReads += 1; }), index);
    }

    const storedFinals = (session as unknown as { finalByIndex: Map<number, string> }).finalByIndex;

    assert.equal(snapshot.finalText, cumulative[cumulative.length - 1]?.transcript);
    assert.equal(storedFinals.size, 1);
    assert.equal(resultReads, 200);
  });

  it("does not reprocess stable indexes before resultIndex", () => {
    const session = new TranscriptSession();
    session.update(resultList([{ isFinal: true, transcript: "trecho preservado" }]));

    assert.equal(session.update(resultList([
      { isFinal: true, transcript: "trecho que não deve voltar" },
      { isFinal: true, transcript: "novo trecho" },
    ]), 1).finalText, "trecho preservado novo trecho");
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
  it("forwards event.resultIndex through the handler used by voice consumers", () => {
    let received: ReturnType<TranscriptSession["snapshot"]> | null = null;
    const session = new TranscriptSession();
    session.update(resultList([{ isFinal: true, transcript: "trecho preservado" }]));
    const handler = createTranscriptResultHandler(session, (snapshot) => {
      received = snapshot;
    });
    handler({
      results: resultList([
        { isFinal: true, transcript: "trecho que não deve voltar" },
        { isFinal: true, transcript: "novo trecho" },
      ]),
      resultIndex: 1,
    });

    assert.deepEqual(received, {
      finalText: "trecho preservado novo trecho",
      interimText: "",
      text: "trecho preservado novo trecho",
    });
  });
});

describe("voice consumer wiring", () => {
  const webSourceRoot = existsSync(resolve(process.cwd(), "src/features/voice/transcript-session.ts"))
    ? resolve(process.cwd(), "src")
    : resolve(process.cwd(), "apps/web/src");
  const voiceRoutes = [
    "aura-chat-page.tsx",
    "checkin-page.tsx",
    "journal-page.tsx",
    "planner-page.tsx",
  ];

  it("uses the shared resultIndex-aware handler on all four voice surfaces", () => {
    voiceRoutes.forEach((route) => {
      const source = readFileSync(resolve(webSourceRoot, "routes", route), "utf8");
      assert.match(source, /recognition\.onresult\s*=\s*createTranscriptResultHandler\(/, route);
    });
  });

  it("avoids Array.at in the shared module for older PWA runtimes", () => {
    const source = readFileSync(resolve(webSourceRoot, "features/voice/transcript-session.ts"), "utf8");
    assert.doesNotMatch(source, /\.at\(/);
  });

  it("stops active recognition on unmount in all four voice surfaces", () => {
    voiceRoutes.forEach((route) => {
      const source = readFileSync(resolve(webSourceRoot, "routes", route), "utf8");
      const cleanup = /useEffect\(\(\) => \{\s*return \(\) => \{[\s\S]{0,500}?stopActiveRecognition\(recognitionRef\);[\s\S]{0,300}?\};\s*\}, \[\]\);/;
      assert.equal(cleanup.test(source), true, `${route} precisa encerrar o reconhecimento no unmount`);
    });
  });

  it("clears the check-in silence timer during voice cleanup", () => {
    const source = readFileSync(resolve(webSourceRoot, "routes/checkin-page.tsx"), "utf8");
    assert.equal(/voiceSilenceTimerRef/.test(source), true, "check-in precisa manter o timer em ref");
    assert.equal(/clearTimeout\(voiceSilenceTimerRef\.current\)/.test(source), true, "check-in precisa limpar o timer");
  });
});
