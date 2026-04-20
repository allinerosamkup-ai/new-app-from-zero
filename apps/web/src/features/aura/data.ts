import { AuraState, Goal, MoodOption, Task } from "./types";
import { createEmptyOnboardingDraft } from "./onboarding";
import {
  DEFAULT_EVENING_CHECKIN_TIME,
  DEFAULT_MORNING_CHECKIN_TIME,
  DEFAULT_NOTIFICATION_PREFERENCES,
  QUIET_MODE_END_TIME,
  QUIET_MODE_START_TIME,
} from "./settings";

export const moodContent: Record<
  MoodOption,
  {
    title: string;
    description: string;
    tips: string[];
    tone: string;
  }
> = {
  equilibrada: {
    title: "Humor e energia em equilíbrio",
    description:
      "Sua energia está estável e o humor tranquilo. Ótimo para conexões e tarefas que pedem atenção suave.",
    tips: [
      "Reserve um momento para uma conversa significativa hoje.",
      "Aproveite a calma para planejar a semana com clareza.",
    ],
    tone: "tone-balanced",
  },
  focada: {
    title: "Clareza mental acima da média",
    description:
      "Seu foco está aguçado. Energia mental ativa — ideal para resolver desafios complexos agora.",
    tips: [
      "Use os próximos 90 min para sua tarefa mais importante.",
      "O modo pomodoro pode ajudar a manter o fluxo.",
    ],
    tone: "tone-focused",
  },
  tensa: {
    title: "Tensão percebida ao longo do dia",
    description:
      "Você está sentindo mais tensão hoje. Pequenas pausas estratégicas vão ajudar a recuperar o centro.",
    tips: [
      "Experimente 5 respirações lentas antes de iniciar cada tarefa.",
      "Simplifique sua lista — escolha apenas 3 prioridades hoje.",
    ],
    tone: "tone-alert",
  },
  cansada: {
    title: "Seu corpo pede descanso",
    description:
      "Este é um dia para tarefas leves e para recarregar sua energia com gentileza.",
    tips: [
      "Mova as tarefas pesadas para amanhã.",
      "Inclua 20 min de descanso no planner hoje.",
    ],
    tone: "tone-rest",
  },
  sensivel: {
    title: "Dia de sensibilidade ampliada",
    description:
      "Você está mais permeável hoje. Isso faz parte do seu ciclo — proteja sua energia com limites gentis.",
    tips: [
      "Evite reuniões ou conversas de alto impacto emocional hoje.",
      "Escreva no diário — exteriorizar ajuda a processar com mais leveza.",
    ],
    tone: "tone-soft",
  },
  sobrecarregada: {
    title: "Ponto de atenção emocional",
    description:
      "Reconhecemos que hoje está sendo mais pesado. Sua ciclagem indica um ponto de atenção — cuide-se primeiro.",
    tips: [
      "Cancele o que puder. Um dia de baixa produção não define seu ciclo.",
      "Hidrate-se, coma algo nutritivo e permita-se ir mais devagar.",
    ],
    tone: "tone-care",
  },
};

export const initialTasks: Task[] = [];

export const initialGoals: Goal[] = [];

export const initialAuraState: AuraState = {
  name: "",
  email: "",
  mood: "equilibrada",
  energia: 3,
  journal: "",
  tasks: initialTasks,
  goals: initialGoals,
  theme: "Tema claro",
  quietMode: true,
  quietModeStartTime: QUIET_MODE_START_TIME,
  quietModeEndTime: QUIET_MODE_END_TIME,
  checkinReminder: true,
  morningCheckinTime: DEFAULT_MORNING_CHECKIN_TIME,
  eveningCheckinTime: DEFAULT_EVENING_CHECKIN_TIME,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  onboardingStep: 0,
  onboardingDraft: createEmptyOnboardingDraft(),
  autonomousInsight: null,
  phaseTransitionAlert: null,
  pendingFollowUp: null,
  lastProfileUpdate: null,
  proactiveNudge: null,
  checkinHistory: [],
  habits: [],
  onboardingDone: false,
};

export function labelMood(mood: MoodOption) {
  const labels: Record<MoodOption, string> = {
    equilibrada: "Equilibrada",
    focada: "Focada",
    tensa: "Tensa",
    cansada: "Cansada",
    sensivel: "Sensível",
    sobrecarregada: "Sobrecarregada",
  };

  return labels[mood];
}
