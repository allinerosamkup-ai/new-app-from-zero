export type TimelineBlockStatus = "planned" | "completed" | "postponed";
export type TimelineBlockIntensity = "L" | "M" | "P";

export type FormStateLike = {
  title: string;
  time: string;
  category: string;
  energyLevel: "alta" | "media" | "leve";
};

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60).toString().padStart(2, "0");
  const nextMinutes = (normalized % 60).toString().padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

function deriveCategoryFromTitle(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes("meditação") ||
    normalizedTitle.includes("meditar") ||
    normalizedTitle.includes("yoga") ||
    normalizedTitle.includes("autocuidado")
  ) {
    return "autocuidado";
  }

  if (
    normalizedTitle.includes("reunião") ||
    normalizedTitle.includes("análise") ||
    normalizedTitle.includes("trabalho") ||
    normalizedTitle.includes("projeto")
  ) {
    return "trabalho";
  }

  if (
    normalizedTitle.includes("almoço") ||
    normalizedTitle.includes("social") ||
    normalizedTitle.includes("amigo")
  ) {
    return "social";
  }

  return "pessoal";
}

export function normalizePlannerCategory(category?: string | null, title = "") {
  const value = (category ?? "").trim().toLowerCase();

  if (value === "trabalho") return "trabalho";
  if (value === "autocuidado" || value === "saude" || value === "saúde") return "autocuidado";
  if (value === "social") return "social";
  if (value === "pessoal" || value === "geral" || value === "rotina" || value === "outro") return "pessoal";
  return deriveCategoryFromTitle(title);
}

export function mapEnergyLevelToIntensity(
  energyLevel: FormStateLike["energyLevel"],
  fallback: TimelineBlockIntensity = "M",
): TimelineBlockIntensity {
  if (energyLevel === "alta") return "P";
  if (energyLevel === "leve") return "L";
  if (energyLevel === "media") return "M";
  return fallback;
}

export function mapIntensityToEnergyLevel(intensity?: string | null): FormStateLike["energyLevel"] {
  const value = (intensity ?? "").trim().toUpperCase();

  if (value === "P") return "alta";
  if (value === "L") return "leve";
  return "media";
}

export function buildTimelineBlockInput(
  form: FormStateLike,
  options?: {
    id?: string;
    durationMinutes?: number;
    fallbackIntensity?: TimelineBlockIntensity;
    fallbackStatus?: TimelineBlockStatus;
  },
) {
  return {
    ...(options?.id ? { id: options.id } : {}),
    title: form.title.trim(),
    startTime: form.time,
    endTime: addMinutesToTime(form.time, options?.durationMinutes ?? 30),
    category: normalizePlannerCategory(form.category, form.title),
    intensity: mapEnergyLevelToIntensity(form.energyLevel, options?.fallbackIntensity),
    status: options?.fallbackStatus ?? "planned",
  };
}
