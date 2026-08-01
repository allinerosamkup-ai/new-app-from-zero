import { describe, expect, it } from "vitest";

import { hydrateCheckinEntry } from "./checkin-hydration";

describe("persisted check-in hydration", () => {
  it("keeps every reported context signal without replacing missing values", () => {
    const entry = hydrateCheckinEntry({
      localDate: "2026-08-01T00:00:00.000Z",
      recordedAt: "2026-08-01T11:20:00.000Z",
      checkinSlot: "morning",
      moodScore: 3,
      energyScore: 7,
      clarityScore: null,
      irritabilityScore: 8,
      physicalScore: null,
      socialScore: 4,
      sleepScore: null,
      sleepHours: 5.5,
      factors: ["slept_little", "work_pressure"],
      emotions: ["angry"],
      note: "Acordei cansada e estou sob pressão.",
      signalMetadata: { irritability: { provenance: "reported", confidence: 1, evidence: ["screen:irritability"] } },
      isFlowing: true,
      flowDay: 2,
      flowIntensity: "intenso",
      symptomColica: 2,
      symptomDorCabeca: 1,
      medicationTakenToday: true,
      focusScore: 4,
      hyperfocusOccurred: false,
      mixedEpisodeNote: null,
      dayType: "down",
    });

    expect(entry).toMatchObject({
      date: "2026-08-01",
      humor: 3,
      energia: 7,
      irritabilidade: 8,
      social: 4,
      sleepHours: 5.5,
      factors: ["slept_little", "work_pressure"],
      emotions: ["angry"],
      isFlowing: true,
      flowDay: 2,
      flowIntensity: "intenso",
      symptomLevels: { colica: 2, dorCabeca: 1 },
      medicationTakenToday: true,
      focusScore: 4,
      hyperfocusOccurred: false,
      dayType: "down",
    });
    expect(entry.clareza).toBeUndefined();
    expect(entry.fisico).toBeUndefined();
    expect(entry.sono).toBeUndefined();
    expect(entry.signalMetadata).toEqual({
      irritability: { provenance: "reported", confidence: 1, evidence: ["screen:irritability"] },
    });
  });
});
