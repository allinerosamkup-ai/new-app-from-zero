import { describe, expect, it } from "vitest";
import { canShowContextualDecision, localizeAiriaCapacityReason, localizeAiriaPhase, localizeVisibleConcreteAction, type AiriaReadingEnvelope } from "./airia-reading";

function reading(overrides: Partial<AiriaReadingEnvelope> = {}): AiriaReadingEnvelope {
  return {
    version: "v1",
    generatedAt: "2026-08-19T01:00:00.000Z",
    currentState: {},
    period: { observedDays: 3, confidence: 0.6 },
    alerts: [],
    capacity: {
      level: "baixa",
      size: "quick",
      stepMinutes: 10,
      reason: "Você relatou pouco sono e energia baixa neste registro.",
      basis: ["sono", "energia"],
      confidence: "media",
      assumed: false,
      corrected: false,
    },
    decision: {
      id: "decision-1",
      status: "proposed",
      title: "Abra o banco. Pronto quando: as três contas estiverem anotadas.",
      reason: "Ação vinculada ao objetivo.",
      objectiveId: "objective-1",
      actionId: "action-1",
      requiresConfirmation: true,
    },
    ...overrides,
  };
}

describe("canShowContextualDecision", () => {
  it("não repete uma proposta operacional dentro do Diário", () => {
    expect(canShowContextualDecision(reading(), "journal")).toBe(false);
  });

  it("mostra no resultado do Check-in somente uma ação concreta com contexto suficiente", () => {
    expect(canShowContextualDecision(reading(), "checkin_result")).toBe(true);
  });

  it("oculta a proposta enquanto a leitura ainda não tem base ou motivo contextual", () => {
    expect(canShowContextualDecision(reading({ period: { observedDays: 1, confidence: 0.2 } }), "checkin_result")).toBe(false);
    expect(canShowContextualDecision(reading({ capacity: null }), "checkin_result")).toBe(false);
  });
});

describe("localização de apresentação da leitura", () => {
  const english = (_pt: string, en: string) => en;

  it("traduz o estado e o conector de término sem traduzir a ação específica", () => {
    expect(localizeAiriaPhase("ritmo mais baixo", english)).toBe("lower pace");
    expect(
      localizeVisibleConcreteAction("Open the banking app. Pronto quando: the app is visible.", english),
    ).toBe("Open the banking app. Done when: the app is visible.");
  });

  it("apresenta uma razão de capacidade em inglês a partir de dados estruturados", () => {
    const protectedCapacity = { level: "protecao" as const, size: "quick" as const, stepMinutes: 5, reason: "Hoje a prioridade é apoio, não tarefa. Deixei qualquer avanço de lado.", basis: [], confidence: "alta" as const, assumed: false, corrected: false };
    const protectiveLowEnergy = { level: "protecao" as const, size: "quick" as const, stepMinutes: 5, reason: "Deixei hoje no menor tamanho possível: sua energia está em 3 de 10.", basis: [], confidence: "alta" as const, assumed: false, corrected: false };
    const lowCapacity = { level: "baixa" as const, size: "quick" as const, stepMinutes: 10, reason: "qualquer", basis: [], confidence: "alta" as const, assumed: false, corrected: false };

    expect(localizeAiriaCapacityReason(protectedCapacity, 3, english)).toBe("Today, support—not a task—is the priority.");
    expect(localizeAiriaCapacityReason(protectiveLowEnergy, 3, english)).toBe("I kept today's scope as small as possible: your energy is 3 out of 10.");
    expect(localizeAiriaCapacityReason(lowCapacity, 3, english)).toBe("I reduced today's scope: your energy is 3 out of 10.");
  });
});
