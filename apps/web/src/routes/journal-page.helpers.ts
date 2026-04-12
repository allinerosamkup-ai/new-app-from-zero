import { getLocalDateKey } from "../utils/day-context.ts";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTime(value: string | undefined | null): string {
  return typeof value === "string" && TIME_PATTERN.test(value) ? value : "09:00";
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(20 * 60, hours * 60 + mins + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function buildJournalPlannerSlot(input: {
  time?: string | null;
  dayOffset: number;
  referenceDate?: Date;
}): { date: string; startTime: string; endTime: string } {
  const referenceDate = input.referenceDate ? new Date(input.referenceDate) : new Date();
  referenceDate.setDate(referenceDate.getDate() + input.dayOffset);

  let startTime = normalizeTime(input.time);
  const hour = Number(startTime.split(":")[0]);

  if (hour < 8) {
    startTime = "08:00";
  } else if (hour >= 20) {
    startTime = input.dayOffset > 0 ? "09:00" : "19:00";
  }

  return {
    date: getLocalDateKey(referenceDate),
    startTime,
    endTime: addMinutes(startTime, 60),
  };
}
