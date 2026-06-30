type FindUniqueArgs = Record<string, unknown>;
type FindManyArgs = Record<string, unknown>;

type PrivacyExportModel = {
  findUnique?: (args: FindUniqueArgs) => Promise<unknown>;
  findMany?: (args: FindManyArgs) => Promise<unknown[]>;
};

export type PrivacyExportPrisma = Record<string, PrivacyExportModel>;

export type PrivacyExportPayload = {
  generatedAt: string;
  userId: string;
  profile: Record<string, unknown> | null;
  onboarding: unknown;
  preferences: (Record<string, unknown> & { googleCalendarConnected: boolean }) | null;
  consents: unknown[];
  data: {
    checkins: unknown[];
    journal: {
      sessions: unknown[];
      messages: unknown[];
    };
    planner: unknown[];
    objectives: unknown[];
    habits: unknown[];
    insights: unknown[];
    memories: unknown[];
    events: unknown[];
    pushSubscriptions: unknown[];
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function redactPreferences(value: unknown): PrivacyExportPayload['preferences'] {
  const prefs = asRecord(value);
  if (!prefs) return null;

  const {
    gcalAccessToken,
    gcalRefreshToken,
    ...safePreferences
  } = prefs;

  return {
    ...safePreferences,
    googleCalendarConnected: Boolean(gcalAccessToken || gcalRefreshToken),
  };
}

async function findUnique(model: PrivacyExportModel | undefined, args: FindUniqueArgs) {
  if (!model?.findUnique) return null;
  return model.findUnique(args);
}

async function findMany(model: PrivacyExportModel | undefined, args: FindManyArgs) {
  if (!model?.findMany) return [];
  return model.findMany(args);
}

export async function buildPrivacyExport(
  prisma: PrivacyExportPrisma,
  userId: string,
): Promise<PrivacyExportPayload> {
  const [
    profile,
    onboarding,
    preferences,
    consents,
    checkins,
    journalSessions,
    journalMessages,
    planner,
    objectives,
    habits,
    insights,
    memories,
    events,
    pushSubscriptions,
  ] = await Promise.all([
    findUnique(prisma.profile, { where: { id: userId } }),
    findUnique(prisma.onboardingResponse, { where: { userId } }),
    findUnique(prisma.userPreference, { where: { userId } }),
    findMany(prisma.consent, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.dailyCheckin, { where: { userId }, orderBy: { recordedAt: 'asc' } }),
    findMany(prisma.journalSession, { where: { userId }, orderBy: { startedAt: 'asc' } }),
    findMany(prisma.journalMessage, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.timelineBlock, { where: { userId }, orderBy: { startAt: 'asc' } }),
    findMany(prisma.objective, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.habit, {
      where: { userId },
      include: { completions: true },
      orderBy: { createdAt: 'asc' },
    }),
    findMany(prisma.weeklyInsight, { where: { userId }, orderBy: { weekStart: 'asc' } }),
    findMany(prisma.memoryEmbedding, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.eventLog, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.pushSubscription, { where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    userId,
    profile: asRecord(profile),
    onboarding,
    preferences: redactPreferences(preferences),
    consents,
    data: {
      checkins,
      journal: {
        sessions: journalSessions,
        messages: journalMessages,
      },
      planner,
      objectives,
      habits,
      insights,
      memories,
      events,
      pushSubscriptions,
    },
  };
}
