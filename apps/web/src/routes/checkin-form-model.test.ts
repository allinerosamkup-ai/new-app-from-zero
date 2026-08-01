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
});
