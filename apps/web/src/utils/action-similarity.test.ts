import { describe, expect, it } from "vitest";

import {
  actionSimilarity,
  dedupeActions,
  findEquivalentAction,
  isSameAction,
} from "./action-similarity";

describe("actionSimilarity", () => {
  it("reconhece a mesma ação escrita de formas diferentes", () => {
    // O caso que motiva tudo: comparar texto exato deixaria as duas entrarem.
    expect(isSameAction("Ligar para a médica", "ligar pra médica")).toBe(true);
    expect(isSameAction("Comprar leite", "comprar o leite hoje")).toBe(true);
    expect(isSameAction("Organizar a mesa", "Organizar mesa agora")).toBe(true);
  });

  it("aceita variação de verbo com mesma intenção", () => {
    expect(isSameAction("Marcar consulta", "Agendar consulta")).toBe(true);
    expect(isSameAction("Mandar o relatório", "Enviar relatório")).toBe(true);
  });

  it("não cola ações diferentes que compartilham o verbo", () => {
    // Este é o erro caro: agrupar demais faz a pessoa perder ação de verdade.
    expect(isSameAction("Organizar a mesa", "Organizar as contas")).toBe(false);
    expect(isSameAction("Ligar para a médica", "Ligar para o banco")).toBe(false);
    expect(isSameAction("Comprar leite", "Comprar passagem")).toBe(false);
  });

  it("devolve 0 quando não há palavra significativa em comum", () => {
    expect(actionSimilarity("Caminhar 20 minutos", "Responder e-mail")).toBe(0);
  });

  it("trata texto vazio sem quebrar", () => {
    expect(actionSimilarity("", "qualquer coisa")).toBe(0);
    expect(actionSimilarity("de a o para", "com sem por")).toBe(0);
  });
});

describe("findEquivalentAction", () => {
  const inbox = [
    { id: "1", titulo: "Ligar para a médica" },
    { id: "2", titulo: "Revisar o anúncio do Olx" },
  ];
  const textOf = (item: { titulo: string }) => item.titulo;

  it("encontra o item equivalente já registrado", () => {
    const found = findEquivalentAction("ligar pra médica", inbox, textOf);
    expect(found?.id).toBe("1");
  });

  it("devolve nulo quando a ação é nova", () => {
    expect(findEquivalentAction("Caminhar no parque", inbox, textOf)).toBeNull();
  });

  it("escolhe o candidato com maior sobreposição", () => {
    // Jaccard penaliza palavra extra: quem diz o mesmo com menos ruído pontua
    // mais alto que quem diz o mesmo com um monte de qualificador junto.
    const lista = [
      { id: "curto", titulo: "Revisar anúncio" },
      { id: "longo", titulo: "Revisar o anúncio do Olx com foto nova e preço" },
    ];
    const found = findEquivalentAction("Revisar o anúncio do Olx", lista, textOf);

    expect(found?.id).toBe("curto");
    expect(actionSimilarity("Revisar o anúncio do Olx", "Revisar anúncio"))
      .toBeGreaterThan(actionSimilarity("Revisar o anúncio do Olx", "Revisar o anúncio do Olx com foto nova e preço"));
  });
});

describe("dedupeActions", () => {
  it("mantém o primeiro de cada grupo equivalente", () => {
    const items = [
      { titulo: "Ligar para a médica" },
      { titulo: "ligar pra médica" },
      { titulo: "Comprar leite" },
      { titulo: "comprar o leite" },
      { titulo: "Caminhar 20 minutos" },
    ];
    const result = dedupeActions(items, (item) => item.titulo);

    expect(result.map((item) => item.titulo)).toEqual([
      "Ligar para a médica",
      "Comprar leite",
      "Caminhar 20 minutos",
    ]);
  });

  it("não remove nada quando tudo é distinto", () => {
    const items = [{ titulo: "Pagar conta de luz" }, { titulo: "Estudar inglês" }];
    expect(dedupeActions(items, (item) => item.titulo)).toHaveLength(2);
  });
});
