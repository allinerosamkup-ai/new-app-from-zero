import { getLocalDateKey } from "../utils/day-context.ts";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type TimelineBlock = {
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  category: "trabalho" | "pessoal" | "autocuidado" | "social" | "outro";
  intensity: "L" | "M" | "P";
};

export function hasSubstantiveRoutineSource(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const source = value.trim();
  if (!source) return false;
  const nonEmptyLines = source.split(/\r?\n/).filter((line) => line.trim().length >= 4);
  return nonEmptyLines.length >= 2 || source.length >= 120;
}

export type TimelineSyncRequest = {
  date: string;
  forceSave: boolean;
  blocks: Array<{
    title: string;
    startTime: string;
    endTime: string;
    category: TimelineBlock["category"];
    intensity: TimelineBlock["intensity"];
    isAiSuggested: boolean;
    aiReasoning: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeCategory(category?: string): TimelineBlock["category"] {
  const value = (category ?? "pessoal").trim().toLowerCase();

  if (value === "trabalho") return "trabalho";
  if (value === "social") return "social";
  if (value === "autocuidado" || value === "saude" || value === "saúde") return "autocuidado";
  if (value === "geral" || value === "rotina" || value === "pessoal") return "pessoal";
  return "outro";
}

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value === "string" && TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }

  return fallback;
}

function normalizeDate(value: unknown, fallback: string): string {
  if (typeof value === "string" && DATE_PATTERN.test(value.trim())) {
    return value.trim();
  }

  return fallback;
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;

  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function normalizeIntensity(value: unknown): TimelineBlock["intensity"] {
  if (typeof value !== "string") return "M";

  const normalized = value.trim().toUpperCase();
  if (normalized === "L" || normalized === "M" || normalized === "P") {
    return normalized;
  }

  if (normalized.startsWith("LEVE")) return "L";
  if (normalized.startsWith("PES")) return "P";
  return "M";
}

function normalizeWeekdayToken(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }

  if (typeof value !== "string") return null;

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const weekdayMap: Record<string, number> = {
    seg: 0,
    segunda: 0,
    monday: 0,
    mon: 0,
    ter: 1,
    terca: 1,
    terça: 1,
    tuesday: 1,
    tue: 1,
    tues: 1,
    qua: 2,
    quarta: 2,
    wednesday: 2,
    wed: 2,
    qui: 3,
    quinta: 3,
    thursday: 3,
    thu: 3,
    thurs: 3,
    sex: 4,
    sexta: 4,
    friday: 4,
    fri: 4,
    sab: 5,
    sabado: 5,
    sábado: 5,
    saturday: 5,
    sat: 5,
    dom: 6,
    domingo: 6,
    sunday: 6,
    sun: 6,
  };

  return weekdayMap[normalized] ?? null;
}

function toMondayBasedWeekday(referenceDate: Date): number {
  return referenceDate.getDay() === 0 ? 6 : referenceDate.getDay() - 1;
}

