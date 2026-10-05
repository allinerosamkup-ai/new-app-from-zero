import { describe, expect, it } from "vitest";
import { safetySignalLabel } from "./safety-signal-label";

describe("existing safety signal labels", () => {
  it("localizes all six deterministic labels in English, including a regional locale", () => {
    const expected = {
      "linguagem de crise ou autoagressao": "language indicating crisis or self-harm",
      "sofrimento intenso ou risco contextual": "intense distress or contextual risk",
      "sinal de desregulacao emocional": "sign of emotional dysregulation",
      "humor e energia muito baixos": "very low mood and energy",
      "sono muito baixo": "very poor sleep",
      "irritabilidade muito alta": "very high irritability",
    };
    for (const [signal, label] of Object.entries(expected)) {
      expect(safetySignalLabel(signal, "en-US")).toBe(label);
    }
  });

  it("restores Portuguese accents and preserves unrecognized source signals", () => {
    expect(safetySignalLabel("linguagem de crise ou autoagressao", "pt-BR")).toBe("linguagem de crise ou autoagressão");
    expect(safetySignalLabel("sinal novo", "en")).toBe("sinal novo");
  });
});
