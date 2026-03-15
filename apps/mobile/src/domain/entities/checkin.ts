// Alinhado com: public.daily_checkins (Supabase)
// Constraint UNIQUE: (user_id, local_date, checkin_slot)

export type CheckinPeriod = 'manha' | 'tarde' | 'noite';
export type BackendCheckinSlot = 'morning' | 'midday' | 'evening';

export type DayStateLabel =
  | 'leve'
  | 'estavel'
  | 'sensivel'
  | 'sobrecarregado'
  | 'moderado'
  | 'sensível'
  | 'crítico';

export type FocusIntensity = 'L' | 'M' | 'P';

export type TccTechnique =
  | 'ativacao_comportamental'
  | 'reestruturacao_cognitiva'
  | 'regulacao_emocional'
  | 'higiene_sono_energia'
  | 'agenda_prazer'
  | 'exposicao_gradual';

export interface EnergyStateInternal {
  analysis: string;
  recommendations: string[];
  suggestedIntensity: FocusIntensity;
}

export interface Checkin {
  id: string;
  date: string;           // ISO date: "2026-03-13"
  period: CheckinPeriod;
  moodScore: number;      // 1-5
  energyScore: number;    // 1-5
  clarityScore: number;   // 1-5
  irritabilityScore: number; // 1-5
  physicalScore: number;  // 1-5
  socialScore: number;    // 1-5
  note?: string;
  // Estado calculado pela IA
  stateLabel?: string;           // "Dia sensível" — display
  stateLabelType?: string; // valor vindo do backend
  tccSuggestion?: string;
  tccTechnique?: TccTechnique;
  energyStateInternal?: EnergyStateInternal;
}

// Payload enviado ao criar um check-in
export interface CheckinCreateInput {
  date?: string;          // default: today
  period: CheckinPeriod;
  moodScore: number;
  energyScore: number;
  clarityScore: number;
  irritabilityScore: number;
  physicalScore: number;
  socialScore: number;
  note?: string;
}

export type CheckinFormData = CheckinCreateInput;

export interface CheckinCreateResult {
  checkin: Checkin;
}

export interface RecentCheckinsResult {
  checkins: Checkin[];
}

// Mapa de display dos estados
export const DAY_STATE_DISPLAY: Partial<Record<DayStateLabel, string>> = {
  leve:           'Dia leve',
  estavel:        'Dia estável',
  sensivel:       'Dia sensível',
  moderado:       'Dia moderado',
  'sensível':     'Dia sensível',
  'crítico':      'Dia crítico',
  sobrecarregado: 'Dia intenso',
} as const;

// Labels dos períodos para UI
export const PERIOD_LABELS: Record<CheckinPeriod, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
} as const;

export const PERIOD_TO_SLOT: Record<CheckinPeriod, BackendCheckinSlot> = {
  manha: 'morning',
  tarde: 'midday',
  noite: 'evening',
} as const;

export const SLOT_TO_PERIOD: Record<BackendCheckinSlot, CheckinPeriod> = {
  morning: 'manha',
  midday: 'tarde',
  evening: 'noite',
} as const;
