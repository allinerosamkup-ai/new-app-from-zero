// Helpers puros do check-in expresso: predição de defaults, ausência e emoção derivada.

export type CheckinHistoryLike = {
  date: string;
  humor: number;
  energia: number;
  checkinSlot?: string;
  recordedAt?: string;
};

export type CheckinPrediction = {
  humor: number;
  energia: number;
  source: "pattern" | "last" | "neutral";
};

export type BaseSlot = "morning" | "midday" | "evening";

export const QUICK_LEVELS = [2, 4, 6, 8, 10] as const;

// Re-entrada acolhedora a partir de 2 dias sem registro.
export const REENTRY_GAP_DAYS = 2;

export function nearestQuickLevel(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return QUICK_LEVELS.reduce<number>(
    (best, level) => (Math.abs(level - value) < Math.abs(best - value) ? level : best),
    QUICK_LEVELS[0],
  );
}

export function baseSlotFromDate(date: Date): BaseSlot {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "midday";
  return "evening";
}

export function baseSlotOf(entry: CheckinHistoryLike): BaseSlot | null {
  const slot = entry.checkinSlot ?? "";
  if (slot.startsWith("morning")) return "morning";
  if (slot.startsWith("midday")) return "midday";
  if (slot.startsWith("evening")) return "evening";
  if (entry.recordedAt) {
    const recorded = new Date(entry.recordedAt);
    if (!Number.isNaN(recorded.getTime())) return baseSlotFromDate(recorded);
  }
  return null;
}

function parseDateKey(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const stamp = Date.parse(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(stamp) ? null : stamp;
}

export function computeDaysSinceLastCheckin(
  history: CheckinHistoryLike[],
  todayKey: string,
): number | null {
  const today = parseDateKey(todayKey);
  if (today == null) return null;

  let latest: number | null = null;
  for (const entry of history) {
    const stamp = parseDateKey(entry.date);
    if (stamp == null || stamp > today) continue;
    if (latest == null || stamp > latest) latest = stamp;
  }
  if (latest == null) return null;
  return Math.round((today - latest) / 86_400_000);
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function predictCheckinDefaults(
  history: CheckinHistoryLike[],
  slot: BaseSlot,
  todayKey: string,
): CheckinPrediction {
  const today = parseDateKey(todayKey);
  const valid = history.filter((entry) => {
    if (!isValidScore(entry.humor) || !isValidScore(entry.energia)) return false;
    const stamp = parseDateKey(entry.date);
    return stamp != null && (today == null || stamp <= today);
  });

  if (today != null) {
    const sameSlotRecent = valid.filter((entry) => {
      const stamp = parseDateKey(entry.date)!;
      const ageDays = (today - stamp) / 86_400_000;
      return ageDays <= 14 && baseSlotOf(entry) === slot;
    });
    if (sameSlotRecent.length >= 3) {
      return {
        humor: nearestQuickLevel(median(sameSlotRecent.map((e) => e.humor))),
        energia: nearestQuickLevel(median(sameSlotRecent.map((e) => e.energia))),
        source: "pattern",
      };
    }

    const recent = valid
      .filter((entry) => (today - parseDateKey(entry.date)!) / 86_400_000 <= 7)
      .sort((a, b) => parseDateKey(b.date)! - parseDateKey(a.date)!);
    if (recent.length > 0) {
      return {
        humor: nearestQuickLevel(recent[0].humor),
        energia: nearestQuickLevel(recent[0].energia),
        source: "last",
      };
    }
  }

  return { humor: 6, energia: 6, source: "neutral" };
}

// Emoção plausível para o check-in expresso; o detalhamento fino fica no modo completo.
export function deriveExpressEmotion(humor: number, energia: number): string {
  if (humor >= 9) return "radiant";
  if (humor >= 7) return energia >= 7 ? "focused" : "happy";
  if (humor >= 5) return energia <= 4 ? "tired" : "calm";
  if (humor >= 3) return energia <= 4 ? "exhausted" : "sensitive";
  return "sad";
}

/** Keeps context already chosen in the check-in when speech adds more detail. */
export function mergeVoiceFactors(existing: string[], extracted: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return [...existing, ...(extracted ?? [])].filter((factor) => {
    const normalized = factor.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
