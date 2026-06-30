import { z } from 'zod';

const CATEGORY_ALIASES: Record<string, 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'casa' | 'outro'> = {
  trabalho: 'trabalho',
  work: 'trabalho',
  pessoal: 'pessoal',
  personal: 'pessoal',
  geral: 'pessoal',
  rotina: 'pessoal',
  casa: 'casa',
  lazer: 'pessoal',
  planning: 'pessoal',
  foco: 'trabalho',
  social: 'social',
  saude: 'autocuidado',
  saúde: 'autocuidado',
  health: 'autocuidado',
  energia: 'autocuidado',
  humor: 'autocuidado',
  autocuidado: 'autocuidado',
  'self-care': 'autocuidado',
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

const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  done: z.boolean(),
});

const RecurringConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'custom']),
  days: z.array(z.number().int().min(0).max(6)),
  everyNDays: z.number().int().min(1).max(365),
});

export const TimelineBlockSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:mm
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),   // HH:mm
  title: z.string().min(1),
  category: z.preprocess(normalizeCategory, z.enum(['trabalho', 'pessoal', 'autocuidado', 'social', 'casa', 'outro'])),
  intensity: z.preprocess(normalizeIntensity, z.enum(['L', 'M', 'P'])), // Leve, Média, Pesada
  status: z.enum(['planned', 'completed', 'postponed']).default('planned'),
  noteMode: z.enum(['text', 'checklist']).optional(),
  note: z.string().optional().nullable(),
  checklist: z.array(ChecklistItemSchema).optional(),
  recurring: RecurringConfigSchema.optional(),
  energyLevel: z.enum(['alta', 'media', 'leve']).optional(),
  lastResetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  persistentReminderEnabled: z.boolean().optional(),
  persistentReminderIntervalMinutes: z.number().int().min(5).max(720).optional().nullable(),
  vibrateEnabled: z.boolean().optional(),
  alarmEnabled: z.boolean().optional(),
  recurringNotificationEnabled: z.boolean().optional(),
  visualRepeatEnabled: z.boolean().optional(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isAiSuggested: z.boolean().optional(),
  aiReasoning: z.string().optional().nullable(),
  gcalEventId: z.string().optional().nullable(),
});

export type TimelineBlockInput = z.infer<typeof TimelineBlockSchema>;

export interface ConflictResolution {
  type: 'MOVE_BLOCK_LATER' | 'MOVE_BLOCK_EARLIER' | 'DOWNGRADE_INTENSITY' | 'POSTPONE_TOMORROW' | 'CANCEL';
  /** ID (ou title fallback) do bloco que vai ser ajustado. */
  targetBlockId: string;
  targetBlockTitle: string;
  parameters?: Record<string, unknown>;
  reason: string;
  confidence: number;
}

export interface TimeConflict {
  block1: string;
  block2: string;
  overlapMinutes: number;
  /** Sprint Frente 3: resoluções heurísticas determinísticas */
  block1Id?: string;
  block2Id?: string;
  suggestedResolutions?: ConflictResolution[];
}

export type BusyWindow = {
  startTime: string;
  endTime: string;
};

export type SuggestedAgendaBlock = {
  horario_inicio: string;
  horario_fim: string;
  tipo: 'trabalho' | 'autocuidado' | 'casa' | 'social' | 'descanso' | 'refeicao' | 'flexivel';
  label: string;
  tarefas_sugeridas: string[];
  razao_ia: string;
  local_date: string;
  intensity: 'L' | 'M' | 'P';
};

const SUGGESTION_DAY_START = 8 * 60;
const SUGGESTION_DAY_END = 20 * 60;
const SLOT_STEP_MINUTES = 15;

function parseTimeToMinutes(time: string): number | null {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function suggestionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSuggestionIntensity(value: unknown, type: string): 'L' | 'M' | 'P' {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalized === 'L' || normalized === 'M' || normalized === 'P') {
    return normalized;
  }

  if (type === 'trabalho') return 'P';
  if (type === 'autocuidado' || type === 'social' || type === 'casa') return 'L';
  return 'M';
}

function normalizeSuggestionType(value: unknown): SuggestedAgendaBlock['tipo'] {
  const allowed = new Set<SuggestedAgendaBlock['tipo']>([
    'trabalho',
    'autocuidado',
    'casa',
    'social',
    'descanso',
    'refeicao',
    'flexivel',
  ]);
  const type = normalizeText(value).toLowerCase() as SuggestedAgendaBlock['tipo'];
  return allowed.has(type) ? type : 'flexivel';
}

