import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "objectives-workspace.css"), "utf8");

describe("objectives workspace split css", () => {
  it("keeps a height chain and independent pane overflow", () => {
    expect(css).toContain(".ow-root");
    expect(css).toContain("min-height: 0");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("grid-template-columns: minmax(280px, 40%) minmax(0, 1fr)");
  });

  it("does not hide note and path behind exclusive tabs", () => {
    expect(css).not.toContain("display: none");
    expect(css).toContain(".ow-pane--left");
    expect(css).toContain(".ow-pane--right");
  });
});
