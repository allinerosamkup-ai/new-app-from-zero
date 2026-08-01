import { describe, expect, it } from "vitest";
import { getReleaseNavigationUrl } from "./release-update";

describe("getReleaseNavigationUrl", () => {
  it("does not navigate a client that is already on the current release", () => {
    expect(
      getReleaseNavigationUrl(
        "https://airia.pro/home?__airia_release=release-2",
        "release-2",
      ),
    ).toBeNull();
  });

  it("adds the current release to an unidentified client", () => {
    expect(
      getReleaseNavigationUrl("https://airia.pro/home", "release-2"),
    ).toBe("https://airia.pro/home?__airia_release=release-2");
  });

  it("replaces an older release while preserving route, query and hash", () => {
    expect(
      getReleaseNavigationUrl(
        "https://airia.pro/aura?source=pwa&__airia_release=release-1#message",
        "release-2",
      ),
    ).toBe(
      "https://airia.pro/aura?source=pwa&__airia_release=release-2#message",
    );
  });

  it("disables forced navigation when the build id is empty", () => {
    expect(
      getReleaseNavigationUrl("https://airia.pro/home?source=pwa", "  "),
    ).toBeNull();
  });
});
