export type RoutineItemKind = 'goal' | 'project' | 'task' | 'habit' | 'calendar' | 'reference' | 'concern';
export type RoutineReviewState = 'pending' | 'confirmed' | 'excluded';

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
};

export type RoutinePlan = {
  weekStart: string;
  capacity: { level: 'low' | 'balanced' | 'high'; reason: string };
  entries: RoutinePlanEntry[];
  days: Array<{ date: string; flexibleMinutes: number; fixedMinutes: number }>;
  contextItems: Array<{ sourceItemId: string; kind: RoutineItemKind; title: string }>;
  unscheduled: Array<{ sourceItemId: string; title: string; reason: string }>;
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
  applyResult?: { counts: { objectives: number; habits: number; timelineBlocks: number } } | null;
};

export type RoutineBuilderStep = 'source' | 'review' | 'clarify' | 'compose' | 'preview' | 'done';
