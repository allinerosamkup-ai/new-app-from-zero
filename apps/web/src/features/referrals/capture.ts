import { api } from "../../lib/api";

export const PENDING_REFERRAL_KEY = "airia.pendingProfessionalReferral";
const REFERRAL_PATTERN = /^AIRIA-[A-Z0-9]{6,20}$/;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Post = (path: string, body: unknown) => Promise<unknown>;

export function capturePendingReferral(
  search = typeof window === "undefined" ? "" : window.location.search,
  storage: StorageLike = window.localStorage,
): string | null {
  const code = new URLSearchParams(search).get("ref")?.trim().toUpperCase() ?? "";
  if (!REFERRAL_PATTERN.test(code)) return null;
  storage.setItem(PENDING_REFERRAL_KEY, code);
  return code;
}

let claimInFlight: Promise<boolean> | null = null;

export function claimPendingReferral(dependencies: {
  post?: Post;
  storage?: StorageLike;
} = {}): Promise<boolean> {
  if (claimInFlight) return claimInFlight;
  const storage = dependencies.storage ?? window.localStorage;
  const code = storage.getItem(PENDING_REFERRAL_KEY);
  if (!code || !REFERRAL_PATTERN.test(code)) return Promise.resolve(false);
  const post = dependencies.post ?? ((path, body) => api.post(path, body));

  claimInFlight = (async () => {
    try {
      await post("/referrals/claim", { code });
      return true;
    } catch {
      // Referral attribution must never block authentication or onboarding.
      return false;
    } finally {
      storage.removeItem(PENDING_REFERRAL_KEY);
      claimInFlight = null;
    }
  })();
  return claimInFlight;
}
