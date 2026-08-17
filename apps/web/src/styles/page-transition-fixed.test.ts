import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A trava da barra de navegação inferior.
 *
 * `.page-transition` embrulha **todas** as rotas (`App.tsx`: `<div
 * key={location.pathname} className="page-transition">` em volta de `<Routes>`),
 * e a barra inferior é descendente dele pela cadeia `.page-transition` →
 * `Routes` → `AuraLayout` → `.airia-bottom-nav`.
 *
 * Elemento com `transform` diferente de `none` vira **containing block de todo
 * `position: fixed` descendente**. Com `animation-fill-mode: both`, o
 * `translateY(0)` do último keyframe fica aplicado para sempre — e
 * `translateY(0)` continua sendo um transform. Resultado medido em 375x812 com
 * `scrollY` em 0: a barra ancorava no fim do container e o rodapé dela caía
 * **977px abaixo do fim da viewport**. Ela só aparecia para quem rolasse a
 * página inteira até o fim.
 *
 * Nada disso quebra build, tipo ou console: a barra simplesmente some. Por isso
 * a rede é aqui. Ela não protege só a barra — vale para qualquer `position:
 * fixed` renderizado dentro de uma página (folha, modal, toast).
 */

const AURA_CSS = path.resolve(import.meta.dirname, "aura.css");
const GLOBALS_CSS = path.resolve(import.meta.dirname, "globals.css");

/**
 * Propriedades que criam containing block para descendente `fixed`.
 *
 * Não é só `transform`: as propriedades individuais (`translate`, `rotate`,
 * `scale`), `perspective`, `filter`/`backdrop-filter` com valor real,
 * `will-change` anunciando qualquer uma delas e `contain` com `paint`/`layout`
 * produzem exatamente o mesmo efeito. Trocar `transform` por `translate` seria
 * reescrever o bug com outro nome.
 */
const CRIAM_CONTAINING_BLOCK = [
  "transform",
  "translate",
  "rotate",
  "scale",
  "perspective",
  "filter",
  "backdrop-filter",
  "will-change",
  "contain",
] as const;

/** Lê um bloco `{...}` equilibrando chaves — `@keyframes` tem blocos aninhados. */
function blocoApos(css: string, indiceDaAbertura: number): string {
  let profundidade = 0;
  for (let i = indiceDaAbertura; i < css.length; i += 1) {
    if (css[i] === "{") profundidade += 1;
    if (css[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return css.slice(indiceDaAbertura + 1, i);
    }
  }
  throw new Error("bloco CSS sem fechamento");
}

/** Extrai o corpo de uma regra pelo seletor exato, ignorando comentários. */
function corpoDaRegra(css: string, seletor: string): string {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const regex = new RegExp(`(^|[},])\\s*${seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m");
  const match = regex.exec(semComentarios);
  if (!match) throw new Error(`regra "${seletor}" não encontrada`);
  return blocoApos(semComentarios, semComentarios.indexOf("{", match.index));
}

/** Só declarações reais: `prop: valor`. Ignora seletores e percentuais. */
function declaracoes(bloco: string): { propriedade: string; valor: string }[] {
  return bloco
    .split(";")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .flatMap((linha) => {
      const separador = linha.indexOf(":");
      if (separador === -1) return [];
      const propriedade = linha.slice(0, separador).trim().toLowerCase();
      if (!/^-?[a-z][a-z0-9-]*$/.test(propriedade)) return [];
      return [{ propriedade, valor: linha.slice(separador + 1).trim().toLowerCase() }];
    });
}

/** `transform: none` é inofensivo — é o reset. Qualquer outro valor não é. */
function ehNeutra(propriedade: string, valor: string): boolean {
  const limpo = valor.replace(/\s*!important\s*$/, "").trim();
  if (limpo === "none" || limpo === "" || limpo === "initial" || limpo === "unset") return true;
  if (propriedade === "will-change") return limpo === "auto" || limpo === "opacity";
  if (propriedade === "contain") return !/paint|layout|strict|content/.test(limpo);
  if (propriedade === "scale" || propriedade === "rotate") return limpo === "1" || limpo === "0deg";
  if (propriedade === "translate") return /^0(px|%)?( 0(px|%)?)*$/.test(limpo);
  return false;
}

function ofensoras(bloco: string): string[] {
  return declaracoes(bloco)
    .filter(({ propriedade, valor }) =>
      (CRIAM_CONTAINING_BLOCK as readonly string[]).includes(propriedade) && !ehNeutra(propriedade, valor))
    .map(({ propriedade, valor }) => `${propriedade}: ${valor}`);
}

describe(".page-transition não pode virar containing block de position:fixed", () => {
  const aura = fs.readFileSync(AURA_CSS, "utf8");

  it("a própria regra .page-transition não declara transform (nem parente dele)", () => {
    expect(ofensoras(corpoDaRegra(aura, ".page-transition"))).toEqual([]);
  });

  it("nenhum keyframe de page-enter aplica transform — com fill-mode both, o último persiste", () => {
    const corpo = corpoDaRegra(aura.replace(/\/\*[\s\S]*?\*\//g, ""), "@keyframes page-enter");
    // Cada `from`/`to`/`NN%` tem seu próprio bloco; achata todos.
    const passos = [...corpo.matchAll(/\{/g)].map((m) => blocoApos(corpo, m.index!));
    const encontradas = passos.flatMap(ofensoras);
    expect(encontradas).toEqual([]);
  });

  it("a animação de entrada continua existindo — o conserto não é remover o movimento", () => {
    const decls = declaracoes(corpoDaRegra(aura, ".page-transition"));
    const animacao = decls.find((d) => d.propriedade === "animation" || d.propriedade === "animation-name");
    expect(animacao?.valor).toMatch(/page-enter/);
    // A entrada é por opacidade: sem isso, `animation: page-enter` seria um no-op.
    const keyframes = corpoDaRegra(aura.replace(/\/\*[\s\S]*?\*\//g, ""), "@keyframes page-enter");
    expect(keyframes).toMatch(/opacity/);
  });

  it("prefers-reduced-motion continua zerando a animação da .page-transition", () => {
    const globals = fs.readFileSync(GLOBALS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const inicio = globals.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(inicio).toBeGreaterThan(-1);
    const bloco = blocoApos(globals, globals.indexOf("{", inicio));
    expect(bloco).toMatch(/\.page-transition/);
    expect(bloco).toMatch(/animation:\s*none/);
  });
});
