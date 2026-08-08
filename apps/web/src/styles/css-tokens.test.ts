import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A checagem de token indefinido que o CLAUDE.md manda rodar.
 *
 * Ela era pedida e não existia — e a ausência custou caro. O bloco de tokens
 * documentava `--nectarine (#D7897F)` como acento, token que nunca esteve no
 * CSS. Um `var()` que não resolve **invalida a declaração inteira**: não quebra
 * build, não quebra tipo, não aparece no console. O texto do botão herdava a cor
 * do pai e sumia no fundo claro, e o "Criar objetivo" ficava branco no branco.
 * Parecia botão sem título e botão desaparecido; era token fantasma.
 *
 * Este teste fecha essa porta. Todo `var(--x)` usado no app precisa ter `--x`
 * declarado em algum CSS ou vir com fallback — e escrevendo isto eu mesma
 * inventei um `--accent-primary-soft` que não existia, então a rede pega até
 * quem sabe da regra.
 */

const SRC = path.resolve(import.meta.dirname, "..");

/** Tokens que o navegador ou bibliotecas definem, não o app. */
const EXTERNOS = new Set([
  "--swiper-navigation-color",
  "--swiper-pagination-color",
]);

/**
 * Só o CSS que chega ao navegador conta.
 *
 * `styles/main.css` e `index.css` existem no repositório mas ninguém importa —
 * são folhas órfãs de versões anteriores. Varrer arquivo morto produz alarme
 * sobre código que não pinta pixel nenhum, e alarme falso é o que faz uma
 * checagem ser ignorada. Se um dia alguém importar main.css, ele entra aqui e
 * os fantasmas dele aparecem no mesmo instante.
 */
function cssCarregado(): string[] {
  const importados = new Set<string>();
  for (const arquivo of arquivos(SRC, [".ts", ".tsx", ".css"])) {
    const conteudo = fs.readFileSync(arquivo, "utf8");
    for (const match of conteudo.matchAll(/(?:import\s+|@import\s+)["']([^"']+\.css)["']/g)) {
      importados.add(path.resolve(path.dirname(arquivo), match[1]));
    }
  }
  return [...importados].filter((arquivo) => fs.existsSync(arquivo));
}

function arquivos(dir: string, extensoes: string[], encontrados: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === "dist") continue;
      arquivos(completo, extensoes, encontrados);
    } else if (extensoes.some((ext) => entrada.name.endsWith(ext))) {
      encontrados.push(completo);
    }
  }
  return encontrados;
}

/**
 * Tokens declarados, em qualquer lugar onde declarar é possível.
 *
 * Não é só o CSS: um token definido inline no elemento — `style={{ "--i": 2 }}`
 * ou `setProperty("--bar-h", ...)` — existe de verdade em tempo de execução e
 * seria falso positivo se contasse como fantasma.
 */
