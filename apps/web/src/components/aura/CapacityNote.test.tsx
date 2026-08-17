import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../i18n")>();
  return { ...actual, useLocalizedCopy: () => (pt: string) => pt };
});

import { CapacityNote } from "./CapacityNote";
import type { AiriaCapacity } from "../../lib/airia-reading";

const capacity: AiriaCapacity = {
  level: "protecao",
  size: "quick",
  stepMinutes: 10,
  reason: "Deixei hoje no menor tamanho possível: sua energia está em 3 de 10 e você dormiu 5h.",
  basis: ["sua energia está em 3 de 10", "você dormiu 5h"],
  confidence: "alta",
  assumed: false,
  corrected: false,
};

function render(props: Parameters<typeof CapacityNote>[0]) {
  return renderToStaticMarkup(<CapacityNote {...props} />);
}

describe("CapacityNote", () => {
  it("mostra a conclusão da Airia com o número que a sustentou", () => {
    const html = render({ capacity, decisionId: "d1", surface: "home" });
    expect(html).toContain("sua energia está em 3 de 10");
    expect(html).toContain("você dormiu 5h");
  });

  /**
   * O ponto inteiro da mudança: a tela que perguntava "Hoje você lida melhor
   * com algo: Rápido / Moderado / Mais trabalhoso" saiu. Se este componente
   * reintroduzir a escolha por outra porta, o problema voltou com outra roupa.
   */
  it("não devolve a escolha da capacidade para a pessoa", () => {
    const html = render({ capacity, decisionId: "d1", surface: "home" });
    for (const forbidden of ["Rápido", "Moderado", "Mais trabalhoso", "lida melhor", "Escolha", "Selecione"]) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toContain("<fieldset");
    expect(html).not.toContain('type="radio"');
    expect(html).toContain("você não precisou escolher");
  });

  it("oferece correção em dois toques, sem campo de texto", () => {
    const html = render({ capacity, decisionId: "d1", surface: "checkin_result" });
    expect(html).toContain("Coube menos que isso");
    expect(html).toContain("Coube mais que isso");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<select");
  });

  it("não mostra correção sem decisão para corrigir", () => {
    const html = render({ capacity, decisionId: null, surface: "home" });
    expect(html).toContain("sua energia está em 3 de 10");
    expect(html).not.toContain("Coube menos que isso");
  });

  /**
   * Sem sinal não há conclusão, e frase genérica gasta exatamente a confiança
   * que esta caixa existe para construir. Silêncio é a resposta honesta.
   */
  it("some quando não houve sinal nenhum", () => {
    expect(render({ capacity: null, decisionId: "d1", surface: "home" })).toBe("");
    expect(render({ capacity: undefined, decisionId: "d1", surface: "home" })).toBe("");
    expect(render({
      capacity: { ...capacity, assumed: true, reason: "Ainda não tenho sinal de hoje." },
      decisionId: "d1",
      surface: "home",
    })).toBe("");
  });

  it("mantém alvo de toque confortável no mobile", () => {
    const html = render({ capacity, decisionId: "d1", surface: "home" });
    const heights = [...html.matchAll(/min-height:\s*(\d+)px/g)].map((match) => Number(match[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(40);
  });
});
