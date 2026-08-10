import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLanguage } from "../i18n";

import {
  OnboardingCompletionOffer,
  completeStoryOnboarding,
  finalizeStoryOnboarding,
  type BillingAccessSummary,
} from "./story-onboarding-page";

const trial14: BillingAccessSummary = {
  access: "pro",
  source: "trial",
  subscriptionStatus: null,
  plan: null,
  periodEnd: null,
  trialEndsAt: "2026-08-24T12:00:00.000Z",
  daysRemaining: 14,
  checkoutAvailable: true,
};

describe("story onboarding completion", () => {
  beforeEach(async () => {
    await setLanguage("pt");
  });

  it("completes only after core persistence and refreshes the store afterward", async () => {
    const calls: string[] = [];
    const result = await finalizeStoryOnboarding({
      persist: async () => { calls.push("persist"); },
      complete: async () => { calls.push("complete"); return trial14; },
      refresh: async () => { calls.push("refresh"); },
    });

    expect(calls).toEqual(["persist", "complete", "refresh"]);
    expect(result.daysRemaining).toBe(14);
  });

  it("calls the authenticated completion endpoint and tracks Pro only after confirmation", async () => {
    const post = vi.fn(async () => ({ saved: true, billing: trial14 }));
    const track = vi.fn();

    const result = await completeStoryOnboarding({ post, track });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/onboarding/complete", {});
    expect(result).toEqual(trial14);
    expect(track).toHaveBeenCalledWith("pro_trial_started", {
      days: 14,
      source: "trial",
      trialEndsAt: trial14.trialEndsAt,
    });
  });

  it("never tracks or pretends the trial started when completion fails", async () => {
    const track = vi.fn();
    await expect(completeStoryOnboarding({
      post: async () => ({ saved: false }),
      track,
    })).rejects.toThrow("onboarding_completion_unconfirmed");
    expect(track).not.toHaveBeenCalled();
  });

  it("shows server-confirmed days with enter as primary and plans as secondary", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onEnter = vi.fn();
    const onPlans = vi.fn();

    await act(async () => {
      root.render(
        <OnboardingCompletionOffer
          billing={trial14}
          error={null}
          retrying={false}
          onRetry={vi.fn()}
          onEnter={onEnter}
          onPlans={onPlans}
        />,
      );
    });

    expect(host.textContent).toContain("14 dias Pro");
    const buttons = [...host.querySelectorAll("button")];
    const enter = buttons.find((button) => button.textContent?.includes("Entrar na minha Airia"));
    const plans = buttons.find((button) => button.textContent?.includes("Ver planos"));
    expect(enter?.className).toContain("story-cta");
    enter?.click();
    plans?.click();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onPlans).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it("shows an honest retry state without trial copy after a failed completion", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onRetry = vi.fn();

    await act(async () => {
      root.render(
        <OnboardingCompletionOffer
          billing={null}
          error="completion_failed"
          retrying={false}
          onRetry={onRetry}
          onEnter={vi.fn()}
          onPlans={vi.fn()}
        />,
      );
    });

    expect(host.textContent).not.toContain("dias Pro");
    expect(host.textContent).toContain("Não consegui confirmar seu período Pro");
    const retry = [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Tentar novamente"));
    retry?.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
