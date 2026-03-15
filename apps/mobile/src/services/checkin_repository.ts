import type {
  BackendCheckinSlot,
  Checkin,
  CheckinCreateInput,
  CheckinCreateResult,
  CheckinPeriod,
  RecentCheckinsResult,
} from '../domain/entities/checkin';
import { PERIOD_TO_SLOT, SLOT_TO_PERIOD } from '../domain/entities/checkin';
import type { CheckinRepository } from '../domain/repositories/checkin_repository';
import api from './api_service';

type BackendCheckin = {
  id: string;
  localDate?: string;
  date?: string;
  checkinSlot?: BackendCheckinSlot;
  moodScore: number;
  energyScore: number;
  clarityScore?: number;
  irritabilityScore?: number;
  physicalScore?: number;
  socialScore?: number;
  note?: string | null;
  stateLabel?: string | null;
  stateLabelType?: string | null;
  aiState?: {
    analysis?: string;
    recommendations?: string[];
    suggestedIntensity?: 'L' | 'M' | 'P';
  } | null;
};

type RecentCheckinsResponse = {
  checkins: Array<{
    id: string;
    date: string;
    moodScore: number;
    energyScore: number;
    stateLabel: string | null;
    stateLabelType: string | null;
  }>;
};

function fallbackPeriodFromDate(date: string): CheckinPeriod {
  const hour = new Date(date).getHours();

  if (hour < 12) {
    return 'manha';
  }

  if (hour < 18) {
    return 'tarde';
  }

  return 'noite';
}

function mapBackendCheckin(input: BackendCheckin): Checkin {
  const normalizedDate = input.localDate ?? input.date ?? new Date().toISOString().slice(0, 10);
  const period = input.checkinSlot
    ? SLOT_TO_PERIOD[input.checkinSlot]
    : fallbackPeriodFromDate(normalizedDate);

  return {
    id: input.id,
    date: normalizedDate,
    period,
    moodScore: input.moodScore,
    energyScore: input.energyScore,
    clarityScore: input.clarityScore ?? 3,
    irritabilityScore: input.irritabilityScore ?? 3,
    physicalScore: input.physicalScore ?? 3,
    socialScore: input.socialScore ?? 3,
    note: input.note ?? undefined,
    stateLabel: input.stateLabel ?? undefined,
    stateLabelType: input.stateLabelType ?? undefined,
    energyStateInternal: input.aiState
      ? {
          analysis: input.aiState.analysis ?? '',
          recommendations: input.aiState.recommendations ?? [],
          suggestedIntensity: input.aiState.suggestedIntensity ?? 'M',
        }
      : undefined,
  };
}

class ApiCheckinRepository implements CheckinRepository {
  async createCheckin(data: CheckinCreateInput): Promise<CheckinCreateResult> {
    const payload = {
      localDate: data.date ?? new Date().toISOString().slice(0, 10),
      checkinSlot: PERIOD_TO_SLOT[data.period],
      moodScore: data.moodScore,
      energyScore: data.energyScore,
      clarityScore: data.clarityScore,
      irritabilityScore: data.irritabilityScore,
      physicalScore: data.physicalScore,
      socialScore: data.socialScore,
      note: data.note,
    };

    const response = await api.post<BackendCheckin>('/api/checkins', payload);

    return {
      checkin: mapBackendCheckin(response.data),
    };
  }

  async getRecentCheckins(days = 7): Promise<RecentCheckinsResult> {
    const normalizedDays = Math.min(Math.max(days, 1), 30);
    const response = await api.get<RecentCheckinsResponse>(`/api/checkins?days=${normalizedDays}`);

    return {
      checkins: response.data.checkins.map((checkin) => ({
        id: checkin.id,
        date: checkin.date,
        period: fallbackPeriodFromDate(checkin.date),
        moodScore: checkin.moodScore,
        energyScore: checkin.energyScore,
        clarityScore: 3,
        irritabilityScore: 3,
        physicalScore: 3,
        socialScore: 3,
        stateLabel: checkin.stateLabel ?? undefined,
        stateLabelType: checkin.stateLabelType ?? undefined,
      })),
    };
  }
}

export const checkinRepository: CheckinRepository = new ApiCheckinRepository();
