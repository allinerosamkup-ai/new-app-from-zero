import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  INITIAL_EMOTIONS_SELECTED,
  sliderRestingValue,
  toggleEmotionSelection,
} from "./checkin-page";

describe("checkin page emotion selection", () => {
  it("starts with no preselected emotion", () => {
    assert.deepEqual(INITIAL_EMOTIONS_SELECTED, []);
  });

  it("allows removing the last selected emotion", () => {
    assert.deepEqual(toggleEmotionSelection(["radiant"], "radiant"), []);
  });

  it("does not add more than three emotions", () => {
    assert.deepEqual(
      toggleEmotionSelection(["calm", "happy", "tired"], "focused"),
      ["calm", "happy", "tired"],
    );
  });
});

/**
 * O valor de repouso é o que um toque sozinho precisa conseguir confirmar.
 *
 * `onChange` de um `input[type=range]` só dispara quando o valor MUDA. Como o
 * polegar de um campo não respondido descansa no meio da escala, tocar
 * exatamente ali não produzia evento nenhum: a pessoa via o polegar no lugar
 * certo e o app gravava `null`. Numa escala de 1 a 10 esse ponto cego é o 6.
 * A tela resolve confirmando o valor exibido no `pointerup` enquanto o campo
 * estiver vazio; este teste guarda o número que a regra depende.
 */
describe("valor de repouso do slider", () => {
  it("é o meio da escala, arredondado para cima", () => {
    assert.equal(sliderRestingValue(1, 10), 6);
    assert.equal(sliderRestingValue(3, 12), 8);
  });

  it("não sai da faixa em escalas curtas", () => {
    const value = sliderRestingValue(1, 3);
    assert.ok(value >= 1 && value <= 3);
  });
});
