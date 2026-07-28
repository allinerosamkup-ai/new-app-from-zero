import type { AuraCommandAction, AuraCommandResponse } from '../contracts/aura-command.contract';

type CaptureJudgment = {
  captureAs?: string;
  captureMode?: string;
  explicitness?: string;
  allowedMutationActions: string[];
};

type RecoveryInput = {
  response: AuraCommandResponse;
  message: string;
  localDate: string;
  captureJudgment: CaptureJudgment;
};

const MUTATING_ACTIONS = new Set<AuraCommandAction>([
  'create_task',
  'create_checklist',
  'create_goal',
  'create_agenda',
  'handoff_to_journal',
  'update_task',
  'delete_task',
  'complete_items',
  'log_checkin',
  'create_checkin',
  'create_capture',
  'create_calendar_event',
  'create_habit',
  'postpone_task',
  'start_task',
  'adapt_agenda',
]);

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, '')
    .trim();
}

function extractTaskTitle(message: string): string | null {
  const match = /(?:tarefa|lembrete)\s+(.+?)(?=\s+(?:amanh[ãa]|hoje|depois\s+de\s+amanh[ãa])(?:\s|[.!?]|$)|[.!?](?:\s|$)|$)/i.exec(message);
  const title = cleanTitle(match?.[1] ?? '');
  return title || null;
}

function extractGoalTitle(message: string): string | null {
  const match = /(?:quero\s+como\s+meta|(?:crie|cria|adicione|adiciona|inclua|inclui)\s+(?:uma\s+)?meta(?:\s+(?:de|para))?)\s+(.+?)(?=[.!?](?:\s|$)|$)/i.exec(message);
  const title = cleanTitle(match?.[1] ?? '');
  return title || null;
}

function relativeDate(message: string, localDate: string): string {
  if (/(?:^|\s)depois\s+de\s+amanh[ãa](?=\s|[.!?,;]|$)/i.test(message)) return addDays(localDate, 2);
  if (/(?:^|\s)amanh[ãa](?=\s|[.!?,;]|$)/i.test(message)) return addDays(localDate, 1);
  return localDate;
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractScore(message: string, labels: string[]): number | null {
  const source = normalized(message);
  const labelPattern = labels.join('|');
  const match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:esta|estou|em|de|:|=|-)*\\s*(10|[1-9])(?:\\s*(?:de|\\/|em)\\s*10)?\\b`, 'i').exec(source);
  return match ? Number(match[1]) : null;
}

function recoverTask(input: RecoveryInput): AuraCommandResponse | null {
  const title = extractTaskTitle(input.message);
  if (!title) return null;
  return {
    assistantMessage: 'Entendi. Vou colocar a tarefa no Planner e escolher o melhor horário livre para o seu dia.',
    intent: 'planner_task',
    action: 'create_task',
    payload: {
      title,
      date: relativeDate(input.message, input.localDate),
      autoScheduleRequested: true,
    },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

function recoverGoal(input: RecoveryInput): AuraCommandResponse | null {
  const title = extractGoalTitle(input.message);
  if (!title) return null;
  return {
    assistantMessage: 'Entendi a meta. Vou dividi-la em ações pequenas e colocar o primeiro passo no seu dia.',
    intent: 'goal_project',
    action: 'create_goal',
    payload: {
      ...input.response.payload,
      title,
      subgoals: [
        `Definir o resultado concreto de ${title}`,
        `Reunir o que já existe para ${title}`,
        `Executar a primeira versão de ${title}`,
      ],
    },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

function recoverCheckin(input: RecoveryInput): AuraCommandResponse | null {
  const moodScore = extractScore(input.message, ['humor']);
  const energyScore = extractScore(input.message, ['energia']);
  const clarityScore = extractScore(input.message, ['clareza', 'foco']);
  const irritabilityScore = extractScore(input.message, ['irritabilidade', 'irritacao']);
  if ([moodScore, energyScore, clarityScore, irritabilityScore].every((value) => value === null)) return null;
  return {
    assistantMessage: 'Preparei o check-in de hoje com os sinais que você informou.',
    intent: 'checkin',
    action: input.captureJudgment.allowedMutationActions.includes('log_checkin') ? 'log_checkin' : 'create_checkin',
    payload: {
      ...input.response.payload,
      localDate: input.localDate,
      moodScore,
      energyScore,
      clarityScore,
      irritabilityScore,
      note: input.message.slice(0, 500),
    },
    needsConfirmation: false,
    needsClarification: false,
    clarifyingQuestion: null,
  };
}

/**
 * Dá autoridade ao entendimento determinístico quando o modelo responde ou
 * pergunta apesar de a fala atual conter uma ordem explícita e tipada.
 */
export function recoverAuraCommandResponse(input: RecoveryInput): AuraCommandResponse {
  if (
    MUTATING_ACTIONS.has(input.response.action)
    && input.captureJudgment.allowedMutationActions.includes(input.response.action)
  ) return input.response;
  if (input.captureJudgment.explicitness !== 'explicit') return input.response;

  const allowed = new Set(input.captureJudgment.allowedMutationActions);
  if (allowed.has('create_goal')) return recoverGoal(input) ?? input.response;
  if (input.captureJudgment.captureAs === 'checkin' && (allowed.has('log_checkin') || allowed.has('create_checkin'))) {
    return recoverCheckin(input) ?? input.response;
  }
  if (input.captureJudgment.captureAs === 'task' && allowed.has('create_task')) {
    return recoverTask(input) ?? input.response;
  }
  return input.response;
}
