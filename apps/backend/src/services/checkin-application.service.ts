import { createHash } from 'crypto';

import type { PrismaClient } from '@app/database';

import { CheckinCreateSchema, type CheckinCreateInput } from '../contracts/checkin.contract';
import { deriveCheckinSlot } from '../contracts/checkin-slot';

export type PersistedCheckin = Record<string, any> & {
  id: string;
  userId: string;
  recordedAt: Date;
  stateLabel?: string | null;
  stateLabelType?: string | null;
  stateSummary?: string | null;
  aiState?: unknown;
};

export type CheckinPersistenceInput = Omit<CheckinCreateInput, 'localDate' | 'checkinSlot'> & {
  localDate: Date;
  recordedAt: Date;
  checkinSlot: string;
  menstrualPhase: string | null;
  cycleDay: number | null;
  physicalSymptoms: string[];
};

export type CheckinEvaluation = {
  stateLabel: string;
  stateLabelType: string;
  stateSummary: string;
  aiState: Record<string, unknown>;
  riskSafety: Record<string, unknown>;
};

export type CheckinApplicationRepository = {
  findByIdempotency(userId: string, idempotencyKey: string): Promise<PersistedCheckin | null>;
  upsertBySlot(input: CheckinPersistenceInput): Promise<PersistedCheckin>;
  updateEvaluation(id: string, evaluation: Omit<CheckinEvaluation, 'riskSafety'>): Promise<PersistedCheckin>;
};

type Dependencies = {
  repository: CheckinApplicationRepository;
  evaluate(input: CheckinCreateInput & {
    checkinId: string;
    checkinSlot: string;
    recordedAt: Date;
    applicationContext: Record<string, unknown>;
  }): Promise<CheckinEvaluation>;
  afterPersist?(input: {
    data: CheckinCreateInput;
    checkin: PersistedCheckin;
    evaluation: CheckinEvaluation;
    applicationContext: Record<string, unknown>;
  }): Promise<void> | void;
};

type RecordContext = { now?: Date; requestContext?: Record<string, unknown> };

export type CheckinReceipt = PersistedCheckin & {
  status: 'persisted';
  checkinId: string;
  persistedAt: string;
  riskSafety: Record<string, unknown> | null;
};

