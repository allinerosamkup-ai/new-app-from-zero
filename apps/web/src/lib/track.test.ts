import { describe, expect, it } from "vitest";
import { ApiRequestError } from "./api";
import { shouldRetryProductEventError } from "./track";

describe("shouldRetryProductEventError", () => {
  it("retries only transient HTTP failures", () => {
    expect(shouldRetryProductEventError(new ApiRequestError(400, "invalid payload"))).toBe(false);
    expect(shouldRetryProductEventError(new ApiRequestError(401, "unauthorized"))).toBe(false);
    expect(shouldRetryProductEventError(new ApiRequestError(422, "invalid event"))).toBe(false);
    expect(shouldRetryProductEventError(new ApiRequestError(429, "rate limited"))).toBe(true);
    expect(shouldRetryProductEventError(new ApiRequestError(503, "unavailable"))).toBe(true);
  });

  it("retries network errors but not unclassified application errors", () => {
    expect(shouldRetryProductEventError(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryProductEventError(new Error("session expired"))).toBe(false);
  });
});