function buildRecurringBlocks(payload: Record<string, unknown>, referenceDate: Date): TimelineBlock[] {
  const title = pickString(payload, ["title", "taskTitle", "name", "text"]);
  if (!title) return [];

  const recurrenceSource = isRecord(payload.recurrence) ? payload.recurrence : null;
  const weekdayCollection =
    [recurrenceSource?.weekdays, recurrenceSource?.daysOfWeek, recurrenceSource?.days, payload.weekdays, payload.daysOfWeek, payload.days]
      .find(Array.isArray) ?? [];

  if (!Array.isArray(weekdayCollection) || weekdayCollection.length === 0) {
    return [];
  }

  const weekdays = new Set(
    weekdayCollection
      .map((value) => normalizeWeekdayToken(value))
      .filter((value): value is number => value !== null),
  );

  if (weekdays.size === 0) {
    return [];
  }

  const defaultDate = getLocalDateKey(referenceDate);
  const startDate = normalizeDate(recurrenceSource?.startDate ?? payload.startDate ?? payload.date, defaultDate);
  const endDate = normalizeDate(recurrenceSource?.endDate ?? payload.endDate ?? payload.until ?? startDate, startDate);

  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate) || startDate > endDate) {
    return [];
  }

  const startTime = normalizeTime(
    recurrenceSource?.startTime ?? recurrenceSource?.time ?? recurrenceSource?.at ?? payload.startTime ?? payload.time ?? payload.at,
    "09:00",
  );
  const endTime = normalizeTime(recurrenceSource?.endTime ?? payload.endTime, addMinutes(startTime, 60));
  const category = normalizeCategory(
    typeof recurrenceSource?.category === "string"
      ? recurrenceSource.category
      : typeof payload.category === "string"
        ? payload.category
        : undefined,
  );
  const intensity = normalizeIntensity(recurrenceSource?.intensity ?? payload.intensity);

  const cursor = new Date(`${startDate}T12:00:00`);
  const last = new Date(`${endDate}T12:00:00`);
  const blocks: TimelineBlock[] = [];

  while (cursor <= last && blocks.length < 120) {
    if (weekdays.has(toMondayBasedWeekday(cursor))) {
      blocks.push({
        date: getLocalDateKey(cursor),
        title,
        startTime,
        endTime,
        category,
        intensity,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return blocks;
}

export function buildTimelineBlocks(payload: Record<string, unknown>, referenceDate = new Date()): TimelineBlock[] {
  const defaultDate = normalizeDate(
    payload.date ?? payload.localDate ?? payload.day,
    getLocalDateKey(referenceDate),
  );
  const collection =
    ["items", "tasks", "blocks", "agenda", "entries"]
      .map((key) => payload[key])
      .find(Array.isArray) ?? null;

  if (Array.isArray(collection) && collection.length > 0) {
    return collection
      .map((entry, index) => {
        if (!isRecord(entry)) return null;

        const defaultStart = addMinutes("09:00", index * 60);
        const title = pickString(entry, ["title", "text", "name"]);
        if (!title) return null;

        const date = normalizeDate(entry.date ?? entry.localDate ?? entry.day, defaultDate);
        const startTime = normalizeTime(entry.startTime ?? entry.time ?? entry.at, defaultStart);
        const endTime = normalizeTime(entry.endTime, addMinutes(startTime, 60));

        return {
          date,
          title,
          startTime,
          endTime,
          category: normalizeCategory(typeof entry.category === "string" ? entry.category : undefined),
          intensity: normalizeIntensity(entry.intensity),
        } satisfies TimelineBlock;
      })
      .filter((entry): entry is TimelineBlock => Boolean(entry));
  }

  const recurringBlocks = buildRecurringBlocks(payload, referenceDate);
  if (recurringBlocks.length > 0) {
    return recurringBlocks;
  }

  const title = pickString(payload, ["title", "taskTitle", "name", "text"]);
  if (!title) return [];

  const startTime = normalizeTime(payload.time ?? payload.startTime ?? payload.at, "09:00");
  const endTime = normalizeTime(payload.endTime, addMinutes(startTime, 60));

  return [{
    date: defaultDate,
    title,
    startTime,
    endTime,
    category: normalizeCategory(typeof payload.category === "string" ? payload.category : undefined),
    intensity: normalizeIntensity(payload.intensity),
  }];
}

export function buildTimelineSyncRequests(blocks: TimelineBlock[]): TimelineSyncRequest[] {
  const groups = blocks.reduce((acc, block) => {
    const current = acc.get(block.date) ?? [];
    current.push(block);
    acc.set(block.date, current);
    return acc;
  }, new Map<string, TimelineBlock[]>());

  return Array.from(groups.entries()).map(([date, dateBlocks]) => ({
    date,
    forceSave: true,
    blocks: dateBlocks.map((block) => ({
      title: block.title,
      startTime: block.startTime,
      endTime: block.endTime,
      category: block.category,
      intensity: block.intensity,
      isAiSuggested: true,
      aiReasoning: "Criado pela Airia no comando central.",
    })),
  }));
}

export function formatDateLabel(date: string, locale = "pt-BR"): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
}

export function formatTimelineBlock(block: TimelineBlock, locale = "pt-BR"): string {
  return `${block.title} · ${formatDateLabel(block.date, locale)} · ${block.startTime}`;
}

export function buildAuraObjectiveInput(payload: Record<string, unknown>): { title: string; itemTitles: string[] } | null {
  const title = pickString(payload, ["title", "goalTitle", "name", "text"]);
  if (!title) return null;

  const itemSources = ["subtasks", "checklist", "items", "steps", "tasks", "subgoals"];
  let itemTitles: string[] = [];
  for (const key of itemSources) {
    const value = payload[key];
    if (!Array.isArray(value)) continue;
    itemTitles = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (!isRecord(entry)) return null;
        return pickString(entry, ["title", "text", "name", "label", "task"]);
      })
      .filter((item): item is string => Boolean(item));
    if (itemTitles.length > 0) break;
  }

  return { title, itemTitles };
}
