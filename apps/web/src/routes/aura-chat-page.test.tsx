import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === "string" ? fallback : key,
      i18n: { language: "pt-BR" },
    }),
  };
});

vi.mock("../features/aura/store", () => ({
  useAuraStore: () => ({
    state: { checkinHistory: [] },
    refreshData: vi.fn(),
  }),
}));

vi.mock("../components/Toast", () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}));

import { AuraChatPage } from "./aura-chat-page";

describe("AuraChatPage", () => {
  it("opens the central chat before any action card exists", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/aura"]}>
        <AuraChatPage />
      </MemoryRouter>,
    );

    expect(html).toContain("Airia");
  });
});
