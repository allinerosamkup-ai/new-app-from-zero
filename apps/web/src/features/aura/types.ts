import type { BiologicalSex, OnboardingDraft } from "./onboarding";

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
  id: string | number;
  title: string;
  done: boolean;
  order?: number;
  plannerBlockId?: string | null;
  milestoneId?: string | null;
  scheduledFor?: string | null;
  doneWhen?: string | null;
  effortSize?: 'small' | 'medium' | 'large' | null;
  basedOn?: 'stated' | 'inferred';
  aiGenerated?: boolean;
  userEdited?: boolean;
  status?: 'pending' | 'done' | 'rejected' | 'deferred';
};

export type Goal = {
  id: string | number;
  title: string;
  progress: string;
  subtasks: SubGoal[];
  completedPct: number;
  description?: string | null;
  resultDefinition?: string | null;
  currentReality?: string | null;
  milestones?: Array<{ id: string; title: string; order: number; doneWhen?: string | null }>;
  pathVersion?: number;
  pathStatus?: 'not_started' | 'retrying' | 'needs_answer' | 'ready';
  pathQuestion?: string | null;
  deadline?: string | null;
  pausedAt?: string | null;
  isPrimary?: boolean;
  pathProposal?: unknown;
};

export type CheckinEntry = {
  date: string;
  humor: number;
  energia: number;
  emotion?: string;
  stateLabel?: string | null;
  stateLabelType?: string | null;
  emotions?: string[];
  recordedAt?: string;
  checkinSlot?: 'morning' | 'midday' | 'evening' | string;
  sono?: number;
  sleepHours?: number;
  clareza?: number;
  irritabilidade?: number;
  fisico?: number;
  social?: number;
  /** O que cabe hoje e o que pesa hoje — vão para `signalMetadata.dayPlan`. */
  capacity?: 'quick' | 'moderate' | 'heavy';
  priorityGoalId?: string;
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
  source?: string;
  signalMetadata?: Record<string, unknown>;
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
  /** Autorrelato do onboarding. null = ainda não perguntado. */
  biologicalSex: BiologicalSex | null;
  /**
   * `true` usa medicação contínua, `false` não usa, `null` nunca respondeu.
   * Os três estados importam: `null` mantém a pergunta diária visível, pela
   * mesma regra do gate menstrual — esconder campo por causa de uma pergunta
   * que a pessoa nunca viu é sumir com dado sem avisar.
   */
  medicationCurrentlyUsing: boolean | null;
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
