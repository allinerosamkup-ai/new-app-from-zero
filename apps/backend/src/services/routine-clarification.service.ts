import type { RoutineClassifiedItem } from '../contracts/routine-builder.contract';

export type RoutineClarificationField = 'date_and_time' | 'recurrence' | 'title';
export type RoutineClarificationAnswerType = 'datetime' | 'frequency' | 'text';

export type RoutineClarificationQuestion = {
  id: string;
  itemId: string;
  field: RoutineClarificationField;
  answerType: RoutineClarificationAnswerType;
  prompt: string;
  reason: string;
  priority: number;
  options?: Array<{ value: string; label: string }>;
};

const AMBIGUOUS_TASK = /^(resolver( isso)?|organizar( as)? coisas?|ver isso|dar um jeito|cuidar disso|fazer isso)$/i;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isAmbiguousTask(item: RoutineClassifiedItem): boolean {
  const title = normalize(item.title);
  return title.split(' ').length < 2 || AMBIGUOUS_TASK.test(title);
}

export class RoutineClarificationService {
  static build(items: RoutineClassifiedItem[]): {
    needsClarification: boolean;
    questions: RoutineClarificationQuestion[];
  } {
    const candidates: RoutineClarificationQuestion[] = [];

    for (const item of items) {
      if (item.reviewState === 'excluded') continue;

      if (item.kind === 'calendar' && (!item.date || !item.startTime)) {
        candidates.push({
          id: `question:${item.id}:date_and_time`,
          itemId: item.id,
          field: 'date_and_time',
          answerType: 'datetime',
          prompt: `Em que dia e horário acontece “${item.title}”?`,
          reason: 'Sem data e horário, a Airia não consegue proteger esse compromisso na semana.',
          priority: 100,
        });
        continue;
      }

      if (item.kind === 'habit' && !item.recurrence) {
        candidates.push({
          id: `question:${item.id}:recurrence`,
          itemId: item.id,
          field: 'recurrence',
          answerType: 'frequency',
          prompt: `Com que frequência “${item.title}” precisa aparecer?`,
          reason: 'A frequência decide em quais dias o hábito deve entrar.',
          priority: 90,
          options: [
            { value: 'daily', label: 'Todos os dias' },
            { value: 'weekdays', label: 'Dias úteis' },
            { value: 'three_per_week', label: '3 vezes por semana' },
            { value: 'weekly', label: '1 vez por semana' },
          ],
        });
        continue;
      }

      if (item.kind === 'task' && isAmbiguousTask(item)) {
        candidates.push({
          id: `question:${item.id}:title`,
          itemId: item.id,
          field: 'title',
          answerType: 'text',
          prompt: `O que precisa estar concretamente concluído em “${item.title}”?`,
          reason: 'A ação precisa ter um resultado observável para entrar na agenda.',
          priority: 80,
        });
      }
    }

    const questions = candidates
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);

    return {
      needsClarification: questions.length > 0,
      questions,
    };
  }
}