function declarados(): Set<string> {
  const nomes = new Set<string>();

  for (const arquivo of cssCarregado()) {
    const conteudo = fs.readFileSync(arquivo, "utf8");
    for (const match of conteudo.matchAll(/(--[\w-]+)\s*:/g)) nomes.add(match[1]);
  }

  for (const arquivo of arquivos(SRC, [".ts", ".tsx"])) {
    const conteudo = fs.readFileSync(arquivo, "utf8");
    // style={{ "--x": ... }} e setProperty("--x", ...)
    for (const match of conteudo.matchAll(/["'`](--[\w-]+)["'`]\s*[:,]/g)) nomes.add(match[1]);
    for (const match of conteudo.matchAll(/setProperty\(\s*["'`](--[\w-]+)["'`]/g)) nomes.add(match[1]);
  }

  return nomes;
}

/** Usos sem fallback: `var(--x)` puro. Com fallback é seguro por definição. */
function usadosSemFallback(): Map<string, string[]> {
  const usos = new Map<string, string[]>();
  const alvos = [...cssCarregado(), ...arquivos(SRC, [".ts", ".tsx"])];
  for (const arquivo of alvos) {
    if (arquivo.endsWith("css-tokens.test.ts")) continue;
    const relativo = path.relative(SRC, arquivo).replaceAll("\\", "/");
    const conteudo = fs.readFileSync(arquivo, "utf8");
    conteudo.split("\n").forEach((linha, indice) => {
      // `var(--x)` sem vírgula antes do fecha-parênteses.
      for (const match of linha.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
        const token = match[1];
        if (EXTERNOS.has(token)) continue;
        const lista = usos.get(token) ?? [];
        lista.push(`${relativo}:${indice + 1}`);
        usos.set(token, lista);
      }
    });
  }
  return usos;
}

describe("tokens CSS", () => {
  it("todo var(--x) sem fallback aponta para um token que existe", () => {
    const existentes = declarados();
    const fantasmas: string[] = [];

    for (const [token, ocorrencias] of usadosSemFallback()) {
      if (!existentes.has(token)) {
        fantasmas.push(`${token} — usado em ${ocorrencias.slice(0, 3).join(", ")}${ocorrencias.length > 3 ? ` (+${ocorrencias.length - 3})` : ""}`);
      }
    }

    expect(fantasmas.sort()).toEqual([]);
  }, 20_000);

  it("os tokens canônicos da identidade verde existem", () => {
    const existentes = declarados();
    for (const token of ["--accent-primary", "--accent-primary-strong", "--accent-primary-ink", "--accent-primary-a3"]) {
      expect(existentes.has(token), `${token} precisa existir`).toBe(true);
    }
  });

  /**
   * Cor de acento escrita à mão escapa de toda varredura de token.
   *
   * Foi assim que o `.home-header` ficou salmão depois da virada verde: o
   * gradiente tinha `rgba(247,207,196,.58)` cravado, e trocar os tokens não
   * tocou nele. Nenhum teste podia ter pego — não havia token envolvido.
   *
   * O alvo é estreito de propósito: salmão e rosa pastel, a família que saiu do
   * app. Fica de fora, por decisão registrada no CLAUDE.md, tudo que não é
   * acento — vermelho de erro (R baixo demais), amarelo de aviso (azul muito
   * distante do verde), marrom de texto (claro demais para o corte) e as cores
   * de marca do Google.
   */
  it("não há salmão nem rosa cravado no CSS carregado", () => {
    const cravadas: string[] = [];

    for (const arquivo of cssCarregado()) {
      const relativo = path.relative(SRC, arquivo).replaceAll("\\", "/");
      const conteudo = fs.readFileSync(arquivo, "utf8");

      conteudo.split("\n").forEach((linha, indice) => {
        for (const match of linha.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
          const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
          // Claro e quente (salmão/rosa), com azul perto do verde — o que separa
          // essa família do amarelo, onde o azul despenca.
          if (r >= 200 && g >= 130 && r - g >= 25 && g - b <= 45) {
            cravadas.push(`${relativo}:${indice + 1} — rgb(${r},${g},${b})`);
          }
        }
      });
    }

    expect(cravadas).toEqual([]);
  }, 20_000);

  it("os apelidos de compatibilidade continuam apontando para o verde, nunca para rosa", () => {
    const aura = fs.readFileSync(path.join(SRC, "styles/aura.css"), "utf8");
    // Os alias existem para não quebrar código antigo. Se algum voltar a receber
    // valor literal, é rosa reentrando pela porta de trás.
    for (const alias of ["--accent-peach", "--accent-peach-ink", "--nectarine"]) {
      const declaracao = aura.match(new RegExp(`${alias}\\s*:\\s*([^;]+);`));
      expect(declaracao, `${alias} precisa estar declarado em aura.css`).toBeTruthy();
      expect(declaracao![1]).toMatch(/var\(--accent-primary/);
    }
  });
});
