import { describe, expect, it, vi } from "vitest";

import {
  PENDING_REFERRAL_KEY,
  capturePendingReferral,
  claimPendingReferral,
} from "./capture";

function storageFixture() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("professional referral capture", () => {
  it("captures a normalized professional code before authentication", () => {
    const storage = storageFixture();
    expect(capturePendingReferral("?ref=airia-ab12cd", storage)).toBe("AIRIA-AB12CD");
    expect(storage.values.get(PENDING_REFERRAL_KEY)).toBe("AIRIA-AB12CD");
  });

  it("ignores malformed codes", () => {
    const storage = storageFixture();
    expect(capturePendingReferral("?ref=user-hash", storage)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("claims after authentication, removes the pending code, and never throws on failure", async () => {
    const storage = storageFixture();
    storage.setItem(PENDING_REFERRAL_KEY, "AIRIA-AB12CD");
    const post = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(claimPendingReferral({ post, storage })).resolves.toBe(false);
    expect(post).toHaveBeenCalledWith("/referrals/claim", { code: "AIRIA-AB12CD" });
    expect(storage.getItem(PENDING_REFERRAL_KEY)).toBeNull();
  });
});
