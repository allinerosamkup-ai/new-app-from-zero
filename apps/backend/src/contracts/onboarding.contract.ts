import { z } from 'zod';

/**
 * Self-reported diagnoses. NOT a clinical diagnosis. Used to personalize tone
 * and suggestions in MoodCycleEngine, decision-engine, and Aura prompt.
 */
export const PRIOR_DIAGNOSIS_VALUES = [
  'bipolar_ii',
  'cyclothymia',
  'adhd',
  'cyclical_depression',
  'prefer_not_to_say',
] as const;

export const PriorDiagnosisSchema = z.enum(PRIOR_DIAGNOSIS_VALUES);
export type PriorDiagnosis = z.infer<typeof PriorDiagnosisSchema>;

/**
 * Sexo autorrelatado. Existe por um motivo único: decidir se o rastreamento de
 * ciclo menstrual aparece. Nenhum outro comportamento do produto ramifica aqui.
 */
export const BIOLOGICAL_SEX_VALUES = [
  'female',
  'male',
] as const;

export const BiologicalSexSchema = z.enum(BIOLOGICAL_SEX_VALUES);
export type BiologicalSex = z.infer<typeof BiologicalSexSchema>;

/**
 * Único ponto de decisão do gate menstrual — front e back leem daqui para não
 * divergirem.
 *
 * `null` = ainda não perguntado. Nesse caso o bloco continua visível, porque
 * esconder um campo que a pessoa já usava por causa de uma pergunta que ela
 * nunca viu seria perder dado sem aviso. Quem responde decide de verdade.
 */
export function tracksMenstrualCycle(sex: BiologicalSex | null | undefined): boolean {
  if (sex === null || sex === undefined) return true;
  return sex === 'female';
}

export const OnboardingProcessSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  age: z.number().int().min(13).max(120).nullable(),
  currentFeeling: z.string().trim().min(2).max(1000),
  sleepQualityNote: z.string().trim().min(2).max(1000),
  wakeTime: z.string().trim().min(1).max(10),
  sleepTime: z.string().trim().min(1).max(10),
  routineText: z.string().trim().min(2).max(2000),
  mainEnergyPressure: z.string().trim().min(2).max(2000),
  primaryGoal: z.string().trim().min(2).max(1000),
  supportGoals: z.array(z.string().trim().min(1)).max(6).default([]),
  cycleStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycleLength: z.number().int().min(21).max(40).nullable().optional(),
  lutealLength: z.number().int().min(9).max(17).nullable().optional(),
  priorDiagnoses: z.array(PriorDiagnosisSchema).max(5).default([]).optional(),
  biologicalSex: BiologicalSexSchema.nullable().optional(),
  medicationCurrentlyUsing: z.boolean().nullable().optional(),
  medicationNotes: z.string().trim().max(500).nullable().optional(),
});

export type OnboardingProcessInput = z.infer<typeof OnboardingProcessSchema>;

/**
 * Diagnostic groups that unlock specialized check-in fields and Aura tone.
 * "prefer_not_to_say" is excluded — it intentionally hides specialization.
 */
export function hasActiveDiagnosis(diagnoses: PriorDiagnosis[] | null | undefined): boolean {
  if (!diagnoses) return false;
  return diagnoses.some((d) => d !== 'prefer_not_to_say');
}

export function hasAdhdContext(diagnoses: PriorDiagnosis[] | null | undefined): boolean {
  return Boolean(diagnoses?.includes('adhd'));
}

export function hasBipolarContext(diagnoses: PriorDiagnosis[] | null | undefined): boolean {
  if (!diagnoses) return false;
  return diagnoses.includes('bipolar_ii') || diagnoses.includes('cyclothymia');
}
