import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";

import {
  BIOLOGICAL_SEX_OPTIONS,
  buildOnboardingProcessPayload,
  createEmptyOnboardingDraft,
  tracksMenstrualCycle,
} from "./onboarding";

describe("gate do ciclo menstrual", () => {
  it("só rastreia ciclo para quem respondeu feminino", () => {
    assert.equal(tracksMenstrualCycle("female"), true);
    assert.equal(tracksMenstrualCycle("male"), false);
  });

  it("mantém a pergunta binária", () => {
    // O campo liga uma função biológica, não descreve identidade. Uma terceira
    // opção não responderia se o ciclo deve ser rastreado.
    assert.deepEqual(BIOLOGICAL_SEX_OPTIONS.map((option) => option.value), ["female", "male"]);
  });

  it("mantém o bloco visível enquanto ninguém respondeu", () => {
    // Quem já usava o app não pode perder o campo por causa de uma pergunta
    // que nunca viu. Só uma resposta explícita esconde.
    assert.equal(tracksMenstrualCycle(null), true);
    assert.equal(tracksMenstrualCycle(undefined), true);
  });

  it("não envia dados de ciclo de quem não rastreia", () => {
    const draft = createEmptyOnboardingDraft();
    // O draft nasce com 28/14 preenchidos. Sem o corte, esse ciclo default
    // seria gravado para alguém que nunca viu a pergunta.
    assert.ok(draft.cycleLength > 0, "pré-condição: o draft carrega ciclo default");

    const male = buildOnboardingProcessPayload({ ...draft, biologicalSex: "male", cycleStart: "2026-07-01" });
    assert.equal(male.cycleStart, null);
    assert.equal(male.cycleLength, null);
    assert.equal(male.lutealLength, null);
    assert.equal(male.biologicalSex, "male");

    const female = buildOnboardingProcessPayload({ ...draft, biologicalSex: "female", cycleStart: "2026-07-01" });
    assert.equal(female.cycleStart, "2026-07-01");
    assert.equal(female.cycleLength, draft.cycleLength);
    assert.equal(female.biologicalSex, "female");
  });

  it("mantém front e backend com os mesmos valores aceitos", () => {
    // As duas listas são declaradas separadamente (o front não importa do
    // backend). Se uma mudar sem a outra, o zod do backend rejeita o payload
    // em produção — e isso só apareceria com a usuária travada no onboarding.
    const contractPath = path.resolve(
      import.meta.dirname,
      "../../../../backend/src/contracts/onboarding.contract.ts",
    );
    const contractSource = fs.readFileSync(contractPath, "utf8");
    const declared = contractSource
      .match(/BIOLOGICAL_SEX_VALUES = \[([^\]]*)\]/s)?.[1]
      .match(/'([a-z_]+)'/g)
      ?.map((value) => value.replaceAll("'", ""));

    assert.ok(declared, "não achei BIOLOGICAL_SEX_VALUES no contrato do backend");
    assert.deepEqual(
      BIOLOGICAL_SEX_OPTIONS.map((option) => option.value).slice().sort(),
      declared.slice().sort(),
    );
  });
});
