import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const constellation = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../components/AiriaConstellationLogo.tsx"),
  "utf8",
);

describe("splash brand mark", () => {
  it("keeps the constellation wrapper on the AuraIcon ball", () => {
    expect(constellation).toContain("from \"./AuraIcon\"");
    expect(constellation).toContain("return <AuraIcon size={size} />");
    expect(constellation).not.toContain("#F4A896");
    expect(constellation).not.toContain("<circle");
  });
});
