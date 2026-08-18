import { describe, expect, it, jest } from "@jest/globals";

import { AIService } from "../../services/ai_service";
import { useJournalStore } from "./journal_store";

describe("useJournalStore", () => {
  it("abre uma sessão e consolida uma resposta transmitida pela Airia", async () => {
    useJournalStore.setState({
      sessionId: null,
      userId: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      context: null,
      error: null,
    });
    jest.spyOn(AIService, "startJournalSession").mockResolvedValue({
      sessionId: "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11",
      created: true,
      messages: [],
      context: {
        promptSummary: "Rotina percebida: Costuma render melhor no fim da manhã.",
        topThemes: ["trabalho"],
        topPlannerCategories: ["trabalho"],
        checkinToday: { moodScore: 3, energyScore: 2, stateLabel: "Dia sensível" },
      },
    });
    jest.spyOn(AIService, "streamJournalMessage").mockImplementation(async ({ onEvent }) => {
      onEvent({ event: "assistant.delta", data: { chunk: "Olá, " } });
      onEvent({
        event: "assistant.completed",
        data: {
          sessionId: "7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11",
          message: {
            id: "msg-assistant",
            role: "assistant",
            content: "Olá, estou com você.",
            createdAt: new Date("2026-03-13T12:00:05.000Z").toISOString(),
          },
        },
      });
    });

    await useJournalStore.getState().startSession("550e8400-e29b-41d4-a716-446655440000");
    await useJournalStore.getState().sendMessage("Hoje eu estou travada.");

    const state = useJournalStore.getState();
    expect(state.sessionId).toBe("7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11");
    expect(state.context?.checkinToday?.stateLabel).toBe("Dia sensível");
    expect(state.messages).toEqual([
      expect.objectContaining({ role: "user", content: "Hoje eu estou travada." }),
      expect.objectContaining({ role: "assistant", content: "Olá, estou com você." }),
    ]);
    expect(state.isStreaming).toBe(false);
  });
});
