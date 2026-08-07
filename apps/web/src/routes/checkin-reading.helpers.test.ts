import { describe, expect, it } from "vitest";

import { buildCheckinReading } from "./checkin-reading.helpers";

const GOAL = {
  title: "Deixar a sala pronta para uso",
  totalActions: 4,
  completedActions: 1,
};

describe("buildCheckinReading", () => {
  it("não inventa leitura quando não há histórico nem objetivo", () => {
    expect(buildCheckinReading({
      todayEnergy: 5,
      todayMood: 5,
      previousEnergies: [],
      goals: [],
    })).toBeNull();
  });

  it("não inventa leitura quando o dia está dentro da própria média", () => {
    expect(buildCheckinReading({
      todayEnergy: 6,
      todayMood: 6,
      previousEnergies: [6, 6, 7, 5],
      goals: [{ ...GOAL, totalActions: 3, completedActions: 1, daysSinceLastCompletion: 12, lastCompletedActionTitle: "x" }],
    })).toBeNull();
  });

  it("aponta energia abaixo da média com o número que sustenta a frase", () => {
    const reading = buildCheckinReading({
      todayEnergy: 3,
      todayMood: 4,
      previousEnergies: [7, 8, 7, 6],
      goals: [GOAL],
    });

    expect(reading?.kind).toBe("energy_below");
    expect(reading?.text).toContain("Deixar a sala pronta para uso");
    expect(reading?.evidence).toContain("energia 3/10");
  });

  it("aponta energia acima da média", () => {
    const reading = buildCheckinReading({
      todayEnergy: 9,
      todayMood: 8,
      previousEnergies: [5, 5, 6, 4],
      goals: [GOAL],
    });

    expect(reading?.kind).toBe("energy_above");
  });

  it("prefere continuar de onde parou quando houve conclusão recente", () => {
    const reading = buildCheckinReading({
      todayEnergy: 6,
      todayMood: 6,
      previousEnergies: [6, 6, 6],
      goals: [{ ...GOAL, lastCompletedActionTitle: "Organizei a bancada", daysSinceLastCompletion: 1 }],
    });

    expect(reading?.kind).toBe("continue_goal");
    expect(reading?.text).toContain("Organizei a bancada");
    expect(reading?.text).toContain("ontem");
  });

  it("aponta objetivo sem definição de conclusão", () => {
    const reading = buildCheckinReading({
      todayEnergy: 6,
      todayMood: 6,
      previousEnergies: [6, 6, 6],
      goals: [{ title: "Organizar minhas finanças", totalActions: 0, completedActions: 0 }],
    });

    expect(reading?.kind).toBe("undefined_goal");
    expect(reading?.text).toContain("Organizar minhas finanças");
  });
});
