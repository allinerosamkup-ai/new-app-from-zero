export const AIRIA_CHECKIN_SLOTS = ['morning', 'midday', 'evening'] as const;
export type AiriaCheckinSlot = typeof AIRIA_CHECKIN_SLOTS[number];

export type CheckinWindow = { slot: AiriaCheckinSlot; targetTime: string; startTime: string; endTime: string };

function toMinutes(value: string | null | undefined, fallback: number): number {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return fallback;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function display(minutes: number): string {
  const rounded = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes / 5) * 5));
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Divide o período acordada em três janelas. Com três ou mais observações da
 * mesma janela, usa a mediana pessoal sem permitir que uma rotina atípica
 * desloque manhã para noite. Não há horário obrigatório nem penalidade.
 */
export function resolveAdaptiveCheckinWindows(input: {
  wakeTime?: string | null;
  sleepTime?: string | null;
  recentBySlot?: Partial<Record<AiriaCheckinSlot, string[]>>;
}): CheckinWindow[] {
  const wake = toMinutes(input.wakeTime, 8 * 60);
  let sleep = toMinutes(input.sleepTime, 23 * 60);
  if (sleep <= wake + 6 * 60) sleep = Math.min(23 * 60, wake + 14 * 60);
  const activeSpan = sleep - wake;
  return AIRIA_CHECKIN_SLOTS.map((slot, index) => {
    const bandStart = wake + activeSpan * index / 3;
    const bandEnd = wake + activeSpan * (index + 1) / 3;
    const defaultTarget = wake + activeSpan * (index * 2 + 1) / 6;
    const samples = (input.recentBySlot?.[slot] ?? []).map((value) => toMinutes(value, -1)).filter((value) => value >= 0);
    const learned = samples.length >= 3 ? median(samples) : null;
    const target = learned === null ? defaultTarget : Math.min(bandEnd - 20, Math.max(bandStart + 20, learned));
    return { slot, targetTime: display(target), startTime: display(bandStart), endTime: display(bandEnd) };
  });
}

export function shouldSendCheckinSlotNudge(input: {
  currentTime: string;
  window: CheckinWindow;
  completedSlots: Iterable<string>;
  nudgedSlots: Iterable<string>;
}): { send: boolean; reason: string } {
  const completed = new Set(input.completedSlots);
  const nudged = new Set(input.nudgedSlots);
  if (input.currentTime !== input.window.targetTime) return { send: false, reason: 'fora do horário da janela' };
  if (completed.has(input.window.slot)) return { send: false, reason: 'janela já registrada' };
  if (nudged.has(input.window.slot)) return { send: false, reason: 'lembrete da janela já enviado' };
  return { send: true, reason: 'janela de check-in elegível' };
}
