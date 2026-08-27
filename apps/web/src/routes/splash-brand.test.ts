import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "./splash-page.tsx"), "utf8");

describe("splash brand mark", () => {
  it("uses the orbital AuraIcon instead of the circle cluster", () => {
    expect(source).toContain("from \"../components/AuraIcon\"");
    expect(source).toContain("return <AuraIcon size={size} />");
    expect(source).not.toContain("#F4A896");
    expect(source).not.toContain("<circle");
  });
});
