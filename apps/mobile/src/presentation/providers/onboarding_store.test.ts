import { describe, expect, it, jest } from "@jest/globals";

jest.mock("./auth_store", () => ({
  useAuthStore: {
    getState: () => ({ refresh: jest.fn<() => Promise<void>>() }),
  },
}));

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import api from "../../services/api_service";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "./auth_store";
import { ONBOARDING_QUESTIONS, useOnboardingStore } from "./onboarding_store";

describe("useOnboardingStore", () => {
  it("persiste a narrativa inicial e conclui o onboarding após as respostas essenciais", async () => {
    const refresh = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    jest.spyOn(useAuthStore, "getState").mockReturnValue({
      refresh,
    } as unknown as ReturnType<typeof useAuthStore.getState>);
    jest.spyOn(api, "post").mockResolvedValue({
      data: {
        profileSummary: "Você está começando o app com vontade de reorganizar a rotina com mais gentileza.",
        routineSummaryNormalized: "Acorda às 07:00, dorme às 23:00 e sente mais peso no fim da tarde.",
        initialStateSummary: "Chega cansada e buscando mais estabilidade para os próximos dias.",
        topThemes: ["sono", "rotina", "trabalho"],
        initialSuggestions: ["Comece com blocos leves nas primeiras horas."],
      },
    });
    const fromMock = supabase.from as unknown as jest.MockedFunction<typeof supabase.from>;
    fromMock.mockReturnValue({
      upsert: async () => ({ data: null, error: null }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    } as never);

    useOnboardingStore.getState().reset();
    expect(ONBOARDING_QUESTIONS).toHaveLength(8);

    [
      "Ana",
      "33",
      "Estou cansada e sobrecarregada.",
      "Tenho dormido mal nos últimos dias.",
      { wakeTime: "07:00", sleepTime: "23:00" },
      "Trabalho o dia todo e no fim da tarde fico esgotada.",
      "Excesso de demandas e pouco descanso.",
      "Quero organizar melhor minha energia.",
    ].forEach((answer) => useOnboardingStore.getState().submitAnswer(answer));
    useOnboardingStore.getState().toggleSupportGoal("routine");
    useOnboardingStore.getState().setConsent("healthData", true);
    useOnboardingStore.getState().setConsent("aiProcessing", true);

    await useOnboardingStore.getState().completeOnboarding("550e8400-e29b-41d4-a716-446655440000");
    expect(useOnboardingStore.getState().stage).toBe("summary");
    expect(useOnboardingStore.getState().aiProfile?.profileSummary).toMatch(/reorganizar a rotina/i);

    await useOnboardingStore.getState().finalizeOnboarding();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