function dateOnly(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function identitySuffix(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function resolveSlot(data: CheckinCreateInput, recordedAt: Date): string {
  if (data.checkinSlot) return data.checkinSlot;
  const base = deriveCheckinSlot(recordedAt);
  if (data.source === 'screen') return base;
  const identity = data.sourceMessageId ?? data.idempotencyKey;
  return identity ? `${base}-${identitySuffix(identity)}` : base;
}

function receipt(row: PersistedCheckin, riskSafety: Record<string, unknown> | null): CheckinReceipt {
  return {
    ...row,
    status: 'persisted',
    checkinId: row.id,
    persistedAt: row.recordedAt.toISOString(),
    riskSafety,
  };
}

export class CheckinApplicationService {
  constructor(private readonly dependencies: Dependencies) {}

  async record(raw: CheckinCreateInput, context: RecordContext = {}): Promise<CheckinReceipt> {
    const data = CheckinCreateSchema.parse(raw);
    if (data.idempotencyKey) {
      const existing = await this.dependencies.repository.findByIdempotency(data.userId, data.idempotencyKey);
      if (existing) {
        const storedRisk = existing.aiState && typeof existing.aiState === 'object'
          ? (existing.aiState as Record<string, any>).riskSafety ?? null
          : null;
        return receipt(existing, storedRisk);
      }
    }

    const recordedAt = context.now ?? new Date();
    const menstrualPhase = data.isFlowing
      ? (data.flowIntensity ?? 'menstruada')
      : null;
    const physicalSymptoms: string[] = [];
    if (data.isFlowing && data.symptomLevels?.colica) physicalSymptoms.push(`colica:${data.symptomLevels.colica}`);
    if (data.isFlowing && data.symptomLevels?.dorCabeca) physicalSymptoms.push(`dorCabeca:${data.symptomLevels.dorCabeca}`);

    const checkinSlot = resolveSlot(data, recordedAt);
    const checkin = await this.dependencies.repository.upsertBySlot({
      ...data,
      localDate: dateOnly(data.localDate),
      recordedAt,
      checkinSlot,
      menstrualPhase,
      cycleDay: data.isFlowing ? (data.flowDay ?? null) : null,
      physicalSymptoms,
    });
    const applicationContext = context.requestContext ?? {};
    const evaluation = await this.dependencies.evaluate({
      ...data,
      checkinId: checkin.id,
      checkinSlot,
      recordedAt,
      applicationContext,
    });
    const updated = await this.dependencies.repository.updateEvaluation(checkin.id, {
      stateLabel: evaluation.stateLabel,
      stateLabelType: evaluation.stateLabelType,
      stateSummary: evaluation.stateSummary,
      aiState: { ...evaluation.aiState, riskSafety: evaluation.riskSafety },
    });
    const afterPersistInput = { data, checkin: updated, evaluation, applicationContext };
    setImmediate(() => {
      void Promise.resolve(this.dependencies.afterPersist?.(afterPersistInput)).catch((error) => {
        console.warn('[checkin] atualização derivada após persistência falhou:', error);
      });
    });
    return receipt(updated, evaluation.riskSafety);
  }
}

export class PrismaCheckinApplicationRepository implements CheckinApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdempotency(userId: string, idempotencyKey: string): Promise<PersistedCheckin | null> {
    return this.prisma.dailyCheckin.findFirst({ where: { userId, idempotencyKey } }) as Promise<PersistedCheckin | null>;
  }

  async upsertBySlot(input: CheckinPersistenceInput): Promise<PersistedCheckin> {
    const values = {
      recordedAt: input.recordedAt,
      checkinPurpose: input.checkinPurpose ?? 'window',
      moodScore: input.moodScore,
      energyScore: input.energyScore,
      clarityScore: input.clarityScore ?? null,
      irritabilityScore: input.irritabilityScore ?? null,
      physicalScore: input.physicalScore ?? null,
      socialScore: input.socialScore ?? null,
      sleepScore: input.sleepScore ?? null,
      sleepHours: input.sleepHours ?? null,
      source: input.source,
      sourceMessageId: input.sourceMessageId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      signalMetadata: (input.signalMetadata ?? null) as any,
      note: input.note ?? null,
      factors: input.factors ?? [],
      emotions: input.emotions ?? [],
      menstrualPhase: input.menstrualPhase,
      cycleDay: input.cycleDay,
      physicalSymptoms: input.physicalSymptoms,
      isFlowing: input.isFlowing ?? null,
      flowDay: input.flowDay ?? null,
      flowIntensity: input.flowIntensity ?? null,
      symptomColica: input.symptomLevels?.colica ?? null,
      symptomDorCabeca: input.symptomLevels?.dorCabeca ?? null,
      medicationTakenToday: input.medicationTakenToday ?? null,
      focusScore: input.focusScore ?? null,
      hyperfocusOccurred: input.hyperfocusOccurred ?? null,
      mixedEpisodeNote: input.mixedEpisodeNote ?? null,
      dayType: input.dayType ?? null,
    };
    return this.prisma.dailyCheckin.upsert({
      where: {
        userId_localDate_checkinSlot: {
          userId: input.userId,
          localDate: input.localDate,
          checkinSlot: input.checkinSlot,
        },
      },
      update: values,
      create: {
        userId: input.userId,
        localDate: input.localDate,
        checkinSlot: input.checkinSlot,
        ...values,
      },
    }) as Promise<PersistedCheckin>;
  }

  async updateEvaluation(id: string, evaluation: Omit<CheckinEvaluation, 'riskSafety'>): Promise<PersistedCheckin> {
    return this.prisma.dailyCheckin.update({ where: { id }, data: evaluation as any }) as Promise<PersistedCheckin>;
  }
}
