// Menstrual phase auto-compute - modulador do ritmo de humor e energia, nunca foco principal.

export type MenstrualPhase = "menstrual" | "folicular" | "ovulatoria" | "lutea";

export interface MenstrualReport {
  phase: MenstrualPhase;
  dayOfCycle: number;
  cycleLength: number;
  daysUntilNext: number;
  label: string;
  emoji: string;
  energyModifier: number;
  aiContext: string;
}

export interface MenstrualInput {
  cycleStart: string | null | undefined;
  cycleLength: number | null | undefined;
  lutealLength: number | null | undefined;
  today?: Date;
}

const PHASE_META: Record<MenstrualPhase, { label: string; emoji: string; energyModifier: number }> = {
  menstrual:  { label: "Menstrual",  emoji: "\u{1F319}", energyModifier: 0.80 },
  folicular:  { label: "Folicular",  emoji: "\u{1F331}", energyModifier: 1.10 },
  ovulatoria: { label: "Ovulatoria", emoji: "\u2728",    energyModifier: 1.15 },
  lutea:      { label: "Lutea",      emoji: "\u{1F317}", energyModifier: 0.90 },
};

function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDaysUTC(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  const aUTC = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUTC = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((aUTC - bUTC) / MS_PER_DAY);
}

export function computeMenstrualPhase(input: MenstrualInput): MenstrualReport | null {
  const { cycleStart, cycleLength, lutealLength, today = new Date() } = input;

  if (!cycleStart || !cycleLength || !lutealLength) return null;
  if (cycleLength < 21 || cycleLength > 40) return null;
  if (lutealLength < 9 || lutealLength > 17) return null;
  if (lutealLength >= cycleLength) return null;

  const startDate = parseISODate(cycleStart);
  if (!startDate) return null;

  const daysSinceStart = diffDaysUTC(today, startDate);
  if (daysSinceStart < 0) return null;

  const dayOfCycle = (daysSinceStart % cycleLength) + 1;
  const daysUntilNext = cycleLength - dayOfCycle + 1;

  const menstrualLen = Math.min(5, Math.floor(cycleLength * 0.18));
  const ovulationDay = cycleLength - lutealLength;

  let phase: MenstrualPhase;
  if (dayOfCycle <= menstrualLen) {
    phase = "menstrual";
  } else if (dayOfCycle >= ovulationDay - 1 && dayOfCycle <= ovulationDay + 1) {
    phase = "ovulatoria";
  } else if (dayOfCycle < ovulationDay) {
    phase = "folicular";
  } else {
    phase = "lutea";
  }

  const meta = PHASE_META[phase];
  const aiContext = buildAiContext(phase, dayOfCycle, cycleLength, meta.energyModifier);

  return {
    phase,
    dayOfCycle,
    cycleLength,
    daysUntilNext,
    label: meta.label,
    emoji: meta.emoji,
    energyModifier: meta.energyModifier,
    aiContext,
  };
}

function buildAiContext(
  phase: MenstrualPhase,
  dayOfCycle: number,
  cycleLength: number,
  modifier: number,
): string {
  const pct = Math.round((modifier - 1) * 100);
  const pctLabel = pct === 0 ? "neutra" : pct > 0 ? `+${pct}%` : `${pct}%`;
  const phaseHuman: Record<MenstrualPhase, string> = {
    menstrual:  "fase menstrual",
    folicular:  "fase folicular (pre-ovulacao)",
    ovulatoria: "fase ovulatoria",
    lutea:      "fase lutea (pre-menstrual)",
  };
  return `Usuaria em ${phaseHuman[phase]}, dia ${dayOfCycle}/${cycleLength} do ciclo menstrual. Expectativa de energia biologica: ${pctLabel}. Use como contexto, nunca como justificativa unica.`;
}
