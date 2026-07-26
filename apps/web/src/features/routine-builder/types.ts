export type RoutineItemKind = 'goal' | 'project' | 'task' | 'habit' | 'calendar' | 'reference' | 'concern';
export type RoutineReviewState = 'pending' | 'confirmed' | 'excluded';
export type RoutineBuilderMode = 'guided' | 'import';
export type RoutinePriority = 'low' | 'medium' | 'high' | 'urgent';

export type RoutineTimeWindow = {
  startTime: string;
  endTime: string;
  minDurationMinutes: number;
  maxDurationMinutes: number;
};

export type GuidedAvailability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type GuidedFixedCommitment = GuidedAvailability & {
  title: string;
};

export type GuidedHabitChoice = {
  templateId: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  daysOfWeek: number[];
  timesPerWeek?: number | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes: number;
};

export type GuidedRoutineAnswers = {
  lifeAreas: string[];
  availability: GuidedAvailability[];
  fixedCommitments: GuidedFixedCommitment[];
  energyDrains: string[];
  energyRestorers: string[];
  intentions: string[];
  selectedHabits: GuidedHabitChoice[];
  currentState: {
    mood: number;
    energy: number;
    focus: number;
    sleepQuality: string;
  };
  freeText?: string;
};

export type RoutineItem = {
  id: string;
  kind: RoutineItemKind;
  title: string;
  description?: string | null;
  sourceExcerpt: string;
  confidence: number;
  classificationReason?: string | null;
  reviewState: RoutineReviewState;
  durationMinutes?: number | null;
  date?: string | null;
  startTime?: string | null;
  deadline?: string | null;
  priority?: RoutinePriority;
  timeWindow?: RoutineTimeWindow | null;
  recurrence?: { frequency: 'daily' | 'weekly' | 'monthly'; daysOfWeek?: number[]; timesPerWeek?: number | null; interval?: number } | null;
  isFixed?: boolean;
  duplicateOf?: string | null;
};

export type RoutineQuestion = {
  id: string;
  itemId: string;
  field: 'date_and_time' | 'recurrence' | 'title';
  answerType: 'datetime' | 'frequency' | 'text';
  prompt: string;
  reason: string;
  options?: Array<{ value: string; label: string }>;
};

export type RoutinePlanEntry = {
  id: string;
  sourceItemId?: string;
  kind: 'task' | 'habit' | 'calendar' | 'existing';
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  durationMinutes: number;
  isFixed: boolean;
  persist: boolean;
  reason: string;
  priority?: RoutinePriority;
  deadline?: string | null;
  timeWindow?: RoutineTimeWindow | null;
};

export type RoutinePlan = {
  weekStart: string;
  capacity: { level: 'low' | 'balanced' | 'high'; reason: string };
  entries: RoutinePlanEntry[];
  days: Array<{
    date: string;
    flexibleMinutes: number;
    fixedMinutes: number;
    predictedMinutes: number;
    capacityMinutes: number;
    utilizationPercent: number;
    status: 'light' | 'balanced' | 'overloaded';
  }>;
  contextItems: Array<{ sourceItemId: string; kind: RoutineItemKind; title: string }>;
  unscheduled: Array<{
    sourceItemId: string;
    title: string;
    reason: string;
    alternatives: Array<{
      action: 'move' | 'shorten' | 'defer';
      reason: string;
      suggestedDate?: string;
      suggestedStartTime?: string;
      durationMinutes?: number;
    }>;
  }>;
};

export type RoutineSuggestionCardState = 'available' | 'added' | 'discarded' | 'needs_adjustment';

export type RoutineSuggestionCard = {
  sourceItemId: string;
  kind: Extract<RoutineItemKind, 'goal' | 'project' | 'task' | 'habit' | 'calendar'>;
  title: string;
  description?: string | null;
  reason: string;
  recurrence?: RoutineItem['recurrence'];
  firstOccurrence: {
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  } | null;
  occurrenceCount: number;
  state: RoutineSuggestionCardState;
};

export type RoutineApplyResult = {
  counts: { objectives: number; habits: number; timelineBlocks: number };
  ids?: { objectives: string[]; habits: string[]; timelineBlocks: string[] };
  appliedSourceItemIds?: string[];
};

export type RoutineSession = {
  id: string;
  status: 'draft' | 'classified' | 'needs_clarification' | 'ready' | 'applying' | 'applied' | 'failed' | 'cancelled';
  stage: string;
  focus: string;
  weekStart: string;
  items: RoutineItem[];
  questions: RoutineQuestion[];
  answers: Array<{ questionId: string; answer: string }>;
  draftPlan?: RoutinePlan | null;
  applyResult?: RoutineApplyResult | null;
};

export type RoutineBuilderStep = 'source' | 'review' | 'clarify' | 'compose' | 'preview' | 'done';
