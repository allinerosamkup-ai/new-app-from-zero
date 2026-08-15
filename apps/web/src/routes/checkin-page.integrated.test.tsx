import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    expect(html).not.toContain('data-choice-group="capacity"');
    expect(html).not.toContain('data-choice-group="priority-goal"');
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
    expect(html).toContain('data-choice-group="menstrual-status"');
    expect(html).toContain('data-choice-group="medication-status"');
    expect(html).toContain('data-choice-group="hyperfocus-status"');
    expect(html).toContain('data-choice-group="day-type"');
  });

  it("keeps conditional flow controls semantically grouped and never navigates a queued receipt", () => {
    const source = readFileSync(resolve(process.cwd(), "src/routes/checkin-page.tsx"), "utf8");

    expect(source).toContain('data-choice-group="flow-day"');
    expect(source).toContain('data-choice-group="flow-intensity"');
    expect(source).toContain('section="airia-interpretation"');
    expect(source).toContain('A Airia cuida da próxima decisão');
    expect(source).not.toContain('Hoje você lida melhor com algo:');
    expect(source).not.toContain('O que mais precisa da sua atenção hoje?');
    expect(source).toMatch(/outcome\.status === "queued"[\s\S]{0,900}return;[\s\S]{0,180}finalizeContextualCheckin/);
  });
});
