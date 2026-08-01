/**
 * Canonical offline check-in queue. Every queued item contains the same payload
 * sent to POST /checkins; legacy partial records are quarantined, never synced.
 */

import type { CheckinSubmission } from "../features/aura/checkin-submission";

const STORE_KEY = "airia_offline_checkins";
const LEGACY_STORE_KEY = "airia_offline_checkins_legacy";

type OfflineCheckinItem = {
  version: 2;
  id: string;
  idempotencyKey: string;
  payload: CheckinSubmission;
  queuedAt: number;
};

export type QueuedCheckinReceipt = {
  status: "queued";
  idempotencyKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalPayload(value: unknown): value is CheckinSubmission {
  if (!isRecord(value)) return false;
  const validScore = (score: unknown) => typeof score === "number"
    && Number.isInteger(score)
    && score >= 1
    && score <= 10;
  const validStringArray = (items: unknown) => items === undefined
    || (Array.isArray(items) && items.every((item) => typeof item === "string"));
  return typeof value.localDate === "string"
    && typeof value.checkinSlot === "string"
    && typeof value.idempotencyKey === "string"
    && value.idempotencyKey === `screen:${value.localDate}:${value.checkinSlot}`
    && value.source === "screen"
    && validScore(value.moodScore)
    && validScore(value.energyScore)
    && validStringArray(value.factors)
    && validStringArray(value.emotions);
}

function isOfflineCheckinItem(value: unknown): value is OfflineCheckinItem {
  return isRecord(value)
    && value.version === 2
    && typeof value.id === "string"
    && typeof value.idempotencyKey === "string"
    && typeof value.queuedAt === "number"
    && isCanonicalPayload(value.payload)
    && value.idempotencyKey === value.payload.idempotencyKey;
}

function quarantineLegacy(items: unknown[]): void {
  if (items.length === 0) return;
  let previous: unknown[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || "[]");
    if (Array.isArray(parsed)) previous = parsed;
  } catch {
    // A corrupted quarantine can be replaced; it is never submitted.
  }
  localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify([...previous, ...items]));
}

function deduplicate(items: OfflineCheckinItem[]): OfflineCheckinItem[] {
  const byIdempotency = new Map<string, OfflineCheckinItem>();
  items.forEach((item) => byIdempotency.set(item.idempotencyKey, item));
  return [...byIdempotency.values()];
}

function readQueue(): OfflineCheckinItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) {
    quarantineLegacy([parsed]);
    localStorage.setItem(STORE_KEY, "[]");
    return [];
  }

  const canonical = deduplicate(parsed.filter(isOfflineCheckinItem));
  const legacy = parsed.filter((item) => !isOfflineCheckinItem(item));
  if (legacy.length > 0 || canonical.length !== parsed.length) {
    quarantineLegacy(legacy);
    localStorage.setItem(STORE_KEY, JSON.stringify(canonical));
  }
  return canonical;
}

function writeQueue(queue: OfflineCheckinItem[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(deduplicate(queue)));
}

export function queueCheckin(payload: CheckinSubmission): QueuedCheckinReceipt {
  if (!isCanonicalPayload(payload)) throw new Error("Payload canônico de check-in inválido.");
  const queue = readQueue();
  const existing = queue.find((item) => item.idempotencyKey === payload.idempotencyKey);
  const next: OfflineCheckinItem = {
    version: 2,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    idempotencyKey: payload.idempotencyKey,
    payload,
    queuedAt: existing?.queuedAt ?? Date.now(),
  };
  writeQueue([...queue.filter((item) => item.idempotencyKey !== payload.idempotencyKey), next]);
  return { status: "queued", idempotencyKey: payload.idempotencyKey };
}

export function getPendingCount(): number {
  return readQueue().length;
}

let syncInFlight: Promise<number> | null = null;

export function syncPendingCheckins(
  submitFn: (payload: CheckinSubmission) => Promise<void>,
): Promise<number> {
  if (syncInFlight) return syncInFlight;
  if (!navigator.onLine) return Promise.resolve(0);

  syncInFlight = (async () => {
    const queue = readQueue();
    if (queue.length === 0) return 0;

    const successfulIds = new Set<string>();
    for (const item of queue) {
      try {
        await submitFn(item.payload);
        successfulIds.add(item.id);
      } catch {
        // Keep the complete payload for a later retry.
      }
    }

    const latestQueue = readQueue();
    writeQueue(latestQueue.filter((item) => !successfulIds.has(item.id)));
    return successfulIds.size;
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export function registerOfflineSync(
  submitFn: (payload: CheckinSubmission) => Promise<void>,
): () => void {
  const handleOnline = () => {
    void syncPendingCheckins(submitFn).then((count) => {
      if (count > 0) console.log(`[offline-sync] ${count} check-in(s) sincronizados.`);
    });
  };
  window.addEventListener("online", handleOnline);
  handleOnline();
  return () => window.removeEventListener("online", handleOnline);
}
