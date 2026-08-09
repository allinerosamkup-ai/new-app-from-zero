import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { resolveUnlockedNav } from "./nav-access.helpers";

describe("resolveUnlockedNav", () => {
  it("shows only essentials for a brand-new user", () => {
    // Objetivos entra no essencial: é o núcleo do app, e esperar check-in para
    // deixar a pessoa criar uma meta não faz sentido.
    const unlocked = resolveUnlockedNav({ checkinCount: 0, isNewUser: true });
    assert.deepEqual([...unlocked].sort(), ["aura", "goals", "home", "insights", "journal"]);
  });

  /**
   * Padrões não some mais no começo.
   *
   * Escondê-lo até o 3º check-in tinha intenção defensável — leitura de padrão
   * sem base é leitura falsa — e efeito ruim: uma aba do produto desaparecia
   * sem nada explicando, o que é indistinguível de defeito para quem usa.
   * `insights-page.tsx` já tem o estado vazio que faz esse trabalho direito,
   * dizendo quantos check-ins faltam e o que aparece em 3, 7 e 30 dias.
   */
  it("mostra Padrões desde o primeiro dia, mesmo sem nenhum check-in", () => {
    for (const checkinCount of [0, 1, 2, 3]) {
      const unlocked = resolveUnlockedNav({ checkinCount, isNewUser: true });
      assert.equal(unlocked.has("insights"), true, `insights sumiu com ${checkinCount} check-in(s)`);
    }
  });

  it("unlocks the planner after the first check-in", () => {
    assert.equal(resolveUnlockedNav({ checkinCount: 0, isNewUser: true }).has("planner"), false);
    assert.equal(resolveUnlockedNav({ checkinCount: 1, isNewUser: true }).has("planner"), true);
  });

  it("shows everything for an established user regardless of count", () => {
    // "planner" continua aqui de propósito: quem esconde é config/features.ts,
    // não este helper. Assim religar não exige mexer nas regras de destrave.
    const unlocked = resolveUnlockedNav({ checkinCount: 0, isNewUser: false });
    assert.deepEqual([...unlocked].sort(), ["aura", "goals", "home", "insights", "journal", "planner"]);
  });
});
