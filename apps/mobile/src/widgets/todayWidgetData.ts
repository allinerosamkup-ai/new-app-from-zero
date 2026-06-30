import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import type { CheckinResponse } from '../services/ai_service';
import type { TimelineBlock } from '../presentation/providers/planner_store';

const WIDGET_STORAGE_KEY = 'airia_widget_today';

type NativeAiriaWidgetModule = {
  updateTodayWidget?: (payload: string) => Promise<void>;
};

const nativeWidgetModule = NativeModules.AiriaWidgetModule as NativeAiriaWidgetModule | undefined;

type WidgetCheckin = CheckinResponse & {
  moodScore?: number | null;
  energyScore?: number | null;
};

export type TodayWidgetPayload = {
  stateLabel: string;
  stateType: string;
  moodScore: number | null;
  energyScore: number | null;
  updatedAt: string;
  planner: Array<{
    time: string;
    title: string;
  }>;
};

function normalizeWidgetTitle(title: string): string {
  const cleanTitle = title.trim().replace(/\s+/g, ' ');
  if (cleanTitle.length <= 52) return cleanTitle;
  return `${cleanTitle.slice(0, 49)}...`;
}

function normalizeWidgetTime(time: string): string {
  const cleanTime = time.trim();
  return /^\d{2}:\d{2}$/.test(cleanTime) ? cleanTime : '--';
}

function normalizeWidgetStateLabel(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 48);
  }

  return 'Sem check-in';
}

function normalizeWidgetStateType(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 32);
  }

  return 'unknown';
}

function normalizeWidgetScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return Math.min(10, Math.max(1, rounded));
}

function normalizeWidgetUpdatedAt(value: unknown): string {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

export function sanitizeTodayWidgetPayload(payload: unknown): TodayWidgetPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const source = payload as {
    stateLabel?: unknown;
    stateType?: unknown;
    moodScore?: unknown;
    energyScore?: unknown;
    updatedAt?: unknown;
    planner?: unknown;
  };

  const planner = Array.isArray(source.planner)
    ? source.planner
        .filter((item): item is { time?: unknown; title?: unknown } => !!item && typeof item === 'object')
        .map((item) => ({
          time: normalizeWidgetTime(typeof item.time === 'string' ? item.time : '--'),
          title: normalizeWidgetTitle(typeof item.title === 'string' ? item.title : 'Bloco sem titulo'),
        }))
        .slice(0, 3)
    : [];

  return {
    stateLabel: normalizeWidgetStateLabel(source.stateLabel),
    stateType: normalizeWidgetStateType(source.stateType),
    moodScore: normalizeWidgetScore(source.moodScore),
    energyScore: normalizeWidgetScore(source.energyScore),
    updatedAt: normalizeWidgetUpdatedAt(source.updatedAt),
    planner,
  };
}

export function buildTodayWidgetPayload(input: {
  todayCheckin: WidgetCheckin | null;
  blocks: TimelineBlock[];
}): TodayWidgetPayload {
  const plannedBlocks = input.blocks
    .filter((block) => block.status !== 'completed')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 3)
    .map((block) => ({
      time: block.startTime,
      title: normalizeWidgetTitle(block.title || 'Bloco sem titulo'),
    }));

  return {
    stateLabel: input.todayCheckin?.stateLabel?.trim() || 'Sem check-in',
    stateType: input.todayCheckin?.stateLabelType?.trim() || 'unknown',
    moodScore: typeof input.todayCheckin?.moodScore === 'number' ? input.todayCheckin.moodScore : null,
    energyScore: typeof input.todayCheckin?.energyScore === 'number' ? input.todayCheckin.energyScore : null,
    updatedAt: new Date().toISOString(),
    planner: plannedBlocks,
  };
}

export async function publishTodayWidgetData(payload: TodayWidgetPayload): Promise<void> {
  const safePayload = sanitizeTodayWidgetPayload(payload);
  if (!safePayload) return;

  const serialized = JSON.stringify(safePayload);
  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, serialized);

  if (Platform.OS === 'android' && nativeWidgetModule?.updateTodayWidget) {
    await nativeWidgetModule.updateTodayWidget(serialized);
  }
}
