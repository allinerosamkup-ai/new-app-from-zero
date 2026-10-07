import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLanguage } from "../i18n";

import {
  OnboardingCompletionOffer,
  completeStoryOnboarding,
  finalizeStoryOnboarding,
  persistStoryGoals,
  persistStoryProfile,
  type BillingAccessSummary,
} from "./story-onboarding-page";
import { STORY_STEPS } from "../features/story-onboarding/steps";

const trial14: BillingAccessSummary = {
  access: "pro",
  source: "trial",
  subscriptionStatus: null,
  provider: null,
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

  it("keeps the active onboarding focused on core calibration and first goal", () => {
    expect(STORY_STEPS).toEqual([
      "welcome",
      "name",
      "traits",
      "feeling",
      "goal",
      "understanding",
      "nextAction",
      "building",
      "offer",
    ]);
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


describe("story goal persistence", () => {
  it.each(["/onboarding/operational-profile", "/onboarding/profile-traits"])("never completes after %s fails", async (endpoint) => {
    const complete = vi.fn(async () => trial14);
    const post = vi.fn(async (path: string) => {
      if (path === endpoint) throw new Error("save_failed");
      return { profile: {}, saved: true };
    });
    await expect(finalizeStoryOnboarding({ persist: () => persistStoryProfile({ operational: {}, traits: { biologicalSex: null }, post }), complete, refresh: async () => {} })).rejects.toThrow("save_failed");
    expect(complete).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed profile responses and preserves optional answers", async () => {
    await expect(persistStoryProfile({ operational: {}, traits: {}, post: async () => null })).rejects.toThrow("onboarding_profile_unconfirmed");
    const post = vi.fn(async (_endpoint: string, _body: unknown) => ({ profile: {}, saved: true }));
    const traits = { biologicalSex: null, medicationCurrentlyUsing: null, priorDiagnoses: [] };
    await persistStoryProfile({ operational: {}, traits, post });
    expect(post.mock.calls[1]).toEqual(["/onboarding/profile-traits", traits]);
  });
  it("shows partial save failure honestly and keeps retry available in both languages", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const onEnter = vi.fn();
    const onRetry = vi.fn();
    for (const language of ["pt", "en"] as const) {
      await setLanguage(language);
      await act(async () => root.render(<OnboardingCompletionOffer billing={null} error="onboarding_save_failed" retrying={false} onRetry={onRetry} onEnter={onEnter} onPlans={vi.fn()} />));
      expect(host.textContent).toContain(language === "pt" ? "Ainda não consegui salvar tudo desta etapa" : "I could not save everything in this step yet");
      expect(host.textContent).not.toContain(language === "pt" ? "Seu caminho está salvo" : "Your path is saved");
      const enter = host.querySelector(".story-cta") as HTMLButtonElement;
      expect(enter.disabled).toBe(true);
      enter.click();
      const retry = [...host.querySelectorAll("button")].find(button => button.textContent?.includes(language === "pt" ? "Tentar novamente" : "Try again"));
      expect(retry?.disabled).toBe(false);
      retry?.click();
    }
    expect(onEnter).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });

  it("writes strict subgoals without order and preserves selected sequence", async () => {
    const confirmed = new Set<string>();
    const post = vi.fn(async (_endpoint: string, _body: unknown) => ({ id: "new-goal" }));
    await persistStoryGoals({ plans: [{ title: "New goal", steps: ["First", "Second"], resultDefinition: null }], confirmed, post });
    const body = post.mock.calls[0][1] as any;
    expect(body.subgoals.map((item: any) => item.title)).toEqual(["First", "Second"]);
    expect(body.subgoals.every((item: any) => !("order" in item))).toBe(true);
    expect(confirmed.has("New goal")).toBe(true);
  });
  it("stops completion after a failed goal and retries only unconfirmed goals", async () => {
    const confirmed = new Set<string>();
    let fail = true;
    const writes: string[] = [];
    const post = async (_endpoint: string, body: any) => {
      writes.push(body.title);
      if (body.title === "Second" && fail) throw new Error("400");
      return { id: body.title };
    };
    const plans = ["First", "Second"].map(title => ({ title, steps: [], resultDefinition: null }));
    const complete = vi.fn(async () => trial14);
    await expect(finalizeStoryOnboarding({ persist: () => persistStoryGoals({ plans, confirmed, post }), complete, refresh: async () => {} })).rejects.toThrow("400");
    expect(complete).not.toHaveBeenCalled();
    fail = false;
    await persistStoryGoals({ plans, confirmed, post });
    expect(writes).toEqual(["First", "Second", "Second"]);
  });
});
