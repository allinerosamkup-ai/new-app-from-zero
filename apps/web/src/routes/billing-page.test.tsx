import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  track: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: null } })),
}));
vi.mock("../lib/api", () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock("../lib/track", () => ({ trackEvent: mocks.track }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));

import { setLanguage } from "../i18n";
import BillingPage, { confirmCheckoutSession } from "./billing-page";
import type { BillingAccessSummary } from "../hooks/useSubscription";

const freeSummary: BillingAccessSummary = {
  access: "free",
  source: "free",
  subscriptionStatus: null,
  plan: null,
  periodEnd: null,
  trialEndsAt: null,
  daysRemaining: 0,
  checkoutAvailable: true,
  offers: [
    { plan: "monthly", amountCents: 2990, currency: "BRL", billingPeriod: "month", enabled: true },
    { plan: "annual", amountCents: 24900, currency: "BRL", billingPeriod: "year", enabled: true },
    { plan: "lifetime", amountCents: 9900, currency: "BRL", billingPeriod: "once", enabled: true },
  ],
};

describe("BillingPage", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.track.mockReset();
    window.history.replaceState({}, "", "/billing");
    await setLanguage("pt");
  });

  it("shows all three enabled offers with the server amounts", async () => {
    mocks.get.mockResolvedValue(freeSummary);
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).toContain("R$ 29,90");
    expect(host.textContent).toContain("R$ 249,00");
    expect(host.textContent).toContain("R$ 99,00");
    expect(host.textContent).toContain("Oferta vitalícia");
    expect(host.textContent).toContain("Continuar gratuitamente");
    await act(async () => root.unmount());
  });

  it("keeps checkout pending until server verification confirms ownership and payment", async () => {
    window.history.replaceState({}, "", "/billing?session_id=cs_paid");
    let resolveVerification!: (value: any) => void;
    const verification = new Promise((resolve) => { resolveVerification = resolve; });
    mocks.get.mockImplementation((path: string) => (
      path === "/api/billing/status" ? Promise.resolve(freeSummary) : verification
    ));
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).toContain("Confirmando seu pagamento");
    expect(host.textContent).not.toContain("Pagamento confirmado");
    await act(async () => resolveVerification({ confirmed: true, plan: "lifetime", status: "paid" }));
    expect(host.textContent).toContain("Pagamento confirmado");
    expect(mocks.track).toHaveBeenCalledWith("subscription_started", { plan: "lifetime" });
    await act(async () => root.unmount());
  });

  it("bounds verification retries and returns pending", async () => {
    const get = vi.fn(async () => ({ confirmed: false, plan: "annual", status: "open" }));
    const result = await confirmCheckoutSession("cs_pending", { get, delay: async () => undefined, attempts: 3 });
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.confirmed).toBe(false);
  });

  it("shows retry and free continuation when billing status fails", async () => {
    mocks.get.mockRejectedValue(new Error("offline"));
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).toContain("Tentar novamente");
    expect(host.textContent).toContain("Continuar gratuitamente");
    await act(async () => root.unmount());
  });
});
