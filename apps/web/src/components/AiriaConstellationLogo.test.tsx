import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AiriaConstellationLogo } from "./AiriaConstellationLogo";

describe("AiriaConstellationLogo", () => {
  it("renders the cream-ball mascot", () => {
    const html = renderToStaticMarkup(<AiriaConstellationLogo size={62} hybrid />);
    expect(html).toContain("/mascot/phases/airia-bolinha-stable.svg");
    expect(html).not.toContain("#F4A896");
    expect(html).not.toContain("<circle");
  });
});
