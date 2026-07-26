export type GuidedOption = {
  id: string;
  label: string;
  emoji: string;
};

export type GuidedCategory = {
  id: string;
  label: string;
  options: GuidedOption[];
};

export type HabitTemplate = {
  id: string;
  title: string;
  emoji: string;
  frequency: 'daily' | 'weekly';
  daysOfWeek: number[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  durationMinutes: number;
  energyCost: 1 | 2 | 3;
};

/** Intenção carrega os hábitos que ela sugere — o mapa é do backend, não adivinhado na tela. */
export type GuidedIntention = GuidedOption & {
  habitTemplateIds: string[];
};

export type GuidedLibrary = {
  lifeAreas: GuidedOption[];
  energyDrains: GuidedCategory[];
  energyRestorers: GuidedCategory[];
  intentions: GuidedIntention[];
  habitTemplates: HabitTemplate[];
};

export type FixedCommitment = {
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type GuidedAnswers = {
  lifeAreas: string[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  fixedCommitments: FixedCommitment[];
  energyDrains: string[];
  energyRestorers: string[];
  intentions: string[];
  selectedHabits: {
    templateId: string;
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    daysOfWeek: number[];
    timesPerWeek: number | null;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
    durationMinutes: number;
  }[];
  currentState: {
    mood: number;
    energy: number;
    focus: number;
    sleepQuality: string;
  };
  freeText?: string;
};

export type AvailabilityPeriod = 'morning' | 'daytime' | 'evening' | 'flexible';

const AVAILABILITY_PERIODS: Record<AvailabilityPeriod, { startTime: string; endTime: string }> = {
  morning: { startTime: '07:00', endTime: '13:00' },
  daytime: { startTime: '09:00', endTime: '18:00' },
  evening: { startTime: '17:00', endTime: '23:00' },
  flexible: { startTime: '07:00', endTime: '23:00' },
};

export function buildAvailabilityWindows(
  days: number[],
  period: AvailabilityPeriod,
): GuidedAnswers['availability'] {
  const window = AVAILABILITY_PERIODS[period];
  return Array.from(new Set(days))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((left, right) => left - right)
    .map((dayOfWeek) => ({ dayOfWeek, ...window }));
}

export const EMPTY_ANSWERS: GuidedAnswers = {
  lifeAreas: [],
  availability: [],
  fixedCommitments: [],
  energyDrains: [],
  energyRestorers: [],
  intentions: [],
  selectedHabits: [],
  currentState: { mood: 5, energy: 5, focus: 5, sleepQuality: 'razoável' },
};

export const WEEKDAYS = [
  { value: 0, short: 'D', label: 'Domingo' },
  { value: 1, short: 'S', label: 'Segunda' },
  { value: 2, short: 'T', label: 'Terça' },
  { value: 3, short: 'Q', label: 'Quarta' },
  { value: 4, short: 'Q', label: 'Quinta' },
  { value: 5, short: 'S', label: 'Sexta' },
  { value: 6, short: 'S', label: 'Sábado' },
] as const;

/** Converte um template da biblioteca no formato que o backend espera. */
export function habitFromTemplate(template: HabitTemplate): GuidedAnswers['selectedHabits'][number] {
  return {
    templateId: template.id,
    title: template.title,
    frequency: template.frequency,
    daysOfWeek: template.daysOfWeek,
    timesPerWeek: template.frequency === 'weekly' ? template.daysOfWeek.length || null : null,
    timeOfDay: template.timeOfDay,
    durationMinutes: template.durationMinutes,
  };
}
