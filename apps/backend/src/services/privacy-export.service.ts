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
  billing: Record<string, unknown> | null;
  professionalPartner: Record<string, unknown> | null;
  referral: Record<string, unknown> | null;
  consents: unknown[];
  data: {
    checkins: unknown[];
    journal: {
      sessions: unknown[];
      messages: unknown[];
    };
    planner: unknown[];
    commandCenter: {
      sessions: unknown[];
      messages: unknown[];
      plans: unknown[];
      operations: unknown[];
    };
    captures: unknown[];
    objectives: unknown[];
    habits: unknown[];
    insights: unknown[];
    memories: unknown[];
    canonicalMemories: unknown[];
    memoryEvidence: unknown[];
    routineBuilder: unknown[];
    knowledgeGraph: {
      entities: unknown[];
      facts: unknown[];
      patterns: unknown[];
      openDecisions: unknown[];
    };
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

function redactCheckins(values: unknown[]): unknown[] {
  return values.map((value) => {
    const checkin = asRecord(value);
    if (!checkin) return value;
    const { sourceMessageId: _sourceMessageId, idempotencyKey: _idempotencyKey, ...safeCheckin } = checkin;
    return safeCheckin;
  });
}

function selectFields(value: unknown, fields: string[]): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record) return null;
  return Object.fromEntries(fields
    .filter((field) => field in record)
    .map((field) => [field, record[field]]));
}

function redactBilling(value: unknown) {
  return selectFields(value, [
    'userId', 'subscriptionStatus', 'subscriptionPlan', 'currentPeriodEnd',
    'cancelAtPeriodEnd', 'trialStartedAt', 'trialEndsAt', 'trialSource',
    'createdAt', 'updatedAt',
  ]);
}

function redactProfessionalPartner(value: unknown) {
  return selectFields(value, [
    'id', 'userId', 'professionalName', 'crpRegion', 'crpNumber',
    'verificationStatus', 'verifiedAt', 'lastVerifiedAt', 'referralCode',
    'active', 'createdAt', 'updatedAt',
  ]);
}

function redactReferral(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;
  const safe = selectFields(record, [
    'id', 'referredUserId', 'referralCode', 'benefitDays', 'claimedAt', 'convertedAt',
  ]) ?? {};
  const professionalPartner = asRecord(record.professionalPartner);
  return {
    ...safe,
    professional: professionalPartner && typeof professionalPartner.professionalName === 'string'
      ? { professionalName: professionalPartner.professionalName }
      : null,
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
    billing,
    professionalPartner,
    referral,
    consents,
    checkins,
    journalSessions,
    journalMessages,
    planner,
    commandSessions,
    commandMessages,
    commandPlans,
    commandOperations,
    captures,
    objectives,
    habits,
    insights,
    memories,
    canonicalMemories,
    memoryEvidence,
    routineBuilder,
    entities,
    facts,
    patterns,
    openDecisions,
    events,
    pushSubscriptions,
  ] = await Promise.all([
    findUnique(prisma.profile, { where: { id: userId } }),
    findUnique(prisma.onboardingResponse, { where: { userId } }),
    findUnique(prisma.userPreference, { where: { userId } }),
    findUnique(prisma.billingAccount, { where: { userId } }),
    findUnique(prisma.professionalPartner, { where: { userId } }),
    findUnique(prisma.referralAttribution, {
      where: { referredUserId: userId },
      include: { professionalPartner: { select: { professionalName: true } } },
    }),
    findMany(prisma.consent, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.dailyCheckin, { where: { userId }, orderBy: { recordedAt: 'asc' } }),
    findMany(prisma.journalSession, { where: { userId }, orderBy: { startedAt: 'asc' } }),
    findMany(prisma.journalMessage, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.timelineBlock, { where: { userId }, orderBy: { startAt: 'asc' } }),
    findMany(prisma.auraCommandSession, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.auraCommandMessage, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.auraCommandPlan, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.auraCommandOperation, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.capture, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.objective, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.habit, {
      where: { userId },
      include: { completions: true },
      orderBy: { createdAt: 'asc' },
    }),
    findMany(prisma.weeklyInsight, { where: { userId }, orderBy: { weekStart: 'asc' } }),
    findMany(prisma.memoryEmbedding, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.userMemory, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.userMemoryEvidence, { where: { userId }, orderBy: { observedAt: 'asc' } }),
    findMany(prisma.routineBuildSession, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.userEntity, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.userFact, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.userPattern, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.userOpenDecision, { where: { userId }, orderBy: { raisedAt: 'asc' } }),
    findMany(prisma.eventLog, { where: { userId }, orderBy: { createdAt: 'asc' } }),
    findMany(prisma.pushSubscription, { where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    userId,
    profile: asRecord(profile),
    onboarding,
    preferences: redactPreferences(preferences),
    billing: redactBilling(billing),
    professionalPartner: redactProfessionalPartner(professionalPartner),
    referral: redactReferral(referral),
    consents,
    data: {
      checkins: redactCheckins(checkins),
      journal: {
        sessions: journalSessions,
        messages: journalMessages,
      },
      planner,
      commandCenter: {
        sessions: commandSessions,
        messages: commandMessages,
        plans: commandPlans,
        operations: commandOperations,
      },
      captures,
      objectives,
      habits,
      insights,
      memories,
      canonicalMemories,
      memoryEvidence,
      routineBuilder,
      knowledgeGraph: { entities, facts, patterns, openDecisions },
      events,
      pushSubscriptions,
    },
  };
}
