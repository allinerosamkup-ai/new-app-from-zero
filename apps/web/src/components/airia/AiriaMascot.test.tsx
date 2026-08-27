import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

import { AiriaMascot, resolveAiriaMascotVisual } from "./AiriaMascot";

const EXPECTED_PHASES = [
  ["elevated", "airia-orbital-high-flight", "Voo Alto"],
  ["flowing", "airia-orbital-flowing", "Fluindo"],
  ["falling", "airia-orbital-slowing-down", "Desacelerando"],
  ["low", "airia-orbital-withdrawal", "Recolhimento"],
  ["depleted", "airia-orbital-pause", "Pausa"],
  ["recovering", "airia-orbital-resuming", "Retomada"],
  ["mixed", "airia-orbital-turbulence", "Turbulência"],
] as const;

const WEB_ROOT = resolve(import.meta.dirname, "../../..");
const PUBLIC_DIR = resolve(WEB_ROOT, "public");

describe("AiriaMascot", () => {
  it.each(EXPECTED_PHASES)("maps %s to its approved visual and accessible label", (phase, file, label) => {
    const visual = resolveAiriaMascotVisual(phase);
    const html = renderToStaticMarkup(<AiriaMascot phase={phase} />);

    expect(visual.src).toContain(`${file}.webp`);
    expect(html).toContain(`data-phase="${phase}"`);
    expect(html).toContain(`${file}.webp`);
    expect(html).toContain(`alt="Airia — fase ${label}"`);
  });

  it("uses a valid stable visual while there is not enough data", () => {
    const visual = resolveAiriaMascotVisual("insufficient_data");
    const html = renderToStaticMarkup(<AiriaMascot phase="insufficient_data" />);

    expect(visual.src).toContain("airia-orbital-stable@640.webp");
    expect(html).toContain('data-phase="insufficient_data"');
    expect(html).toContain('alt="Airia — conhecendo seu ritmo"');
  });

  it.each(EXPECTED_PHASES)("%s aponta para arquivos que existem, em 1x e 2x", (phase) => {
    const { src, srcRetina } = resolveAiriaMascotVisual(phase);
    for (const asset of [src, srcRetina]) {
      expect(() => statSync(resolve(PUBLIC_DIR, asset.replace(/^\//, ""))), `${asset} precisa existir`).not.toThrow();
    }
  });

  it("stable aponta para o @640 existente", () => {
    const { src, srcRetina } = resolveAiriaMascotVisual("stable");
    for (const asset of [src, srcRetina]) {
      expect(() => statSync(resolve(PUBLIC_DIR, asset.replace(/^\//, ""))), `${asset} precisa existir`).not.toThrow();
    }
  });

  it("nenhum asset do mascote passa de 120 KB", () => {
    const phases = ["elevated", "flowing", "stable", "falling", "low", "depleted", "recovering", "mixed"] as const;
    for (const phase of phases) {
      const { src, srcRetina } = resolveAiriaMascotVisual(phase);
      for (const asset of [src, srcRetina]) {
        const bytes = statSync(resolve(PUBLIC_DIR, asset.replace(/^\//, ""))).size;
        expect(bytes, `${asset} tem ${(bytes / 1024).toFixed(0)} KB`).toBeLessThan(120 * 1024);
      }
    }
  });

  it("carrega sob demanda e serve retina", () => {
    const html = renderToStaticMarkup(<AiriaMascot phase="flowing" />);

    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain("@640.webp 2x");
  });

  it("some da leitura de tela quando a fase já está escrita ao lado", () => {
    const html = renderToStaticMarkup(<AiriaMascot phase="low" decorative />);

    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
  });

  it("provides a reduced-motion fallback", () => {
    const css = readFileSync(resolve(import.meta.dirname, "airia-mascot.css"), "utf8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/\.airia-mascot__image[\s\S]*animation:\s*none/);
  });
});
