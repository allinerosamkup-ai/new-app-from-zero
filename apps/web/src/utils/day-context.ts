export type ClientDayContext = {
  hour: number;
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

export function getClientDayContext(referenceDate = new Date()): ClientDayContext {
  const hour = referenceDate.getHours();
  const partOfDay = hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";
  const weekday = capitalize(referenceDate.toLocaleDateString("pt-BR", { weekday: "long" }));
  const dateLabel = referenceDate.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const localDate = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}-${String(referenceDate.getDate()).padStart(2, "0")}`;

  return {
    hour,
    partOfDay,
    weekday,
    localDate,
    dateLabel,
    dateWithWeekdayLabel: `${weekday}, ${dateLabel}`,
  };
}
