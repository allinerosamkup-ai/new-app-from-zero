import type { OnboardingDraft } from "./onboarding";

export type MoodOption =
  | "equilibrada"
  | "focada"
  | "tensa"
  | "cansada"
  | "sensivel"
  | "sobrecarregada";

export type Task = {
  id: string | number;
  title: string;
  time: string;
  endTime?: string;
  done: boolean;
  category?: string;
  intensity?: string;
  persistentReminderEnabled?: boolean;
  persistentReminderIntervalMinutes?: number | null;
  vibrateEnabled?: boolean;
  alarmEnabled?: boolean;
  recurringNotificationEnabled?: boolean;
  icon?: string;
  color?: string;
  note?: string;
  noteMode?: string;
  checklist?: Array<{ id: string; text: string; done: boolean }>;
  isAiSuggested?: boolean;
  aiReasoning?: string | null;
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
  stateLabel?: string | null;
  stateLabelType?: string | null;
  emotions?: string[];
  recordedAt?: string;
  checkinSlot?: 'morning' | 'midday' | 'evening' | string;
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
  factors?: string[];
  note?: string;
  // Diagnostic-aware optional signals (TDAH, bipolar, ciclotimia)
  medicationTakenToday?: boolean | null;
  focusScore?: number | null;
  hyperfocusOccurred?: boolean | null;
  mixedEpisodeNote?: string | null;
  dayType?: 'up' | 'down' | 'mixed' | 'stable' | null;
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
  quietModeStartTime: string;
  quietModeEndTime: string;
  checkinReminder: boolean;
  morningCheckinTime: string;
  eveningCheckinTime: string;
  notificationPreferences: NotificationPreferences;
  onboardingStep: number;
  onboardingDraft: OnboardingDraft;
  checkinHistory: CheckinEntry[];
  autonomousInsight: AutonomousInsight | null;
  phaseTransitionAlert: PhaseTransitionAlert | null;
  pendingFollowUp: FollowUpPending | null;
  lastProfileUpdate: string | null;   // ISO — quando foi o último update do perfil
  proactiveNudge: ProactiveNudge | null;
  cycleStart?: string;
  cycleLength?: number;
  lutealLength?: number;
  habits: Habit[];
  onboardingDone: boolean;
  accountCreatedAt?: string | null;
};

export type NotificationPreferences = {
  checkin: boolean;
  journal: boolean;
  planner: boolean;
  habits: boolean;
  persistent: boolean;
  aiSuggestions: boolean;
  journalMorningTime: string;
  journalEveningTime: string;
};

export type Habit = {
  id: string;
  title: string;
  description?: string;
  category: string;
  icon?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetDays: number[];
  targetCount: number;
  timeOfDay?: string | null;
  durationMinutes?: number | null;
  streakCount: number;
  bestStreak: number;
  totalCompletions: number;
  completions?: HabitCompletion[];
  reminderEnabled: boolean;
  reminderTime?: string | null;
  persistentReminderEnabled?: boolean;
  persistentReminderIntervalMinutes?: number | null;
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  date: string;
  completedAt?: string;
  completionCount?: number;
};
