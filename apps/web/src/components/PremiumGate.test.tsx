import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ subscription: {} as any }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => mocks.subscription }));

import { setLanguage } from "../i18n";
import { PremiumGate } from "./PremiumGate";

function LocationProbe() {
  return <output data-path={useLocation().pathname} />;
}

describe("PremiumGate", () => {
  beforeEach(async () => {
    await setLanguage("pt");
    mocks.subscription = { isPro: false, loading: false, error: null };
  });

  it("renders Pro content directly when access is confirmed by the server", async () => {
    mocks.subscription = { isPro: true, loading: false, error: null };
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(
      <MemoryRouter><PremiumGate><div>Meu trabalho</div></PremiumGate></MemoryRouter>,
    ));
    expect(host.textContent).toContain("Meu trabalho");
    expect(host.textContent).not.toContain("Conhecer o Pro");
    await act(async () => root.unmount());
  });

  it("can be dismissed without navigating or losing work", async () => {
    const onDismiss = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(
      <MemoryRouter initialEntries={["/planner"]}>
        <PremiumGate blurBehind onDismiss={onDismiss}>
          <input defaultValue="rascunho preservado" />
        </PremiumGate>
        <LocationProbe />
      </MemoryRouter>,
    ));
    const dismiss = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Continuar gratuitamente"));
    expect(dismiss).toBeTruthy();
    dismiss?.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(host.querySelector("input")?.value).toBe("rascunho preservado");
    expect(host.querySelector("output")?.getAttribute("data-path")).toBe("/planner");
    await act(async () => root.unmount());
  });
});
