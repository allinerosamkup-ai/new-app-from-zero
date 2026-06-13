import {
  DEFAULT_MORNING_CHECKIN_TIME,
} from "./settings";

export const PRIOR_DIAGNOSIS_OPTIONS = [
  { value: "bipolar_ii", label: "Bipolaridade tipo II" },
  { value: "cyclothymia", label: "Ciclotimia" },
  { value: "adhd", label: "TDAH" },
  { value: "cyclical_depression", label: "Depressão cíclica / sazonal" },
  { value: "prefer_not_to_say", label: "Prefiro não dizer" },
] as const;

export type PriorDiagnosis = (typeof PRIOR_DIAGNOSIS_OPTIONS)[number]["value"];

export type OnboardingDraft = {
  fullName: string;
  age: string;
  currentFeeling: string;
  routineText: string;
  mainEnergyPressure: string;
  energyDrainsMore: string[];
  energyDrainsLess: string[];
  focusScore: number;
  cycleStart: string;
  cycleLength: number;
  lutealLength: number;
  sleepHours: number;
  sleepQuality: "" | "bem" | "irregular" | "mal";
  sleepQualityNote: string;
  wakeTime: string;
  sleepTime: string;
  cognitivePreferences: string[];
  primaryGoal: string;
  supportGoals: string[];
  priorDiagnoses: PriorDiagnosis[];
  medicationCurrentlyUsing: boolean | null;
};

export type OnboardingProcessPayload = {
  fullName: string;
  age: number | null;
  currentFeeling: string;
  sleepQualityNote: string;
  wakeTime: string;
  sleepTime: string;
  routineText: string;
  mainEnergyPressure: string;
  primaryGoal: string;
  supportGoals: string[];
  cycleStart: string | null;
  cycleLength: number | null;
  lutealLength: number | null;
  priorDiagnoses: PriorDiagnosis[];
  medicationCurrentlyUsing: boolean | null;
};

export const ONBOARDING_BASIC_STEPS: Array<{
  field: keyof Pick<OnboardingDraft, "fullName" | "age" | "currentFeeling" | "routineText">;
  question: string;
  helper: string;
  placeholder: string;
  inputType?: "text" | "number";
  required?: boolean;
}> = [
  {
    field: "fullName",
    question: "Como você quer ser chamada?",
    helper: "Use seu nome ou apelido. É assim que a Airia vai falar com você.",
    placeholder: "Ex.: Alline",
    required: true,
  },
  {
    field: "age",
    question: "Qual sua idade?",
    helper: "Ajuda a ajustar linguagem e contexto. Se preferir, pode deixar em branco.",
    placeholder: "Ex.: 34",
    inputType: "number",
  },
  {
    field: "currentFeeling",
    question: "Como você está se sentindo agora?",
    helper: "Pode ser uma frase simples. O importante é capturar o ponto de partida.",
    placeholder: "Ex.: cansada, acelerada, sensível, animada...",
    required: true,
  },
  {
    field: "routineText",
    question: "Como costuma ser um dia comum seu?",
    helper: "Rotina, trabalho, estudos, casa, pausas, horários ou qualquer coisa que pese no seu dia.",
    placeholder: "Ex.: acordo cedo, trabalho à tarde, fico mais cansada à noite...",
    required: true,
  },
];

export function createEmptyOnboardingDraft(): OnboardingDraft {
  return {
    fullName: "",
    age: "",
    currentFeeling: "",
    routineText: "",
    mainEnergyPressure: "",
    energyDrainsMore: [],
    energyDrainsLess: [],
    focusScore: 6,
    cycleStart: "",
    cycleLength: 28,
    lutealLength: 14,
    sleepHours: 7,
    sleepQuality: "",
    sleepQualityNote: "",
    wakeTime: DEFAULT_MORNING_CHECKIN_TIME,
    sleepTime: "23:00",
    cognitivePreferences: [],
    primaryGoal: "",
    supportGoals: [],
    priorDiagnoses: [],
    medicationCurrentlyUsing: null,
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseNullableAge(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 13 && parsed <= 120 ? parsed : null;
}

function summarizeEnergyPressure(draft: OnboardingDraft): string {
  const more = draft.energyDrainsMore.length ? `Drena mais: ${draft.energyDrainsMore.join(", ")}.` : null;
  const less = draft.energyDrainsLess.length ? `Recupera energia: ${draft.energyDrainsLess.join(", ")}.` : null;
  const focus = `Foco disponível em dia bom: ${draft.focusScore}/10.`;
  return [more, less, focus].filter(Boolean).join(" ");
}

function summarizeSleep(draft: OnboardingDraft): string {
  const qualityLabels = {
    bem: "dorme bem",
    irregular: "sono irregular",
    mal: "dorme mal",
    "": "qualidade não informada",
  } satisfies Record<OnboardingDraft["sleepQuality"], string>;

  return `${qualityLabels[draft.sleepQuality]}; média de ${draft.sleepHours}h por noite; dorme por volta de ${draft.sleepTime} e acorda por volta de ${draft.wakeTime}.`;
}

export function buildOnboardingProcessPayload(draft: OnboardingDraft): OnboardingProcessPayload {
  const cognitivePreferences = draft.cognitivePreferences.map(clean).filter(Boolean);
  const supportGoals = [
    ...draft.supportGoals,
    ...cognitivePreferences,
  ].map(clean).filter(Boolean).slice(0, 6);

  return {
    fullName: clean(draft.fullName) || "Usuária",
    age: parseNullableAge(draft.age),
    currentFeeling: clean(draft.currentFeeling) || "Iniciando o onboarding e observando meu estado atual.",
    sleepQualityNote: clean(draft.sleepQualityNote) || summarizeSleep(draft),
    wakeTime: clean(draft.wakeTime) || DEFAULT_MORNING_CHECKIN_TIME,
    sleepTime: clean(draft.sleepTime) || "23:00",
    routineText: clean(draft.routineText) || "Rotina ainda não detalhada.",
    mainEnergyPressure: clean(draft.mainEnergyPressure) || summarizeEnergyPressure(draft),
    primaryGoal: clean(draft.primaryGoal) || supportGoals[0] || "Entender meus ciclos e organizar meu dia com mais gentileza.",
    supportGoals: supportGoals.length
      ? supportGoals
      : ["Entender meus ciclos", "Organizar a rotina por energia", "Criar check-ins consistentes"],
    cycleStart: clean(draft.cycleStart) || null,
    cycleLength: Number.isFinite(draft.cycleLength) ? draft.cycleLength : null,
    lutealLength: Number.isFinite(draft.lutealLength) ? draft.lutealLength : null,
    priorDiagnoses: Array.isArray(draft.priorDiagnoses) ? draft.priorDiagnoses : [],
    medicationCurrentlyUsing: typeof draft.medicationCurrentlyUsing === "boolean" ? draft.medicationCurrentlyUsing : null,
  };
}
