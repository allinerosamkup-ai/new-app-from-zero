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

/**
 * O botão desabilitado precisa dizer o que falta.
 *
 * Em produção um check-in se perdeu exatamente aqui: humor e energia não tinham
 * sido capturados, o botão ficou morto sem explicação, e a leitura de quem usa
 * foi "fiz o check-in e não saiu o resultado". O log do servidor confirmou —
 * nenhum `POST /checkins` em 30 horas, com 32 leituras de histórico no mesmo
 * período.
 */
describe("o que falta para registrar", () => {
  const cheio = { humor: 5, energia: 5, factors: ["work_pressure"], noFactorIdentified: false };

  it("nada falta quando tudo foi respondido", () => {
    expect(model.missingCheckinAnswers(cheio)).toEqual([]);
    expect(model.canSubmitContextualCheckin(cheio)).toBe(true);
  });

  it("nomeia cada campo pendente, na ordem da tela", () => {
    expect(model.missingCheckinAnswers({ ...cheio, humor: null })).toEqual(["humor"]);
    expect(model.missingCheckinAnswers({ ...cheio, energia: null })).toEqual(["energia"]);
    expect(model.missingCheckinAnswers({ ...cheio, factors: [] })).toEqual(["fator"]);
    expect(model.missingCheckinAnswers({ humor: null, energia: null, factors: [], noFactorIdentified: false }))
      .toEqual(["humor", "energia", "fator"]);
  });

  it("marcar que não identificou fator conta como resposta", () => {
    expect(model.missingCheckinAnswers({ ...cheio, factors: [], noFactorIdentified: true })).toEqual([]);
  });

  it("a lista vazia e o botão liberado nunca discordam", () => {
    for (const humor of [null, 5]) {
      for (const energia of [null, 5]) {
        for (const factors of [[], ["rest"]]) {
          const input = { humor, energia, factors, noFactorIdentified: false };
          expect(model.canSubmitContextualCheckin(input)).toBe(model.missingCheckinAnswers(input).length === 0);
        }
      }
    }
  });
});

describe("ambiente da tela de check-in", () => {
  function canais(css: string): Array<[number, number, number]> {
    return [...css.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)]
      .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number]);
  }

  it("sem resposta não pinta nada", () => {
    expect(model.checkinAmbience(null, null)).toBe("#FFFFFF");
  });

  it("energia alta aparece mais que energia baixa", () => {
    const alpha = (css: string) => Number(css.match(/,([\d.]+)\)\s*0%/)![1]);
    expect(alpha(model.checkinAmbience(5, 9))).toBeGreaterThan(alpha(model.checkinAmbience(5, 1)));
  });

  /**
   * A trava que importa: humor baixo não pode virar cor de alarme, e o rosa
   * não volta por aqui. O corte é o mesmo de `styles/css-tokens.test.ts` —
   * claro, quente e com azul perto do verde.
   */
  it("nenhuma combinação produz salmão, rosa ou vermelho", () => {
    for (let humor = 1; humor <= 10; humor += 1) {
      for (let energia = 1; energia <= 10; energia += 1) {
        for (const [r, g, b] of canais(model.checkinAmbience(humor, energia))) {
          const rosa = r >= 200 && g >= 130 && r - g >= 25 && g - b <= 45;
          expect(rosa, `humor ${humor}/energia ${energia} gerou rgb(${r},${g},${b})`).toBe(false);
          expect(r <= g + 10, `humor ${humor}/energia ${energia} ficou quente demais`).toBe(true);
        }
      }
    }
  });

  it("humor alto puxa para o verde e humor baixo para o azul", () => {
    const frio = canais(model.checkinAmbience(1, 5))[0];
    const verde = canais(model.checkinAmbience(10, 5))[0];
    // Azul mais alto no frio, verde relativamente mais forte no alto.
    expect(frio[2]).toBeGreaterThan(verde[2]);
    expect(verde[1] - verde[2]).toBeGreaterThan(frio[1] - frio[2]);
  });
});
