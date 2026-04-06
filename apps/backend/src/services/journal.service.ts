import { humanizeScore } from '../lib/aura-prompt';

type JournalSessionRecord = {
  id: string;
  userId: string;
  localDate: Date;
  status: string;
  startedAt?: Date;
};

type JournalMessageRecord = {
  id?: string;
  role: string;
  content: string;
  orderIndex: number;
  createdAt?: Date;
};

type RoutinePreferenceSnapshot = {
  wakeTime?: string | null;
  sleepTime?: string | null;
  morningCheckinTime?: string | null;
  eveningReviewTime?: string | null;
};

type CheckinSnapshot = {
  moodScore: number;
  energyScore: number;
  stateLabel?: string | null;
  stateLabelType?: string | null;
  recordedAt?: Date;
};

export type RoutineContext = {
  routineSummary?: string;
  promptSummary: string;
  preferences?: RoutinePreferenceSnapshot;
  checkinToday?: CheckinSnapshot | null;
  topThemes: string[];
  topPlannerCategories: string[];
  recentSummaries: string[];
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function countTopValues(values: string[], limit = 3): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function buildPromptSummary(input: {
  routineSummary?: string;
  preferences?: RoutinePreferenceSnapshot | null;
  checkinToday?: CheckinSnapshot | null;
  topThemes: string[];
  topPlannerCategories: string[];
  recentSummaries: string[];
}): string {
  const parts: string[] = [];

  if (input.routineSummary) {
    parts.push(`${input.routineSummary}`);
  }

  if (input.preferences?.wakeTime || input.preferences?.sleepTime) {
    parts.push(
      `Sua jornada costuma começar às ${input.preferences?.wakeTime ?? '...'} e silenciar por volta de ${input.preferences?.sleepTime ?? '...'}.`,
    );
  }

  if (input.checkinToday?.stateLabel) {
    parts.push(
      `Hoje você habita um estado ${input.checkinToday.stateLabel.toLowerCase()}, com um humor ${humanizeScore(input.checkinToday.moodScore, 'mood')} e uma energia ${humanizeScore(input.checkinToday.energyScore, 'energy')}.`,
    );
  }

  if (input.topThemes.length > 0) {
    parts.push(`Recentemente, seus pensamentos têm orbitado em torno de ${input.topThemes.join(', ')}.`);
  }

  if (input.recentSummaries.length > 0) {
    parts.push(`Nos últimos registros do diário, apareceram passagens como: ${input.recentSummaries.join(' | ')}.`);
  }

  if (input.topPlannerCategories.length > 0) {
    parts.push(`No seu planner, o foco tem sido em ${input.topPlannerCategories.join(', ')}.`);
  }

  if (parts.length === 0) {
    return 'Ainda estamos começando a nos conhecer. Sinta-se à vontade para compartilhar o que vier à mente.';
  }

  return parts.join(' ');
}

export class JournalService {
  static async startOrResumeSession(prisma: any, userId: string, referenceDate = new Date()) {
    const localDate = startOfUtcDay(referenceDate);

    const existingSession = await prisma.journalSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (existingSession) {
      return {
        session: existingSession as JournalSessionRecord,
        created: false,
      };
    }

    const session = await prisma.journalSession.create({
      data: {
        userId,
        localDate,
        status: 'active',
      },
    });

    return {
      session: session as JournalSessionRecord,
      created: true,
    };
  }

  static async getSessionMessages(prisma: any, sessionId: string) {
    return (await prisma.journalMessage.findMany({
      where: { sessionId },
      orderBy: { orderIndex: 'asc' },
    })) as JournalMessageRecord[];
  }

  static async buildRoutineContext(prisma: any, userId: string, referenceDate = new Date()): Promise<RoutineContext> {
    const today = startOfUtcDay(referenceDate);
    const recentWindowStart = new Date(today);
    recentWindowStart.setUTCDate(recentWindowStart.getUTCDate() - 7);

    const [onboarding, preferences, checkinToday, recentSessions, recentBlocks] = await Promise.all([
      prisma.onboardingResponse.findUnique({
        where: { userId },
      }),
      prisma.userPreference.findUnique({
        where: { userId },
      }),
      prisma.dailyCheckin.findFirst({
        where: { userId, localDate: today },
        orderBy: { recordedAt: 'desc' },
      }),
      prisma.journalSession.findMany({
        where: {
          userId,
          status: 'completed',
          localDate: { gte: recentWindowStart, lte: today },
        },
        orderBy: { localDate: 'desc' },
        take: 5,
      }),
      prisma.timelineBlock.findMany({
        where: {
          userId,
          localDate: { gte: recentWindowStart, lte: today },
        },
        orderBy: { localDate: 'desc' },
        take: 20,
      }),
    ]);

    const derivedRoutineSummary = [
      preferences?.wakeTime ? `Costuma acordar por volta de ${preferences.wakeTime}.` : null,
      preferences?.sleepTime ? `Costuma encerrar o dia por volta de ${preferences.sleepTime}.` : null,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const routineSummary = onboarding?.routineSummary ?? (derivedRoutineSummary || undefined);

    const topThemes = countTopValues(
      recentSessions.flatMap((session: { themes?: string[] | null }) => session.themes ?? []),
    );
    const recentSummaries = recentSessions
      .map((session: { summary?: string | null }) => session.summary?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 3);

    const topPlannerCategories = countTopValues(
      recentBlocks.map((block: { category?: string | null }) => block.category ?? ''),
    );

    const context = {
      routineSummary,
      preferences: preferences ?? undefined,
      checkinToday: (checkinToday as CheckinSnapshot | null) ?? null,
      topThemes,
      topPlannerCategories,
      recentSummaries,
    };

    return {
      ...context,
      promptSummary: buildPromptSummary(context),
    };
  }

  static nextOrderIndex(messages: Array<{ orderIndex: number }>): number {
    if (messages.length === 0) {
      return 0;
    }

    return Math.max(...messages.map((message) => message.orderIndex)) + 1;
  }
}
