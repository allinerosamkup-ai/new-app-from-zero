import { describe, expect, it } from "vitest";

import { buildFirstCheckin } from "./first-checkin";
import { CHECKIN_EMOTION_IDS, CHECKIN_FACTOR_IDS } from "../../routes/checkin-form-model";
import type { StoryAnswers } from "./reading";

function answers(overrides: Partial<StoryAnswers> = {}): StoryAnswers {
  return {
    name: "Alline",
    feeling: null,
    blockers: [],
    openFronts: null,
    drains: [],
    restorers: [],
    listPreference: null,
    ...overrides,
  };
}

describe("buildFirstCheckin", () => {
  it("usa o que ela respondeu, não um número de enfeite", () => {
    const payload = buildFirstCheckin(answers({ feeling: "Sobrecarregada" }), "quick");

    expect(payload.humor).toBe(3);
    expect(payload.energia).toBe(3);
    expect(payload.emotion).toBe("exhausted");
  });

  it("capacidade alta vira energia alta", () => {
    expect(buildFirstCheckin(answers({ feeling: "Animada" }), "heavy").energia).toBe(8);
  });

  it("traduz drenos e recuperadores para o vocabulário do check-in", () => {
    const payload = buildFirstCheckin(
      answers({ drains: ["Dormir mal", "Cobrança"], restorers: ["Ar livre"] }),
      "moderate",
    );

    expect(payload.factors).toContain("slept_little");
    expect(payload.factors).toContain("work_pressure");
    expect(payload.factors).toContain("fresh_air");
  });

  it("só emite emoções e fatores que o check-in reconhece", () => {
    const payload = buildFirstCheckin(
      answers({
        feeling: "Travada",
        drains: ["Dormir mal", "Barulho e gente", "Bagunça em volta"],
        restorers: ["Música", "Fazer algo com as mãos", "Movimento"],
      }),
      "moderate",
    );

    // Escolha sem equivalente é descartada em vez de virar id inventado, que o
    // backend rejeitaria em silêncio no filtro canônico.
    for (const factor of payload.factors ?? []) {
      expect(CHECKIN_FACTOR_IDS as readonly string[]).toContain(factor);
    }
    for (const emotion of payload.emotions ?? []) {
      expect(CHECKIN_EMOTION_IDS as readonly string[]).toContain(emotion);
    }
  });

  it("sem resposta nenhuma não inventa emoção nem fator", () => {
    const payload = buildFirstCheckin(answers(), null);

    expect(payload.emotion).toBeUndefined();
    expect(payload.factors).toBeUndefined();
    expect(payload.note).toBeUndefined();
    // Humor e energia são obrigatórios no contrato; o neutro é o único valor
    // honesto quando ela não disse nada.
    expect(payload.humor).toBe(5);
    expect(payload.energia).toBe(5);
  });
});
