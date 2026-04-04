import { z } from 'zod';

const CATEGORY_ALIASES: Record<string, 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'outro'> = {
  trabalho: 'trabalho',
  work: 'trabalho',
  pessoal: 'pessoal',
  personal: 'pessoal',
  geral: 'pessoal',
  rotina: 'pessoal',
  social: 'social',
  saude: 'autocuidado',
  saúde: 'autocuidado',
  autocuidado: 'autocuidado',
  selfcare: 'autocuidado',
  outro: 'outro',
};

const INTENSITY_ALIASES: Record<string, 'L' | 'M' | 'P'> = {
  l: 'L',
  leve: 'L',
  m: 'M',
  media: 'M',
  média: 'M',
  p: 'P',
  pesada: 'P',
  pesado: 'P',
  alta: 'P',
};

function normalizeCategory(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return CATEGORY_ALIASES[value.trim().toLowerCase()] ?? value;
}

function normalizeIntensity(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return INTENSITY_ALIASES[value.trim().toLowerCase()] ?? value;
}

export const TimelineBlockSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:mm
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),   // HH:mm
  title: z.string().min(1),
  category: z.preprocess(normalizeCategory, z.enum(['trabalho', 'pessoal', 'autocuidado', 'social', 'outro'])),
  intensity: z.preprocess(normalizeIntensity, z.enum(['L', 'M', 'P'])), // Leve, Média, Pesada
  status: z.enum(['planned', 'completed', 'postponed']).default('planned'),
});

export type TimelineBlockInput = z.infer<typeof TimelineBlockSchema>;

export interface TimeConflict {
  block1: string;
  block2: string;
  overlapMinutes: number;
}

export class PlannerService {
  /**
   * Converte uma string "HH:mm" e uma data base em um objeto Date completo.
   */
  static parseTimeToDate(date: Date, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setUTCHours(hours, minutes, 0, 0);
    return newDate;
  }

  /**
   * Detecta conflitos de horário em uma lista de blocos.
   */
  static detectConflicts(blocks: any[]): TimeConflict[] {
    const conflicts: TimeConflict[] = [];

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const b1 = blocks[i];
        const b2 = blocks[j];

        const start1 = new Date(b1.startAt).getTime();
        const end1 = new Date(b1.endAt).getTime();
        const start2 = new Date(b2.startAt).getTime();
        const end2 = new Date(b2.endAt).getTime();

        // Lógica de sobreposição: (StartA < EndB) e (EndA > StartB)
        if (start1 < end2 && end1 > start2) {
          const overlapStart = Math.max(start1, start2);
          const overlapEnd = Math.min(end1, end2);
          const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

          conflicts.push({
            block1: b1.title,
            block2: b2.title,
            overlapMinutes,
          });
        }
      }
    }

    return conflicts;
  }
}
