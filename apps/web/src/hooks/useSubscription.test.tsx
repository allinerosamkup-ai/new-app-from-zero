import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api", () => ({ api: { get: mocks.get } }));

import { useSubscription, type BillingAccessSummary } from "./useSubscription";

const base: BillingAccessSummary = {
  access: "free",
  source: "free",
  subscriptionStatus: null,
  plan: null,
  periodEnd: null,
  trialEndsAt: null,
  daysRemaining: 0,
  checkoutAvailable: true,
  offers: [],
};

function Probe() {
  const state = useSubscription();
  return (
    <div
      data-pro={String(state.isPro)}
      data-source={state.source}
      data-plan={state.plan ?? "none"}
      data-error={state.error ?? "none"}
      data-loading={String(state.loading)}
    />
  );
}

async function renderSummary(summary: BillingAccessSummary) {
  mocks.get.mockResolvedValue(summary);
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); });
  return { host, root };
}

describe("useSubscription", () => {
  beforeEach(() => mocks.get.mockReset());

  it.each([
    ["trial", { access: "pro", source: "trial", daysRemaining: 5 }],
    ["professional", { access: "pro", source: "professional" }],
    ["paid monthly", { access: "pro", source: "paid", plan: "monthly", subscriptionStatus: "active" }],
    ["paid annual", { access: "pro", source: "paid", plan: "annual", subscriptionStatus: "active" }],
    ["paid lifetime", { access: "pro", source: "paid", plan: "lifetime", subscriptionStatus: "active" }],
  ])("trusts server access for %s", async (_label, override) => {
    const { host, root } = await renderSummary({ ...base, ...override } as BillingAccessSummary);
    expect(host.firstElementChild?.getAttribute("data-pro")).toBe("true");
    await act(async () => root.unmount());
  });

  it.each(["past_due", "canceled", "incomplete", "unpaid", "paused"])(
    "does not infer Pro from subscription status %s",
    async (subscriptionStatus) => {
      const { host, root } = await renderSummary({ ...base, subscriptionStatus });
      expect(host.firstElementChild?.getAttribute("data-pro")).toBe("false");
      await act(async () => root.unmount());
    },
  );

  it("keeps a visible error state when status cannot be loaded", async () => {
    mocks.get.mockResolvedValue(null);
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); });
    await act(async () => { await Promise.resolve(); });
    expect(host.firstElementChild?.getAttribute("data-pro")).toBe("false");
    expect(host.firstElementChild?.getAttribute("data-error")).toBe("status_unavailable");
    await act(async () => root.unmount());
  });
});
