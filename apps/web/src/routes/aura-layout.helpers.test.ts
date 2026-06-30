import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { resolveActiveBanner } from "./aura-layout.helpers";

describe("resolveActiveBanner", () => {
  it("prioritizes the phase alert over everything", () => {
    assert.equal(
      resolveActiveBanner({ hasPhaseAlert: true, showOnboarding: true, hasFollowUp: true }),
      "phase",
    );
  });

  it("shows onboarding when there is no phase alert", () => {
    assert.equal(
      resolveActiveBanner({ hasPhaseAlert: false, showOnboarding: true, hasFollowUp: true }),
      "onboarding",
    );
  });

  it("shows the follow-up only when nothing higher is active", () => {
    assert.equal(
      resolveActiveBanner({ hasPhaseAlert: false, showOnboarding: false, hasFollowUp: true }),
      "followup",
    );
  });

  it("returns null when no banner should show", () => {
    assert.equal(
      resolveActiveBanner({ hasPhaseAlert: false, showOnboarding: false, hasFollowUp: false }),
      null,
    );
  });
});
