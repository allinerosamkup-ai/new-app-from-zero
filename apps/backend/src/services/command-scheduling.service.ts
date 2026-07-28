import { getPhaseWindow, slotTier } from '../lib/phase-time-windows';

export type CommandBusyWindow = {
  startTime: string;
  endTime: string;
  fixed?: boolean;
};

export type CommandSlot = {
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
};

type RankSlotsInput = {
  date: string;
  currentLocalDate: string;
  currentTime: string;
  durationMinutes: number;
  phase?: string | null;
  moodScore?: number | null;
  energyScore?: number | null;
  busyWindows: CommandBusyWindow[];
  wakeTime?: string | null;
  sleepTime?: string | null;
};

function minutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function time(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function ceilQuarter(value: number): number {
  return Math.ceil(value / 15) * 15;
}

export class CommandSchedulingService {
  static rankSlots(input: RankSlotsInput): CommandSlot[] {
    const duration = Math.max(5, Math.min(720, Math.round(input.durationMinutes)));
    const dayStart = minutes(input.wakeTime ?? '') ?? 8 * 60;
    const dayEnd = minutes(input.sleepTime ?? '') ?? 22 * 60;
    const now = minutes(input.currentTime) ?? 0;
    const earliest = input.date === input.currentLocalDate
      ? Math.max(dayStart, ceilQuarter(now + 15))
      : dayStart;
    const window = getPhaseWindow(input.phase || 'estavel');
    const busy = input.busyWindows
      .map((item) => ({
        start: minutes(item.startTime),
        end: minutes(item.endTime),
      }))
      .filter((item): item is { start: number; end: number } =>
        item.start !== null && item.end !== null && item.end > item.start);

    const lowEnergy = (input.energyScore ?? 5) <= 3 || (input.moodScore ?? 5) <= 3;
    const tierScore = {
      peak: lowEnergy ? 20 : 100,
      flow: lowEnergy ? 35 : 75,
      maintenance: lowEnergy ? 110 : 50,
      rest: lowEnergy ? -80 : -30,
    } as const;

    const candidates: CommandSlot[] = [];
    for (let start = earliest; start + duration <= dayEnd; start += 15) {
      const end = start + duration;
      if (busy.some((item) => start < item.end && end > item.start)) continue;

      const tier = slotTier(start, window);
      if (tier === 'rest' && lowEnergy) continue;
      const score = tierScore[tier] - Math.max(0, start - earliest) / 120;
      const reason = lowEnergy
        ? `Protege o ritmo e a energia atual dentro de uma janela ${tier === 'maintenance' ? 'leve' : 'possível'}.`
        : tier === 'peak'
          ? 'Usa uma janela de melhor energia sem conflitar com a agenda.'
          : tier === 'flow'
            ? 'Aproveita uma janela de bom fluxo sem conflitar com a agenda.'
            : 'É o melhor espaço livre restante no dia.';

      candidates.push({
        startTime: time(start),
        endTime: time(end),
        score,
        reason,
      });
    }

    return candidates
      .sort((a, b) => b.score - a.score || a.startTime.localeCompare(b.startTime))
      .slice(0, 3);
  }
}
