/**
 * Phase-aware time windows for the Adaptive Agenda Engine.
 *
 * Each of the 8 official Airia phases defines energy tiers for the day:
 *   peak        → deep/heavy work, best cognitive load
 *   flow        → focused but not peak, moderate tasks
 *   maintenance → admin, light habits, reviews
 *   (rest)      → anything outside the above ranges
 *
 * All values are in minutes from midnight (e.g. 9*60 = 540 = 09:00).
 * Used by DecisionEngine to score slots and route heavy tasks to the right window.
 */

export type PhaseWindow = {
  peak: [number, number][];
  flow: [number, number][];
  maintenance: [number, number][];
  note: string;
};

export const PHASE_WINDOWS: Record<string, PhaseWindow> = {
  'voo alto': {
    peak:        [[8 * 60, 11 * 60]],
    flow:        [[14 * 60, 16 * 60]],
    maintenance: [[11 * 60, 14 * 60], [16 * 60, 19 * 60]],
    note: 'Pico AM — estruture foco antes das 11h. Evite empilhar após o almoço; energia costuma cair.',
  },
  'fluindo': {
    peak:        [[9 * 60, 12 * 60], [15 * 60, 17 * 60]],
    flow:        [[14 * 60, 15 * 60], [17 * 60, 19 * 60]],
    maintenance: [[12 * 60, 14 * 60]],
    note: 'Dois picos disponíveis — distribua trabalho pesado neles, use o intervalo para tarefas leves.',
  },
  'estavel': {
    peak:        [[10 * 60, 13 * 60]],
    flow:        [[9 * 60, 10 * 60], [14 * 60, 17 * 60]],
    maintenance: [[8 * 60, 9 * 60], [17 * 60, 20 * 60]],
    note: 'Janela padrão, sem picos fortes. Ritmo constante ao longo do dia.',
  },
  'desacelerando': {
    peak:        [],
    flow:        [[10 * 60, 13 * 60]],
    maintenance: [[13 * 60, 16 * 60]],
    note: 'Só trabalho moderado até 13h, tarefas leves à tarde. Evite início cedo e fim de tarde pesado.',
  },
  'recolhimento': {
    peak:        [],
    flow:        [],
    maintenance: [[11 * 60, 14 * 60]],
    note: 'Janela estreita 11h–14h para manutenção mínima. Fora disso, nenhum bloco pesado.',
  },
  'pausa': {
    peak:        [],
    flow:        [],
    maintenance: [[11 * 60, 13 * 60]],
    note: 'Manutenção mínima apenas. Nenhum bloco pesado ou de foco deve ser sugerido.',
  },
  'retomada': {
    peak:        [],
    flow:        [[10 * 60, 13 * 60]],
    maintenance: [[13 * 60, 17 * 60]],
    note: 'Reintrodução gradual — foco suave até 13h, admin à tarde. Sem forçar produtividade.',
  },
  'turbulencia': {
    peak:        [],
    flow:        [],
    maintenance: [[11 * 60, 13 * 60]],
    note: 'Instabilidade ativa — mesmo regime que Recolhimento. Manter ao mínimo.',
  },
};

/**
 * Returns the PhaseWindow for a given phase key (normalized).
 * Falls back to 'estavel' if the phase is unknown.
 */
export function getPhaseWindow(phaseKey: string): PhaseWindow {
  const normalized = phaseKey
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return PHASE_WINDOWS[normalized] ?? PHASE_WINDOWS['estavel'];
}

/**
 * Returns the energy tier of a given start time (in minutes) within a phase window.
 * 'rest' means the slot falls outside any defined tier — avoid heavy tasks here.
 */
export function slotTier(
  startMin: number,
  window: PhaseWindow,
): 'peak' | 'flow' | 'maintenance' | 'rest' {
  if (window.peak.some(([s, e]) => startMin >= s && startMin < e)) return 'peak';
  if (window.flow.some(([s, e]) => startMin >= s && startMin < e)) return 'flow';
  if (window.maintenance.some(([s, e]) => startMin >= s && startMin < e)) return 'maintenance';
  return 'rest';
}

/**
 * Returns the overall "capacity level" of a phase window.
 * Used as a fast check in DecisionEngine to handle low-capacity phases.
 */
export function phaseHasPeakOrFlow(window: PhaseWindow): boolean {
  return window.peak.length > 0 || window.flow.length > 0;
}

/**
 * Returns the best available start time (in minutes) for a task in a given window,
 * considering the current time (nowMin) and a minimum duration (durationMin).
 * Prefers peak > flow > maintenance.
 * Returns null if no suitable window is available today.
 */
export function bestAvailableStart(
  window: PhaseWindow,
  nowMin: number,
  durationMin: number,
  heavy: boolean,
): number | null {
  const tiers: Array<[number, number][]> = heavy
    ? [window.peak, window.flow, window.maintenance]
    : [window.peak, window.flow, window.maintenance];

  for (const tier of tiers) {
    for (const [start, end] of tier) {
      const effectiveStart = Math.max(start, nowMin + 15);
      if (effectiveStart + durationMin <= end) {
        return effectiveStart;
      }
    }
  }
  return null;
}
