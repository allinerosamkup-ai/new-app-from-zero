import { describe, expect, it } from "vitest";

import { buildMirror, buildOutlook, buildReckoning, type StoryAnswers } from "./reading";

function answers(overrides: Partial<StoryAnswers> = {}): StoryAnswers {
  return {
    name: "Alline",
    feeling: null,
    blockers: [],
    openFronts: null,
    drains: [],
    restorers: [],
    listPreference: null,
    ...overrides,
  };
}

describe("buildReckoning — a conta", () => {
  it("não inventa leitura quando ela não respondeu nada", () => {
    expect(buildReckoning(answers())).toBeNull();
  });

  it("usa o número que ela deu, sem arredondar nem inflar", () => {
    const r = buildReckoning(answers({ blockers: ["prioritize"], openFronts: 7 }))!;

    expect(r.headline).toContain("7 frentes abertas");
    expect(r.turn).toContain("7 decisões por dia");
    expect(r.evidence).toContain("7 frentes abertas");
  });

  it("tira o peso de cima dela e coloca no mecanismo", () => {
    const r = buildReckoning(answers({ blockers: ["start"], openFronts: 6 }))!;

    expect(r.headline).toMatch(/não é falta de vontade/i);
    expect(r.turn).toMatch(/não é você/i);
  });

  it("nunca produz rótulo clínico", () => {
    const casos: StoryAnswers[] = [
      answers({ blockers: ["start", "prioritize"], openFronts: 9 }),
      answers({ blockers: ["finish"], openFronts: 2 }),
      answers({ blockers: ["consistency"], openFronts: 0 }),
      answers({ openFronts: 8 }),
      answers({ blockers: ["remember"] }),
    ];

    const proibido = /tdah|bipolar|depress|transtorno|diagn[oó]stico|ansiedade|d[eé]ficit/i;
    for (const caso of casos) {
      const r = buildReckoning(caso);
      if (!r) continue;
      expect(`${r.headline} ${r.turn} ${r.evidence}`).not.toMatch(proibido);
    }
  });

  it("nunca acusa a pessoa de desperdício", () => {
    const r = buildReckoning(answers({ blockers: ["start", "prioritize"], openFronts: 7 }))!;
    expect(`${r.headline} ${r.turn}`).not.toMatch(/desperdi|perde tempo|preguiç|culpa/i);
  });

  it("funciona só com as frentes, sem nenhum bloqueio marcado", () => {
    const r = buildReckoning(answers({ openFronts: 6 }))!;
    expect(r.headline).toContain("6 frentes");
  });
});

describe("buildMirror — o espelho", () => {
  it("só devolve linhas que vieram de resposta dela", () => {
    const linhas = buildMirror(answers({
      feeling: "Cansada",
      blockers: ["start"],
      restorers: ["Ar livre"],
    }));

    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain("cansada");
    expect(linhas[1]).toContain("começar");
    expect(linhas[2]).toContain("ar livre");
  });

  it("sem resposta nenhuma, não inventa retrato", () => {
    expect(buildMirror(answers())).toEqual([]);
  });

  it("junta vários itens em linguagem natural", () => {
    const linhas = buildMirror(answers({ blockers: ["start", "prioritize", "finish"] }));
    expect(linhas[0]).toBe("O que trava primeiro é começar, decidir o que fazer antes e terminar.");
  });
});

describe("buildOutlook — onde está e onde chega", () => {
  it("promete presença e ritmo, nunca resultado garantido", () => {
    const o = buildOutlook(answers({ blockers: ["start"], openFronts: 5 }), "Deixar a sala pronta para uso");

    expect(o.now).toContain("5 frentes abertas");
    expect(o.ahead).toContain("Deixar a sala pronta para uso");
    expect(o.ahead).not.toMatch(/garanti|você vai conseguir|resolvido|cura/i);
  });

  it("sem objetivo, fala do que a Airia aprende", () => {
    const o = buildOutlook(answers({ openFronts: 3 }), null);
    expect(o.ahead).toContain("ritmo");
  });
});
