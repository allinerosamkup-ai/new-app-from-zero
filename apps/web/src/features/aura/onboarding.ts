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

/**
 * Binário de propósito. Este campo não descreve identidade — ele liga ou
 * desliga o rastreamento de ciclo menstrual, que é uma função biológica com
 * efeito medido sobre humor e energia. Uma terceira opção não teria como
 * responder a pergunta que o app precisa fazer.
 */
export const BIOLOGICAL_SEX_OPTIONS = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
] as const;

export type BiologicalSex = (typeof BIOLOGICAL_SEX_OPTIONS)[number]["value"];

/**
 * Espelho de `tracksMenstrualCycle` em
 * `apps/backend/src/contracts/onboarding.contract.ts`. Se um lado mudar, o
 * outro tem que mudar junto — `onboarding-gate.test.ts` trava os dois.
 *
 * `null` = ainda não perguntado: mantém o bloco visível, porque esconder um
 * campo que a pessoa já preenchia por causa de uma pergunta que ela nunca viu
 * seria sumir com dado sem avisar.
 */
export function tracksMenstrualCycle(sex: BiologicalSex | null | undefined): boolean {
  if (sex === null || sex === undefined) return true;
  return sex === "female";
}

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
  biologicalSex: BiologicalSex | null;
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
  biologicalSex: BiologicalSex | null;
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
    biologicalSex: null,
    medicationCurrentlyUsing: null,
  };
}

export function restartOnboardingFlow(
  resetDraft: () => void,
  navigate: (path: string) => void,
): void {
  resetDraft();
  navigate("/onboarding/guiado");
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
    // Quem não rastreia ciclo não manda dado de ciclo — inclusive o default de
    // 28/14 que o draft carrega desde o início. Sem isso o backend gravaria um
    // ciclo inventado para alguém que nunca viu a pergunta.
    cycleStart: tracksMenstrualCycle(draft.biologicalSex) ? (clean(draft.cycleStart) || null) : null,
    cycleLength: tracksMenstrualCycle(draft.biologicalSex) && Number.isFinite(draft.cycleLength) ? draft.cycleLength : null,
    lutealLength: tracksMenstrualCycle(draft.biologicalSex) && Number.isFinite(draft.lutealLength) ? draft.lutealLength : null,
    priorDiagnoses: Array.isArray(draft.priorDiagnoses) ? draft.priorDiagnoses : [],
    biologicalSex: draft.biologicalSex ?? null,
    medicationCurrentlyUsing: typeof draft.medicationCurrentlyUsing === "boolean" ? draft.medicationCurrentlyUsing : null,
  };
}
