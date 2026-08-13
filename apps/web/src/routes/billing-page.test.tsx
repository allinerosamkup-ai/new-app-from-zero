import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import BillingPage, { confirmCheckoutSession, storeCheckoutVerification } from "./billing-page";
import type { BillingAccessSummary } from "../hooks/useSubscription";

const freeSummary: BillingAccessSummary = {
  access: "free",
  source: "free",
  subscriptionStatus: null,
  provider: null,
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
    window.sessionStorage.clear();
    await setLanguage("pt");
  });

  it("stores the provider-neutral verification id before leaving checkout", async () => {
    const storage = { setItem: vi.fn() };
    storeCheckoutVerification("attempt-123", storage);
    expect(storage.setItem).toHaveBeenCalledWith("airia:billing:verification", "attempt-123");
  });

  it("uses the stored verification id after returning without trusting the URL", async () => {
    window.sessionStorage.setItem("airia:billing:verification", "attempt-stored");
    mocks.get.mockImplementation((path: string) => path === "/billing/status"
      ? Promise.resolve(freeSummary)
      : Promise.resolve({ confirmed: true, plan: "monthly", status: "paid" }));
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.get).toHaveBeenCalledWith("/billing/checkout-session/attempt-stored");
    expect(host.textContent).toContain("Pagamento confirmado");
    await act(async () => root.unmount());
  });

  it("requires two explicit steps to cancel a Cakto subscription", async () => {
    mocks.get.mockResolvedValue({ ...freeSummary, access: "pro", source: "paid", provider: "cakto", plan: "monthly" });
    mocks.post.mockResolvedValue({ canceled: true, periodEnd: "2026-09-13T00:00:00.000Z" });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    const first = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Cancelar renovação"));
    expect(first).toBeTruthy();
    await act(async () => { first?.click(); });
    expect(mocks.post).not.toHaveBeenCalled();
    const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Confirmar cancelamento"));
    await act(async () => { confirm?.click(); await Promise.resolve(); });
    expect(mocks.post).toHaveBeenCalledWith("/billing/cancel", { confirm: true });
    await act(async () => root.unmount());
  });

  it("does not offer cancellation for lifetime access", async () => {
    mocks.get.mockResolvedValue({ ...freeSummary, access: "pro", source: "paid", provider: "cakto", plan: "lifetime" });
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).not.toContain("Cancelar renovação");
    await act(async () => root.unmount());
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
      path === "/billing/status" ? Promise.resolve(freeSummary) : verification
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
    expect(get).toHaveBeenCalledWith("/billing/checkout-session/cs_pending");
    expect(result.confirmed).toBe(false);
  });

  it("does not duplicate the /api prefix already owned by the API client", () => {
    for (const file of [
      "src/hooks/useSubscription.ts",
      "src/routes/billing-page.tsx",
      "src/components/ProfessionalPartnerSection.tsx",
    ]) {
      const fileSource = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(fileSource, file).not.toMatch(/api\.(?:get|post|patch|put|delete)\(["']\/api\//);
    }
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

  it("reuses one checkout attempt key when a network retry is needed", async () => {
    mocks.get.mockResolvedValue(freeSummary);
    mocks.post.mockRejectedValue(new Error("offline"));
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    const checkout = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Escolher este plano"));
    expect(checkout).toBeTruthy();
    await act(async () => { checkout?.click(); });
    await act(async () => { checkout?.click(); });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    const firstAttempt = mocks.post.mock.calls[0][1]?.attemptKey;
    const secondAttempt = mocks.post.mock.calls[1][1]?.attemptKey;
    expect(firstAttempt).toMatch(/^[a-zA-Z0-9-]{8,100}$/);
    expect(secondAttempt).toBe(firstAttempt);
    await act(async () => root.unmount());
  });

  it("uses a new checkout attempt key after the selected plan changes", async () => {
    mocks.get.mockResolvedValue(freeSummary);
    mocks.post.mockRejectedValue(new Error("offline"));
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><BillingPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    const checkout = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Escolher este plano"));
    await act(async () => { checkout?.click(); });
    const annualAttempt = mocks.post.mock.calls[0][1]?.attemptKey;
    const monthly = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Mensal"));
    await act(async () => { monthly?.click(); });
    await act(async () => { checkout?.click(); });
    const monthlyAttempt = mocks.post.mock.calls[1][1]?.attemptKey;
    expect(monthlyAttempt).not.toBe(annualAttempt);
    await act(async () => root.unmount());
  });
});
