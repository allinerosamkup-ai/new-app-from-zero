import { describe, expect, it } from "vitest";

import { requiresMandatoryOnboarding } from "./onboarding-route-guard";

const NOW = new Date("2026-08-20T12:00:00.000Z").getTime();

describe("mandatory onboarding route guard", () => {
  it("sends a new account with pending onboarding to Pra começar", () => {
    expect(requiresMandatoryOnboarding({
      onboardingDone: false,
      accountCreatedAt: "2026-08-20T11:59:00.000Z",
    }, NOW)).toBe(true);
  });

  it("keeps a partially completed new account in Pra começar", () => {
    expect(requiresMandatoryOnboarding({
      onboardingDone: false,
      accountCreatedAt: "2026-08-16T12:00:00.000Z",
    }, NOW)).toBe(true);
  });

  it("never routes a confirmed account back through onboarding", () => {
    expect(requiresMandatoryOnboarding({
      onboardingDone: true,
      accountCreatedAt: "2026-08-20T11:59:00.000Z",
    }, NOW)).toBe(false);
  });

  it("fails closed when a pending account has no trustworthy creation date", () => {
    expect(requiresMandatoryOnboarding({
      onboardingDone: false,
      accountCreatedAt: null,
    }, NOW)).toBe(true);
  });
});
