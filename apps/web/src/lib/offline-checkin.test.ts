import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCheckinSubmission } from "../features/aura/checkin-submission";
import { getPendingCount, queueCheckin, syncPendingCheckins } from "./offline-checkin";

describe("canonical offline check-in queue", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("preserves the exact canonical payload, factors and optional context when syncing", async () => {
    const payload = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "evening",
      entry: {
        humor: 3,
        energia: 7,
        emotions: ["angry", "tired"],
        factors: ["work_pressure", "slept_little"],
        sono: 2,
        sleepHours: 5.5,
        fisico: 4,
        social: 2,
        isFlowing: true,
        flowDay: 2,
        flowIntensity: "intenso",
        symptomLevels: { colica: 3 },
        medicationTakenToday: true,
        focusScore: 4,
        hyperfocusOccurred: false,
        dayType: "mixed",
        mixedEpisodeNote: "Energia acelerada e humor baixo.",
        note: "Pressão real hoje.",
      },
    });
    const submitted: unknown[] = [];

    queueCheckin(payload);
    const synced = await syncPendingCheckins(async (queuedPayload) => {
      submitted.push(queuedPayload);
    });

    expect(synced).toBe(1);
    expect(submitted).toEqual([payload]);
    expect(getPendingCount()).toBe(0);
  });

  it("deduplicates retries by canonical idempotency key and keeps the latest full payload", async () => {
    const first = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "evening",
      entry: { humor: 3, energia: 7, factors: ["work_pressure"], note: "Primeira versão" },
    });
    const latest = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "evening",
      entry: { humor: 4, energia: 6, factors: ["work_pressure", "slept_little"], note: "Versão completa" },
    });
    const submit = vi.fn(async () => undefined);

    queueCheckin(first);
    queueCheckin(latest);

    expect(getPendingCount()).toBe(1);
    await syncPendingCheckins(submit);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(latest);
  });

  it("does not delete a newer retry queued while an older version is syncing", async () => {
    const first = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "evening",
      entry: { humor: 3, energia: 7, factors: ["work_pressure"], note: "Primeira versão" },
    });
    const latest = buildCheckinSubmission({
      localDate: "2026-08-01",
      checkinSlot: "evening",
      entry: { humor: 4, energia: 6, factors: ["work_pressure", "slept_little"], note: "Versão final" },
    });
    queueCheckin(first);

    await syncPendingCheckins(async () => {
      queueCheckin(latest);
    });

    expect(getPendingCount()).toBe(1);
    const submitLatest = vi.fn(async () => undefined);
    await syncPendingCheckins(submitLatest);
    expect(submitLatest).toHaveBeenCalledWith(latest);
  });

  it("quarantines legacy partial items instead of silently syncing incomplete context", async () => {
    localStorage.setItem("airia_offline_checkins", JSON.stringify([{
      id: "legacy-1",
      date: "2026-07-31",
      humor: 3,
      energia: 7,
      sono: 2,
      checkinSlot: "evening",
      queuedAt: 1,
    }]));
    const submit = vi.fn(async () => undefined);

    expect(getPendingCount()).toBe(0);
    expect(await syncPendingCheckins(submit)).toBe(0);
    expect(submit).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("airia_offline_checkins_legacy") || "[]")).toHaveLength(1);
  });

  it("is registered by the store and sends queued payloads to the canonical endpoint", () => {
    const storeSource = readFileSync(resolve(process.cwd(), "src/features/aura/store.tsx"), "utf8");

    expect(storeSource).toMatch(/registerOfflineSync\(submitQueuedCheckin\)/);
    expect(storeSource).toMatch(/api\.post\(['"]\/checkins['"], payload\)/);
    expect(storeSource).toMatch(/SIGNED_IN[\s\S]{0,180}syncPendingCheckins\(submitQueuedCheckin\)/);
  });
});
