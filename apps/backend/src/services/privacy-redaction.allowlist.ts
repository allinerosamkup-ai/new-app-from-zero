/**
 * Privacy redaction allowlist.
 *
 * For every Prisma model that ends up in `buildPrivacyExport`, list the
 * fields the export is allowed to include and the fields that must be
 * redacted (replaced with `null` or summarized as a boolean).
 *
 * The companion test `privacy-allowlist.test.ts` parses
 * `packages/database/prisma/schema.prisma` and fails if any field of a
 * tracked model is not classified here. This blocks "PII drift" — when a
 * new column is added to a model and silently leaks into exports.
 */

export type AllowlistMode = 'include' | 'redact';

export type ModelAllowlist = {
  /** Fields safe to include verbatim. */
  include: string[];
  /** Fields that must NOT appear in the export payload. */
  redact: string[];
};

/**
 * Models that are part of the privacy export. Keys must match the camelCase
 * Prisma model name (e.g. `Profile`, `UserPreference`).
 */
export const PRIVACY_EXPORT_ALLOWLIST: Record<string, ModelAllowlist> = {
  Profile: {
    include: [
      'id',
      'fullName',
      'onboardingDone',
      'cycleStart',
      'cycleLength',
      'lutealLength',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  OnboardingResponse: {
    include: [
      'id',
      'userId',
      'supportGoals',
      'age',
      'currentFeeling',
      'sleepQualityNote',
      'routineText',
      'routineSummary',
      'mainEnergyPressure',
      'primaryGoal',
      'contextNotes',
      'aiProfileSummary',
      'aiRoutineSummary',
      'aiInitialStateSummary',
      'aiTopThemes',
      'aiInitialSuggestions',
      'aiProfilePayload',
      'priorDiagnoses',
      'medicationCurrentlyUsing',
      'medicationNotes',
      'version',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  UserPreference: {
    include: [
      'id',
      'userId',
      'timezone',
      'wakeTime',
      'sleepTime',
      'morningCheckinTime',
      'eveningReviewTime',
      'notificationsOn',
      'notificationPreferences',
      'aiTone',
      'gcalSelectedCalendars',
      'createdAt',
      'updatedAt',
    ],
    redact: [
      // OAuth tokens never leave the database. They are summarized as
      // `googleCalendarConnected: boolean` in the export payload.
      'gcalAccessToken',
      'gcalRefreshToken',
    ],
  },
  Consent: {
    include: [
      'id',
      'userId',
      'consentType',
      'granted',
      'version',
      'grantedAt',
      'revokedAt',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  DailyCheckin: {
    include: [
      'id',
      'userId',
      'localDate',
      'recordedAt',
      'checkinSlot',
      'moodScore',
      'energyScore',
      'clarityScore',
      'irritabilityScore',
      'physicalScore',
      'socialScore',
      'sleepScore',
      'menstrualPhase',
      'cycleDay',
      'physicalSymptoms',
      'isFlowing',
      'flowDay',
      'flowIntensity',
      'symptomColica',
      'symptomDorCabeca',
      'factors',
      'emotions',
      'note',
      'medicationTakenToday',
      'focusScore',
      'hyperfocusOccurred',
      'mixedEpisodeNote',
      'dayType',
      'stateLabel',
      'stateLabelType',
      'stateSummary',
      'aiState',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  JournalSession: {
    include: [
      'id',
      'userId',
      'localDate',
      'status',
      'summary',
      'emotions',
      'themes',
      'suggestions',
      'rawTextHash',
      'startedAt',
      'finalizedAt',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  JournalMessage: {
    include: [
      'id',
      'sessionId',
      'userId',
      'role',
      'content',
      'orderIndex',
      'createdAt',
    ],
    redact: [],
  },
  TimelineBlock: {
    include: [
      'id',
      'userId',
      'localDate',
      'startAt',
      'endAt',
      'title',
      'category',
      'intensity',
      'status',
      'isAiSuggested',
      'gcalEventId',
      'aiReasoning',
      'noteMode',
      'note',
      'checklist',
      'recurring',
      'energyLevel',
      'lastResetDate',
      'persistentReminderEnabled',
      'persistentReminderIntervalMinutes',
      'alarmEnabled',
      'vibrateEnabled',
      'recurringNotificationEnabled',
      'visualRepeatEnabled',
      'icon',
      'color',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  Objective: {
    include: [
      'id',
      'userId',
      'title',
      'description',
      'category',
      'progress',
      'subgoals',
      'aiInsight',
      'archived',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  Habit: {
    include: [
      'id',
      'userId',
      'title',
      'description',
      'category',
      'icon',
      'frequency',
      'targetDays',
      'targetCount',
      'timeOfDay',
      'durationMinutes',
      'reminderEnabled',
      'reminderTime',
      'persistentReminderEnabled',
      'persistentReminderIntervalMinutes',
      'streakCount',
      'bestStreak',
      'totalCompletions',
      'archived',
      'archivedAt',
      'createdAt',
      'updatedAt',
      // Relation pulled in via include: { completions: true } in the export.
      'completions',
    ],
    redact: [],
  },
  WeeklyInsight: {
    include: [
      'id',
      'userId',
      'weekStart',
      'avgMood',
      'avgEnergy',
      'checkinCount',
      'insights',
      'createdAt',
      'updatedAt',
    ],
    redact: [],
  },
  MemoryEmbedding: {
    include: [
      'id',
      'userId',
      'contentType',
      'contentId',
      'content',
      'metadata',
      'createdAt',
    ],
    redact: [],
  },
  EventLog: {
    include: [
      'id',
      'userId',
      'eventName',
      'properties',
      'path',
      'userAgent',
      'createdAt',
    ],
    redact: [],
  },
  PushSubscription: {
    include: [
      'id',
      'userId',
      'endpoint',
      'p256dhKey',
      'authKey',
      'userAgent',
      'createdAt',
    ],
    redact: [],
  },
};

/**
 * Models intentionally excluded from the export. Listed here so the
 * guardrail test can assert "every Prisma model is either in the export
 * allowlist OR explicitly excluded".
 */
export const PRIVACY_EXPORT_EXCLUDED_MODELS = new Set<string>([
  // Internal scheduling state, no user-visible PII
  'AiBackgroundJob',
  // Habit completions are exported via Habit.include.completions, not standalone
  'HabitCompletion',
]);

export function classifyField(model: string, field: string): AllowlistMode | 'unknown' {
  const entry = PRIVACY_EXPORT_ALLOWLIST[model];
  if (!entry) return 'unknown';
  if (entry.include.includes(field)) return 'include';
  if (entry.redact.includes(field)) return 'redact';
  return 'unknown';
}
