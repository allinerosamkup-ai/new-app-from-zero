import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiriaLogoBg, AuraIcon } from "./AuraIcon";

describe("AuraIcon brand mark", () => {
  it("renders the mascot asset instead of the old circle cluster", () => {
    const html = renderToStaticMarkup(<AuraIcon size={32} />);
    expect(html).toContain("/mascot/phases/airia-orbital-stable@640.webp");
    expect(html).not.toContain("#F4A896");
    expect(html).not.toContain("<circle");
  });

  it("keeps the watermark on the same being", () => {
    const html = renderToStaticMarkup(<AiriaLogoBg size={200} opacity={0.05} />);
    expect(html).toContain("/mascot/phases/airia-orbital-stable@640.webp");
    expect(html).toContain("opacity:0.05");
  });
});
