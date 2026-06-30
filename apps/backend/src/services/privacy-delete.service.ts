import { randomBytes } from 'node:crypto';

/**
 * Deletion-request flow without a schema migration: state lives in
 * EventLog. Source of truth is the latest privacy.deletion.* event for
 * the user.
 *
 * Lifecycle:
 *   requested  → confirmed  → (cron purges after scheduledFor)
 *   requested  → cancelled
 *   confirmed  → cancelled  (allowed until scheduledFor passes)
 */

const DELETION_GRACE_PERIOD_DAYS = 30;
const DELETION_CONFIRM_WINDOW_HOURS = 24;

export const PRIVACY_DELETION_EVENT_NAMES = {
  requested: 'privacy.deletion.requested',
  confirmed: 'privacy.deletion.confirmed',
  cancelled: 'privacy.deletion.cancelled',
  purged: 'privacy.deletion.purged',
} as const;

type EventLogRow = {
  eventName: string;
  properties: Record<string, unknown> | null;
  createdAt: Date;
};

type EventLogModel = {
  findFirst: (args: Record<string, unknown>) => Promise<EventLogRow | null>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
};

export type PrivacyDeletePrisma = {
  eventLog: EventLogModel;
};

export type DeletionStatus =
  | { status: 'none' }
  | {
      status: 'requested';
      token: string;
      requestedAt: string;
      confirmDeadline: string;
    }
  | {
      status: 'confirmed';
      confirmedAt: string;
      scheduledFor: string;
    }
  | {
      status: 'cancelled';
      cancelledAt: string;
    };

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

async function loadLatestDeletionEvent(
  prisma: PrivacyDeletePrisma,
  userId: string,
): Promise<EventLogRow | null> {
  return prisma.eventLog.findFirst({
    where: {
      userId,
      eventName: {
        in: Object.values(PRIVACY_DELETION_EVENT_NAMES),
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDeletionStatus(
  prisma: PrivacyDeletePrisma,
  userId: string,
  now: Date = new Date(),
): Promise<DeletionStatus> {
  const latest = await loadLatestDeletionEvent(prisma, userId);
  if (!latest) return { status: 'none' };

  const properties = latest.properties ?? {};

  if (latest.eventName === PRIVACY_DELETION_EVENT_NAMES.requested) {
    const token = String(properties.token ?? '');
    const requestedAt = latest.createdAt.toISOString();
    const confirmDeadline = addHours(
      latest.createdAt,
      DELETION_CONFIRM_WINDOW_HOURS,
    ).toISOString();

    // Treat expired unconfirmed requests as no-op.
    if (now.getTime() > new Date(confirmDeadline).getTime()) {
      return { status: 'none' };
    }
    return { status: 'requested', token, requestedAt, confirmDeadline };
  }

  if (latest.eventName === PRIVACY_DELETION_EVENT_NAMES.confirmed) {
    return {
      status: 'confirmed',
      confirmedAt: latest.createdAt.toISOString(),
      scheduledFor: String(properties.scheduledFor ?? ''),
    };
  }

  if (latest.eventName === PRIVACY_DELETION_EVENT_NAMES.cancelled) {
    return { status: 'cancelled', cancelledAt: latest.createdAt.toISOString() };
  }

  return { status: 'none' };
}

export async function requestDeletion(
  prisma: PrivacyDeletePrisma,
  userId: string,
  now: Date = new Date(),
): Promise<DeletionStatus> {
  const current = await getDeletionStatus(prisma, userId, now);
  if (current.status === 'requested') return current;
  if (current.status === 'confirmed') return current;

  const token = generateToken();
  const confirmDeadline = addHours(now, DELETION_CONFIRM_WINDOW_HOURS).toISOString();

  await prisma.eventLog.create({
    data: {
      userId,
      eventName: PRIVACY_DELETION_EVENT_NAMES.requested,
      properties: { token, confirmDeadline },
    },
  });

  return {
    status: 'requested',
    token,
    requestedAt: now.toISOString(),
    confirmDeadline,
  };
}

export class DeletionConfirmError extends Error {
  constructor(public readonly code: 'no_request' | 'invalid_token' | 'expired') {
    super(code);
  }
}

export async function confirmDeletion(
  prisma: PrivacyDeletePrisma,
  userId: string,
  token: string,
  now: Date = new Date(),
): Promise<DeletionStatus> {
  const current = await getDeletionStatus(prisma, userId, now);
  if (current.status !== 'requested') {
    throw new DeletionConfirmError('no_request');
  }
  if (current.token !== token) {
    throw new DeletionConfirmError('invalid_token');
  }
  if (new Date(current.confirmDeadline).getTime() < now.getTime()) {
    throw new DeletionConfirmError('expired');
  }

  const scheduledFor = addDays(now, DELETION_GRACE_PERIOD_DAYS).toISOString();

  await prisma.eventLog.create({
    data: {
      userId,
      eventName: PRIVACY_DELETION_EVENT_NAMES.confirmed,
      properties: { scheduledFor },
    },
  });

  return {
    status: 'confirmed',
    confirmedAt: now.toISOString(),
    scheduledFor,
  };
}

export async function cancelDeletion(
  prisma: PrivacyDeletePrisma,
  userId: string,
  now: Date = new Date(),
): Promise<DeletionStatus> {
  const current = await getDeletionStatus(prisma, userId, now);
  if (current.status === 'none') return current;

  await prisma.eventLog.create({
    data: {
      userId,
      eventName: PRIVACY_DELETION_EVENT_NAMES.cancelled,
      properties: {},
    },
  });

  return { status: 'cancelled', cancelledAt: now.toISOString() };
}

export const PRIVACY_DELETION_CONSTANTS = {
  gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
  confirmWindowHours: DELETION_CONFIRM_WINDOW_HOURS,
} as const;