export class PlannerService {
  static resolveSuggestedAgendaDate(localDate: string, hour: number): string {
    if (hour < 18) {
      return localDate;
    }

    const date = new Date(`${localDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return localDate;
    }

    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  static timeToMinutes(time: string): number {
    return parseTimeToMinutes(time) ?? 0;
  }

  static minutesToTime(minutes: number): string {
    const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  static normalizeBusyWindows(blocks: Array<{ startTime: string; endTime: string }>): BusyWindow[] {
    const windows = blocks
      .map((block) => {
        const start = parseTimeToMinutes(block.startTime);
        const end = parseTimeToMinutes(block.endTime);
        if (start === null || end === null) {
          return null;
        }

        const clampedStart = Math.max(SUGGESTION_DAY_START, start);
        const clampedEnd = Math.min(SUGGESTION_DAY_END, end);
        if (clampedStart >= clampedEnd) {
          return null;
        }

        return { start: clampedStart, end: clampedEnd };
      })
      .filter((window): window is { start: number; end: number } => window !== null)
      .sort((a, b) => a.start - b.start);

    const merged: Array<{ start: number; end: number }> = [];
    for (const window of windows) {
      const previous = merged[merged.length - 1];
      if (!previous || window.start > previous.end) {
        merged.push({ ...window });
      } else {
        previous.end = Math.max(previous.end, window.end);
      }
    }

    return merged.map((window) => ({
      startTime: this.minutesToTime(window.start),
      endTime: this.minutesToTime(window.end),
    }));
  }

  static findSuggestedSlot(input: {
    intensity: 'L' | 'M' | 'P';
    category: string;
    durationMinutes: number;
    busyWindows: BusyWindow[];
  }): BusyWindow | null {
    const duration = Math.max(SLOT_STEP_MINUTES, Math.ceil(input.durationMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES);
    if (duration > SUGGESTION_DAY_END - SUGGESTION_DAY_START) {
      return null;
    }

    const category = input.category.trim().toLowerCase();
    const isHeavy = input.intensity === 'P' || category === 'trabalho' || category === 'foco';
    const isLight = input.intensity === 'L' || category === 'autocuidado' || category === 'social';
    const preferredRange = isHeavy
      ? { start: SUGGESTION_DAY_START, end: 12 * 60 }
      : isLight
        ? { start: 14 * 60, end: SUGGESTION_DAY_END }
        : { start: 10 * 60, end: 16 * 60 };

    const normalizedBusy = this.normalizeBusyWindows(input.busyWindows);
    const busyMinutes = normalizedBusy
      .map((window) => ({
        start: parseTimeToMinutes(window.startTime),
        end: parseTimeToMinutes(window.endTime),
      }))
      .filter((window): window is { start: number; end: number } => window.start !== null && window.end !== null);

    const findInRange = (range: { start: number; end: number }) => {
      for (let start = range.start; start + duration <= range.end; start += SLOT_STEP_MINUTES) {
        const end = start + duration;
        const overlaps = busyMinutes.some((window) => start < window.end && end > window.start);
        if (!overlaps) {
          return {
            startTime: this.minutesToTime(start),
            endTime: this.minutesToTime(end),
          };
        }
      }

      return null;
    };

    return findInRange(preferredRange) ?? findInRange({ start: SUGGESTION_DAY_START, end: SUGGESTION_DAY_END });
  }

  static scheduleAgendaSuggestions(input: {
    targetDate: string;
    busyWindows: BusyWindow[];
    blocks: unknown;
  }): SuggestedAgendaBlock[] {
    if (!Array.isArray(input.blocks)) {
      return [];
    }

    const scheduled: SuggestedAgendaBlock[] = [];
    const busyWindows = this.normalizeBusyWindows(input.busyWindows);
    const seenTasks = new Set<string>();

    for (const item of input.blocks) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const block = item as Record<string, unknown>;
      const type = normalizeSuggestionType(block.tipo);
      const tasks = Array.isArray(block.tarefas_sugeridas)
        ? block.tarefas_sugeridas
          .map((task) => normalizeText(task))
          .filter(Boolean)
          .filter((task) => {
            const key = suggestionKey(task);
            if (!key || seenTasks.has(key)) return false;
            seenTasks.add(key);
            return true;
          })
        : [];

      if (tasks.length === 0 || type === 'descanso' || type === 'refeicao') {
        continue;
      }

      const start = parseTimeToMinutes(normalizeText(block.horario_inicio));
      const end = parseTimeToMinutes(normalizeText(block.horario_fim));
      const rawDuration = start !== null && end !== null && end > start ? end - start : tasks.length * 30;
      const durationMinutes = Math.max(SLOT_STEP_MINUTES, Math.min(120, rawDuration));
      const intensity = normalizeSuggestionIntensity(block.intensity, type);
      const slot = this.findSuggestedSlot({
        intensity,
        category: type,
        durationMinutes,
        busyWindows,
      });

      if (!slot) {
        continue;
      }

      busyWindows.push(slot);
      scheduled.push({
        horario_inicio: slot.startTime,
        horario_fim: slot.endTime,
        tipo: type,
        label: normalizeText(block.label) || 'Sugestao da Airia',
        tarefas_sugeridas: tasks,
        razao_ia: normalizeText(block.razao_ia) || 'Encaixado em um horario livre do seu dia.',
        local_date: input.targetDate,
        intensity,
      });

      if (scheduled.length >= 4) {
        break;
      }
    }

    return scheduled;
  }

  static normalizeSuggestedTimelineBlocks(input: {
    blocks: TimelineBlockInput[];
    busyWindows: BusyWindow[];
  }): TimelineBlockInput[] {
    let busyWindows = this.normalizeBusyWindows(input.busyWindows);
    const normalizedBlocks: TimelineBlockInput[] = [];

    for (const block of input.blocks) {
      const start = parseTimeToMinutes(block.startTime);
      const end = parseTimeToMinutes(block.endTime);
      const durationMinutes = start !== null && end !== null && end > start ? end - start : 30;
      const shouldAutoSchedule = block.isAiSuggested === true && !block.id;

      if (!shouldAutoSchedule) {
        normalizedBlocks.push(block);
        busyWindows = this.normalizeBusyWindows([
          ...busyWindows,
          { startTime: block.startTime, endTime: block.endTime },
        ]);
        continue;
      }

      const slot = this.findSuggestedSlot({
        intensity: block.intensity,
        category: block.category,
        durationMinutes,
        busyWindows,
      });

      if (!slot) {
        continue;
      }

      const scheduledBlock = {
        ...block,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };

      normalizedBlocks.push(scheduledBlock);
      busyWindows = this.normalizeBusyWindows([...busyWindows, slot]);
    }

    return normalizedBlocks;
  }

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
   * Sprint Frente 3: agora retorna `suggestedResolutions` heurísticas
   * (determinísticas, sem chamar IA) por conflito.
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
            block1Id: b1.id ?? undefined,
            block2Id: b2.id ?? undefined,
            overlapMinutes,
            suggestedResolutions: this.buildHeuristicResolutions(b1, b2, overlapMinutes),
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Heurística determinística pra sugerir resoluções de conflito.
   * Não chama IA — o endpoint /api/ai/resolve-conflict é fallback opcional.
   */
  private static buildHeuristicResolutions(
    blockA: any,
    blockB: any,
    overlapMinutes: number,
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];
    const intensityRank: Record<string, number> = { L: 1, M: 2, P: 3 };
    const a = {
      id: blockA.id ?? blockA.title,
      title: blockA.title ?? '',
      intensity: String(blockA.intensity ?? 'M').toUpperCase()[0],
      isAiSuggested: Boolean(blockA.isAiSuggested),
    };
    const b = {
      id: blockB.id ?? blockB.title,
      title: blockB.title ?? '',
      intensity: String(blockB.intensity ?? 'M').toUpperCase()[0],
      isAiSuggested: Boolean(blockB.isAiSuggested),
    };

    // Heurística 1: bloco P sobrepõe bloco L → sugere DOWNGRADE_INTENSITY no L
    // (ou seja, transformar o L em "tarefa rápida" pra dar espaço pro P)
    if (intensityRank[a.intensity] > intensityRank[b.intensity]) {
      resolutions.push({
        type: 'DOWNGRADE_INTENSITY',
        targetBlockId: b.id,
        targetBlockTitle: b.title,
        reason: `"${a.title}" é mais pesado que "${b.title}". Reduzir intensidade de "${b.title}" libera foco.`,
        confidence: 0.78,
      });
    } else if (intensityRank[b.intensity] > intensityRank[a.intensity]) {
      resolutions.push({
        type: 'DOWNGRADE_INTENSITY',
        targetBlockId: a.id,
        targetBlockTitle: a.title,
        reason: `"${b.title}" é mais pesado que "${a.title}". Reduzir intensidade de "${a.title}" libera foco.`,
        confidence: 0.78,
      });
    }

    // Heurística 2: blocos com mesma intensidade → sugere MOVE_BLOCK_LATER
    // pro bloco com título mais longo (mais "trabalho") OU pro AI-suggested.
    if (a.intensity === b.intensity) {
      const moveTarget = a.isAiSuggested ? a : b.isAiSuggested ? b : (a.title.length >= b.title.length ? a : b);
      const minutesLater = overlapMinutes + 15;
      resolutions.push({
        type: 'MOVE_BLOCK_LATER',
        targetBlockId: moveTarget.id,
        targetBlockTitle: moveTarget.title,
        parameters: { minutesLater },
        reason: `Mover "${moveTarget.title}" ${minutesLater} min pra frente resolve a sobreposição.`,
        confidence: 0.72,
      });
    }

    // Heurística 3: sempre oferece "postpone tomorrow" como saída final
    // pro bloco AI-suggested (se houver) ou pro maior título
    const postponeTarget = a.isAiSuggested ? a : b.isAiSuggested ? b : (a.title.length >= b.title.length ? a : b);
    resolutions.push({
      type: 'POSTPONE_TOMORROW',
      targetBlockId: postponeTarget.id,
      targetBlockTitle: postponeTarget.title,
      reason: `Adiar "${postponeTarget.title}" pra amanhã libera o slot inteiro.`,
      confidence: 0.65,
    });

    return resolutions.slice(0, 3);
  }
}
