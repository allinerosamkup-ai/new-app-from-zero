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
  const serialized = JSON.stringify(payload);
  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, serialized);

  if (Platform.OS === 'android' && nativeWidgetModule?.updateTodayWidget) {
    await nativeWidgetModule.updateTodayWidget(serialized);
  }
}

