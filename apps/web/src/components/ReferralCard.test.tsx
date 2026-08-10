import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { setLanguage } from "../i18n";
import { ReferralCard } from "./ReferralCard";

describe("ReferralCard", () => {
  it("keeps the customer share action separate and never fabricates a referral code", async () => {
    await setLanguage("pt");
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<ReferralCard />));
    expect(host.textContent).toContain("Compartilhar a Airia");
    expect(host.textContent).toContain("Programa para psicólogas");
    expect(host.textContent).not.toContain("AIRIA-");
    expect(host.textContent).not.toContain("comissão");
    await act(async () => root.unmount());
  });
});
