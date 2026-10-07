import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { setLanguage } from "../i18n";

const mocks = vi.hoisted(() => ({
  state: { email: "", name: "" },
  signIn: vi.fn(async () => ({ data: { session: null }, error: new Error("private-provider-detail") })),
}));
vi.mock("../features/aura/store", () => ({ useAuraStore: () => ({ state: mocks.state, setEmail: vi.fn(), setName: vi.fn() }) }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signInWithPassword: mocks.signIn,
} } }));
vi.mock("../features/referrals/capture", () => ({ capturePendingReferral() {}, claimPendingReferral: async () => {} }));
import { LoginPage } from "./login-page";

describe("login validation and disclosure", () => {
  it("uses Airia and associated labels, prevents empty provider calls and sanitizes unknown errors", async () => {
    const stored = new Map<string, string>();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    } });
    await setLanguage("en");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><LoginPage /></MemoryRouter>));
    expect(host.querySelector(".auth-hero-eyebrow")?.textContent).toBe("Airia");
    expect(host.querySelector('label[for="auth-email"]')).not.toBeNull();
    const password = host.querySelector("#auth-password") as HTMLInputElement;
    await act(async () => password.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Fill in the required fields");
    mocks.state.email = "qa@example.invalid";
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(password, "synthetic-password"); password.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => password.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("private-provider-detail");
    await act(async () => root.unmount());
    host.remove();
  });
});
