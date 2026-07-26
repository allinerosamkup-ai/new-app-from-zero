import { describe, expect, it } from "vitest";

import {
  ONBOARDING_BASIC_STEPS,
  buildOnboardingProcessPayload,
  createEmptyOnboardingDraft,
  restartOnboardingFlow,
} from "./onboarding";

describe("onboarding flow", () => {
  it("starts with the name and age questions visible", () => {
    expect(ONBOARDING_BASIC_STEPS[0].question).toBe("Como você quer ser chamada?");
    expect(ONBOARDING_BASIC_STEPS[1].question).toBe("Qual sua idade?");
  });

  it("starts with a clean draft instead of old example answers", () => {
    const draft = createEmptyOnboardingDraft();

    expect(draft.fullName).toBe("");
    expect(draft.currentFeeling).toBe("");
    expect(JSON.stringify(draft)).not.toContain("Cansada mas esperançosa");
  });

  it("restarts onboarding by clearing only the draft before opening the guided flow", () => {
    const calls: string[] = [];

    restartOnboardingFlow(
      () => calls.push("reset"),
      (path) => calls.push(`navigate:${path}`),
    );

    expect(calls).toEqual(["reset", "navigate:/onboarding/guiado"]);
  });

  it("builds the backend payload from new answers", () => {
    const draft = createEmptyOnboardingDraft();
    draft.fullName = " Alline ";
    draft.age = "34";
    draft.currentFeeling = "Com energia baixa, mas querendo organizar a rotina.";
    draft.routineText = "Trabalho melhor de manhã e perco energia depois das 18h.";
    draft.energyDrainsMore = ["Reuniões", "Crises"];
    draft.energyDrainsLess = ["Caminhada"];
    draft.sleepQuality = "irregular";
    draft.wakeTime = "08:00";
    draft.sleepTime = "23:30";
    draft.cognitivePreferences = ["Foco máximo de manhã", "Blocos curtos"];

    expect(buildOnboardingProcessPayload(draft)).toMatchObject({
      fullName: "Alline",
      age: 34,
      currentFeeling: "Com energia baixa, mas querendo organizar a rotina.",
      wakeTime: "08:00",
      sleepTime: "23:30",
      routineText: "Trabalho melhor de manhã e perco energia depois das 18h.",
      mainEnergyPressure: "Drena mais: Reuniões, Crises. Recupera energia: Caminhada. Foco disponível em dia bom: 6/10.",
      primaryGoal: "Foco máximo de manhã",
      supportGoals: ["Foco máximo de manhã", "Blocos curtos"],
    });
  });
});
