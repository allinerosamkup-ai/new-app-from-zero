import { describe, expect, it } from "vitest";

import { buildCheckinSubmission } from "./checkin-submission";
import { buildContextualCheckinEntry } from "../../routes/checkin-form-model";

describe("manual check-in submission", () => {
  it("does not invent optional neutral signals", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-07-31",
      checkinSlot: "morning",
      entry: { humor: 3, energia: 3, emotion: "sad" },
    });
    expect(payload).not.toHaveProperty("clarityScore");
    expect(payload).not.toHaveProperty("irritabilityScore");
    expect(payload).not.toHaveProperty("physicalScore");
    expect(payload).not.toHaveProperty("socialScore");
  });

  it("marks only one primary observation per window; extras are explicit", () => {
    const primary = buildCheckinSubmission({
      localDate: "2026-08-13",
      checkinSlot: "morning-081500",
      entry: { humor: 8, energia: 8 },
    });
    const extra = buildCheckinSubmission({
      localDate: "2026-08-13",
      checkinSlot: "morning-093000",
      checkinPurpose: "extra",
      entry: { humor: 7, energia: 6 },
    });
    expect(primary.checkinPurpose).toBe("window");
    expect(extra.checkinPurpose).toBe("extra");
  });

  it("keeps sleep hours separate from the optional sleep score", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-07-31",
      checkinSlot: "morning",
      entry: { humor: 6, energia: 5, emotion: "calm", sleepHours: 7.5 },
    });
    expect(payload.sleepHours).toBe(7.5);
    expect(payload).not.toHaveProperty("sleepScore");
  });

  /**
   * A regra do produto: pergunta que a tela faz precisa chegar ao banco.
   *
   * Esta suíte percorre o caminho inteiro — rascunho da tela → entrada →
   * payload — porque o buraco anterior estava exatamente entre duas camadas que
   * passavam nos testes isoladamente. Clareza e irritabilidade tinham coluna e
   * nenhuma pergunta; capacidade e objetivo prioritário tinham pergunta e
   * nenhum destino, viajando só pelo estado de navegação.
   */
  it("leva ao payload tudo que a tela perguntou", () => {
    const entry = buildContextualCheckinEntry({
      humor: 4,
      energia: 8,
      emotions: ["agitated"],
      factors: ["work_pressure"],
      noFactorIdentified: false,
      sono: 3,
      sleepHours: 5,
      clareza: 2,
      irritabilidade: 9,
      fisico: 6,
      social: 4,
      capacity: "quick",
      priorityGoalId: "goal-7",
      focusScore: 3,
      hyperfocusOccurred: false,
      medicationTakenToday: true,
      dayType: "mixed",
      mixedEpisodeNote: "acelerada e para baixo ao mesmo tempo",
      note: "dia esquisito",
    });

    const payload = buildCheckinSubmission({
      localDate: "2026-08-08",
      checkinSlot: "morning",
      entry,
    });

    expect(payload.moodScore).toBe(4);
    expect(payload.energyScore).toBe(8);
    expect(payload.clarityScore).toBe(2);
    expect(payload.irritabilityScore).toBe(9);
    expect(payload.physicalScore).toBe(6);
    expect(payload.socialScore).toBe(4);
    expect(payload.sleepScore).toBe(3);
    expect(payload.sleepHours).toBe(5);
    expect(payload.focusScore).toBe(3);
    expect(payload.hyperfocusOccurred).toBe(false);
    expect(payload.medicationTakenToday).toBe(true);
    expect(payload.dayType).toBe("mixed");
    expect(payload.mixedEpisodeNote).toBe("acelerada e para baixo ao mesmo tempo");
    expect(payload.factors).toEqual(["work_pressure"]);
    expect(payload.emotions).toEqual(["agitated"]);
    expect(payload.note).toBe("dia esquisito");
    // O que não tem coluna própria vai na Json que já existe, sem migração.
    expect(payload.signalMetadata.dayPlan).toEqual({
      capacity: "quick",
      priorityGoalId: "goal-7",
    });
    expect(payload.signalMetadata.clarity?.provenance).toBe("reported");
    expect(payload.signalMetadata.irritability?.provenance).toBe("reported");
  });

  it("não inventa dayPlan quando a tela não perguntou", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-08-08",
      checkinSlot: "morning",
      entry: { humor: 5, energia: 5 },
    });

    expect(payload.signalMetadata).not.toHaveProperty("dayPlan");
  });

  it("never turns an older journal draft into the check-in note", () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "morning",
      entry: { humor: 3, energia: 7, emotion: "angry" },
    });

    expect(payload).not.toHaveProperty("note");
  });
});
