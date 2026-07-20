import { describe, expect, it } from "vitest";
import { resolveIntlLocale, selectLocalizedCopy } from "./index";
import pt from "./locales/pt.json";
import en from "./locales/en.json";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    leafKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("resolveIntlLocale", () => {
  it("uses a region-aware locale for each supported app language", () => {
    expect(resolveIntlLocale("pt")).toBe("pt-BR");
    expect(resolveIntlLocale("pt-BR")).toBe("pt-BR");
    expect(resolveIntlLocale("en")).toBe("en-US");
    expect(resolveIntlLocale("en-GB")).toBe("en-US");
  });
});

describe("translation catalog", () => {
  it("keeps Portuguese and English leaf keys in exact parity", () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(pt).sort());
  });
});

describe("localized long-form copy", () => {
  it("selects the active language without changing user content", () => {
    expect(selectLocalizedCopy("pt-BR", "Texto autoral", "Authored copy")).toBe("Texto autoral");
    expect(selectLocalizedCopy("en-US", "Texto autoral", "Authored copy")).toBe("Authored copy");
  });
});
