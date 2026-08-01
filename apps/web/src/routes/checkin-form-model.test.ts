import { describe, expect, it } from "vitest";

import * as model from "./checkin-form-model";

describe("integrated contextual check-in model", () => {
  it("requires current mood, energy and either a real factor or an explicit no-factor answer", () => {
    expect(typeof model.canSubmitContextualCheckin).toBe("function");
    const canSubmit = model.canSubmitContextualCheckin!;

    expect(canSubmit({ humor: 3, energia: 7, factors: [], noFactorIdentified: false })).toBe(false);
    expect(canSubmit({ humor: 3, energia: 7, factors: ["work_pressure"], noFactorIdentified: false })).toBe(true);
    expect(canSubmit({ humor: 3, energia: 7, factors: [], noFactorIdentified: true })).toBe(true);
    expect(canSubmit({ humor: null, energia: 7, factors: ["work_pressure"], noFactorIdentified: false })).toBe(false);
  });

  it("accepts factors extracted by voice through the same gate", () => {
    expect(typeof model.canSubmitContextualCheckin).toBe("function");
    expect(model.canSubmitContextualCheckin!({
      humor: 4,
      energia: 3,
      factors: ["slept_little"],
      noFactorIdentified: false,
    })).toBe(true);
  });

  it("does not persist the explicit no-factor answer as a fake factor", () => {
    expect(typeof model.buildContextualCheckinEntry).toBe("function");
    const entry = model.buildContextualCheckinEntry!({
      humor: 5,
      energia: 6,
      emotions: [],
      factors: [],
      noFactorIdentified: true,
    });

    expect(entry).not.toHaveProperty("factors");
    expect(entry).not.toHaveProperty("emotion");
    expect(entry).not.toHaveProperty("emotions");
  });

  it("preserves every optional context explicitly selected", () => {
    expect(typeof model.buildContextualCheckinEntry).toBe("function");
    const entry = model.buildContextualCheckinEntry!({
      humor: 3,
      energia: 7,
      emotions: ["angry", "tired"],
      factors: ["work_pressure", "slept_little"],
      noFactorIdentified: false,
      sono: 2,
      sleepHours: 5.5,
      fisico: 4,
      social: 2,
      isFlowing: true,
      flowDay: 2,
      flowIntensity: "intenso",
      symptomLevels: { colica: 3, dorCabeca: 1 },
      medicationTakenToday: true,
      focusScore: 4,
      hyperfocusOccurred: false,
      dayType: "mixed",
      mixedEpisodeNote: "Energia acelerada com humor baixo.",
      note: "Pressão no trabalho depois de dormir pouco.",
    });

    expect(entry).toEqual({
      humor: 3,
      energia: 7,
      emotion: "angry",
      emotions: ["angry", "tired"],
      factors: ["work_pressure", "slept_little"],
      sono: 2,
      sleepHours: 5.5,
      fisico: 4,
      social: 2,
      isFlowing: true,
      flowDay: 2,
      flowIntensity: "intenso",
      symptomLevels: { colica: 3, dorCabeca: 1 },
      medicationTakenToday: true,
      focusScore: 4,
      hyperfocusOccurred: false,
      dayType: "mixed",
      mixedEpisodeNote: "Energia acelerada com humor baixo.",
      note: "Pressão no trabalho depois de dormir pouco.",
    });
  });

  it("does not synthesize absent optional scores, emotions or factors", () => {
    expect(typeof model.buildContextualCheckinEntry).toBe("function");
    const entry = model.buildContextualCheckinEntry!({
      humor: 6,
      energia: 5,
      emotions: [],
      factors: [],
      noFactorIdentified: true,
    });

    expect(entry).toEqual({ humor: 6, energia: 5 });
  });

  it("does not run success effects when persistence resolves to null", async () => {
    expect(typeof model.finalizeContextualCheckin).toBe("function");
    const effects: string[] = [];

    await expect(model.finalizeContextualCheckin!({
      persist: async () => null,
      onConfirmed: () => effects.push("confirmed"),
    })).rejects.toThrow(/salvar/i);
    expect(effects).toEqual([]);
  });

  it("does not run success effects when persistence rejects", async () => {
    expect(typeof model.finalizeContextualCheckin).toBe("function");
    const effects: string[] = [];

    await expect(model.finalizeContextualCheckin!({
      persist: async () => { throw new Error("offline"); },
      onConfirmed: () => effects.push("confirmed"),
    })).rejects.toThrow("offline");
    expect(effects).toEqual([]);
  });

  it("runs success effects only after a persisted receipt", async () => {
    expect(typeof model.finalizeContextualCheckin).toBe("function");
    const effects: string[] = [];
    const receipt = { stateLabel: "Estado confirmado" };

    await expect(model.finalizeContextualCheckin!({
      persist: async () => receipt,
      onConfirmed: (value) => effects.push(value.stateLabel),
    })).resolves.toEqual(receipt);
    expect(effects).toEqual(["Estado confirmado"]);
  });

  it("accepts only canonical and plausible fields from voice", () => {
    expect(typeof model.parseVoiceCheckinResponse).toBe("function");
    expect(model.parseVoiceCheckinResponse!({
      humor: 4,
      energia: 7,
      sleepHours: 5.5,
      emotions: ["angry", "not-canonical", 3],
      factors: ["work_pressure", "invented_factor", null],
      note: "  Pressão real hoje.  ",
    })).toEqual({
      humor: 4,
      energia: 7,
      sleepHours: 5.5,
      emotions: ["angry"],
      factors: ["work_pressure"],
      note: "Pressão real hoje.",
    });
  });

  it("turns invalid or missing voice values into absent context", () => {
    expect(typeof model.parseVoiceCheckinResponse).toBe("function");
    expect(model.parseVoiceCheckinResponse!({
      humor: 4.5,
      energia: 11,
      sleepHours: -2,
      emotions: "angry",
      factors: ["invented_factor"],
      note: 123,
    })).toEqual({
      humor: null,
      energia: null,
      sleepHours: null,
      emotions: [],
      factors: [],
      note: null,
    });
  });
});
