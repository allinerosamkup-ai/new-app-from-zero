export type MoodOption =
  | "equilibrada"
  | "focada"
  | "tensa"
  | "cansada"
  | "sensivel"
  | "sobrecarregada";

export type Task = {
  id: number;
  title: string;
  time: string;
  done: boolean;
};

export type SubGoal = {
  id: number;
  title: string;
  done: boolean;
};

export type Goal = {
  id: number;
  title: string;
  progress: string;
  subtasks: SubGoal[];
  completedPct: number;
};

export type CheckinEntry = {
  date: string;
  humor: number;
  energia: number;
  emotion: string;
  sono?: number;
  fisico?: number;
  social?: number;
  cyclePhase?: string;
  cycleDay?: number;
  isFlowing?: boolean;
  flowDay?: number;
  flowIntensity?: 'leve' | 'moderado' | 'intenso';
  symptomLevels?: {
    colica?: 1 | 2 | 3;
    dorCabeca?: 1 | 2 | 3;
  };
};

export type AutonomousInsight = {
  stabilityScore: number;
  state: "stable" | "rising" | "falling" | "alert";
  pattern: string;
  insight: string;
  actions: Array<{ title: string; category: string; why: string }>;
  generatedAt: string;
};

export type PhaseTransitionAlert = {
  fromPhase: string;
  toPhase: string;
  fromLabel: string;
  toLabel: string;
  message: string;        // mensagem acolhedora da Aura
  tip: string;            // dica concreta
  severity: "info" | "warning" | "critical";
  generatedAt: string;
  dismissed: boolean;
};

export type FollowUpPending = {
  suggestionTitle: string;
  suggestionCategory: string;
  scheduledFor: string;   // ISO timestamp — quando mostrar o follow-up
  response: string | null; // null = ainda não respondido
  followUpMessage: string | null; // gerado pela IA quando o timer dispara
  source: "checkin" | "autonomous" | "proactive";
};

export type ProactiveNudge = {
  type: 'checkin_missing' | 'goal_stagnant' | 'inbox_overdue' | 'weekly_review' | 'phase_warning';
  title: string;
  message: string;
  action?: { label: string; path: string };
  priority: 'low' | 'medium' | 'high';
  generatedAt: string;
};

export type AuraState = {
  name: string;
  email: string;
  mood: MoodOption;
  energia: number;
  journal: string;
  tasks: Task[];
  goals: Goal[];
  theme: string;
  quietMode: boolean;
  checkinReminder: boolean;
  onboardingStep: number;
  checkinHistory: CheckinEntry[];
  autonomousInsight: AutonomousInsight | null;
  phaseTransitionAlert: PhaseTransitionAlert | null;
  pendingFollowUp: FollowUpPending | null;
  lastProfileUpdate: string | null;   // ISO — quando foi o último update do perfil
  proactiveNudge: ProactiveNudge | null;
  cycleStart?: string;
  cycleLength?: number;
};
