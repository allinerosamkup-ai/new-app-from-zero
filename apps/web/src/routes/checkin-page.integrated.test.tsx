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
    state: { checkinHistory: [], cycleStart: null, cycleLength: null, lutealLength: null },
    setMood: vi.fn(),
    addCheckin: vi.fn(),
  }),
}));

vi.mock("../i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../i18n")>();
  return {
    ...actual,
    resolveIntlLocale: () => "pt-BR",
    useLocalizedCopy: () => (pt: string) => pt,
  };
});

import { CheckinPage } from "./checkin-page";

describe("CheckinPage integrated flow", () => {
  it("renders one contextual scroll with every section and one final registration action", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/checkin"]}>
        <CheckinPage />
      </MemoryRouter>,
    );

    expect(html).toContain('data-testid="checkin-contextual-flow"');
    expect(html).toContain('data-section="voice-emotion"');
    expect(html).toContain('data-section="mood-energy"');
    expect(html).toContain('data-section="influences"');
    expect(html).toContain('data-section="optional-context"');
    expect(html).toContain("Não identifiquei um fator agora");
    expect(html).toContain("Registrar");
    expect(html).not.toContain("Adicionar contexto");
    expect(html).not.toContain("checkin.stepOf");
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain('for="checkin-note"');
    expect(html).toContain('id="checkin-note"');
    expect(html).toContain('aria-live="polite"');
  });
});
