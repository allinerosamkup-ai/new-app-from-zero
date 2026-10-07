import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import i18n, { getCurrentLanguage, setLanguage } from "../i18n";

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
// This test covers login guards, not the i18next React provider. In workspace CI,
// its hoisted React dependency may differ from the renderer's React instance.
// Keep real translations while avoiding a second hook dispatcher in this unit.
vi.mock("react-i18next", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-i18next")>(),
  useTranslation: () => ({ t: i18n.t.bind(i18n), i18n }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18n.t(i18nKey),
}));
import { LoginPage } from "./login-page";

describe("login validation and disclosure", () => {
  it.each(["en", "pt"] as const)("uses Airia and associated labels, prevents empty provider calls and sanitizes unknown errors (%s)", async (language) => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalLanguage = getCurrentLanguage();
    mocks.state.email = "";
    mocks.state.name = "";
    mocks.signIn.mockClear();
    const stored = new Map<string, string>();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
    await setLanguage(language);
    await act(async () => root.render(<MemoryRouter><LoginPage /></MemoryRouter>));
    expect(host.querySelector(".auth-hero-eyebrow")?.textContent).toBe("Airia");
    expect(host.querySelector('label[for="auth-email"]')).not.toBeNull();
    const password = host.querySelector("#auth-password") as HTMLInputElement;
    await act(async () => password.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(host.textContent).toContain(language === "en" ? "Fill in the required fields" : "Preencha os campos obrigatórios");
    mocks.state.email = "qa@example.invalid";
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(password, "synthetic-password"); password.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => password.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    const errorAlert = host.querySelector('[role="alert"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent?.trim()).toBe(i18n.t("auth.errors.generic"));
    expect(host.textContent).not.toContain("private-provider-detail");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      await setLanguage(originalLanguage);
      if (storageDescriptor) Object.defineProperty(window, "localStorage", storageDescriptor);
      else Reflect.deleteProperty(window, "localStorage");
      mocks.state.email = "";
      mocks.state.name = "";
      mocks.signIn.mockClear();
    }
  });
});
