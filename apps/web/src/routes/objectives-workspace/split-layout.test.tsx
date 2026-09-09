import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SplitLayout } from "./split-layout";

describe("objectives split layout", () => {
  it("renders both panes at the same time", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <SplitLayout
          wide
          leftLabel="left"
          rightLabel="right"
          left={<p>path</p>}
          right={<p>notes</p>}
        />,
      );
    });
    expect(host.querySelector('[data-layout="wide"]')).toBeTruthy();
    expect(host.querySelector(".ow-pane--left")?.textContent).toContain("path");
    expect(host.querySelector(".ow-pane--right")?.textContent).toContain("notes");
    await act(async () => root.unmount());
  });
});
