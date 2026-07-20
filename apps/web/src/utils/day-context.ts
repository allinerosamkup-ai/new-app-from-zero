export type ClientDayContext = {
  hour: number;
  minute: number;
  partOfDay: "manhã" | "tarde" | "noite";
  weekday: string;
  localDate: string;
  dateLabel: string;
  dateWithWeekdayLabel: string;
};

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getLocalDateKey(referenceDate = new Date()): string {
  return [
    referenceDate.getFullYear(),
    String(referenceDate.getMonth() + 1).padStart(2, "0"),
    String(referenceDate.getDate()).padStart(2, "0"),
  ].join("-");
}

export function normalizeDateKey(value: unknown): string {
  if (value instanceof Date) return getLocalDateKey(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const directMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) return directMatch[1];
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return getLocalDateKey(parsed);
  }
  return "";
}

export function getLocalNoonDate(referenceDate = new Date()): Date {
  const date = new Date(referenceDate);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function getClientDayContext(referenceDate = new Date(), locale = "pt-BR"): ClientDayContext {
  const hour = referenceDate.getHours();
  const minute = referenceDate.getMinutes();
  const partOfDay = hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";
  const weekday = capitalize(referenceDate.toLocaleDateString(locale, { weekday: "long" }));
  const dateLabel = referenceDate.toLocaleDateString(locale, { day: "numeric", month: "long" });
  const localDate = getLocalDateKey(referenceDate);

  return {
    hour,
    minute,
    partOfDay,
    weekday,
    localDate,
    dateLabel,
    dateWithWeekdayLabel: `${weekday}, ${dateLabel}`,
  };
}
